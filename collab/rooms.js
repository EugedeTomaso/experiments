import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync.js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { createPersistence } from "./persistence.js";

const rooms = new Map();
const GRACE_PERIOD_MS = 60_000; // 60s before destroying empty room

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

export function getOrCreateRoom(nodeId) {
  const key = `node:${nodeId}`;
  if (rooms.has(key)) {
    const room = rooms.get(key);
    clearTimeout(room._destroyTimer);
    room._destroyTimer = null;
    return room;
  }

  const ydoc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(ydoc);
  const persistence = createPersistence(nodeId, ydoc);
  const conns = new Map(); // ws -> { readOnly, userId }

  const room = {
    nodeId,
    ydoc,
    awareness,
    persistence,
    conns,
    _destroyTimer: null,
    _initialized: false,
    _initPromise: null,
    _broadcastSetup: false,
  };

  rooms.set(key, room);
  return room;
}

export async function initRoom(room) {
  if (room._initialized) return;
  if (room._initPromise) return room._initPromise;

  room._initPromise = room.persistence.load().then(() => {
    room._initialized = true;
  });
  return room._initPromise;
}

export function addConn(room, ws, { userId, readOnly }) {
  room.conns.set(ws, { userId, readOnly });

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.ydoc);
  ws.send(encoding.toUint8Array(encoder));

  // Send awareness
  const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
    room.awareness,
    Array.from(room.awareness.getStates().keys())
  );
  const awarenessEncoder = encoding.createEncoder();
  encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
  encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
  ws.send(encoding.toUint8Array(awarenessEncoder));
}

export function removeConn(room, ws) {
  room.conns.delete(ws);

  if (room.conns.size === 0) {
    // Flush persistence immediately
    room.persistence.flush();

    // Start grace period timer
    room._destroyTimer = setTimeout(() => {
      room.persistence.destroy();
      room.awareness.destroy();
      room.ydoc.destroy();
      rooms.delete(`node:${room.nodeId}`);
      console.log(`[room node:${room.nodeId}] destroyed after grace period`);
    }, GRACE_PERIOD_MS);
  }
}

export function handleMessage(room, ws, message) {
  const conn = room.conns.get(ws);
  if (!conn) return;

  const decoder = decoding.createDecoder(new Uint8Array(message));
  const msgType = decoding.readVarUint(decoder);

  switch (msgType) {
    case MSG_SYNC: {
      // Peek at sync message subtype before processing to enforce read-only
      const syncType = decoding.readVarUint(decoder);
      if (conn.readOnly && syncType === syncProtocol.messageYjsUpdate) {
        return; // drop update from read-only client before applying
      }

      // Restore decoder position so readSyncMessage can read the subtype
      decoder.pos -= 1;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, conn);

      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
      break;
    }
    case MSG_AWARENESS: {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(room.awareness, update, conn);
      // Broadcast awareness to all other clients
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      const msg = encoding.toUint8Array(encoder);
      room.conns.forEach((_, otherWs) => {
        if (otherWs !== ws && otherWs.readyState === 1) {
          otherWs.send(msg);
        }
      });
      break;
    }
  }
}

// Setup broadcast: when ydoc gets updated, broadcast to all connected clients
export function setupBroadcast(room) {
  room.ydoc.on("update", (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);

    room.conns.forEach((conn, ws) => {
      if (ws.readyState === 1 && ws !== origin) {
        ws.send(msg);
      }
    });
  });
}
