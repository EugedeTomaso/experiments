import http from "http";
import { WebSocketServer } from "ws";
import { verifyToken, checkNodeAccess } from "./auth.js";
import {
  getOrCreateRoom,
  initRoom,
  addConn,
  removeConn,
  handleMessage,
  setupBroadcast,
} from "./rooms.js";

const PORT = parseInt(process.env.PORT || "4444", 10);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const roomName = url.pathname.slice(1);
  const token = url.searchParams.get("token");

  const match = roomName.match(/^node:(\d+)$/);
  if (!match) {
    ws.close(4400, "Invalid room name");
    return;
  }
  const nodeId = parseInt(match[1], 10);

  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4401, "Invalid token");
    return;
  }

  const { allowed, role } = await checkNodeAccess(nodeId, payload.user_id);
  if (!allowed) {
    ws.close(4403, "Access denied");
    return;
  }

  const readOnly = role === "viewer" || role === "commenter";
  const room = getOrCreateRoom(nodeId);

  await initRoom(room);

  if (!room._broadcastSetup) {
    setupBroadcast(room);
    room._broadcastSetup = true;
  }

  addConn(room, ws, { userId: payload.user_id, readOnly });

  console.log(
    `[room node:${nodeId}] user ${payload.user_id} connected (role: ${role}, clients: ${room.conns.size})`
  );

  ws.on("message", (msg) => handleMessage(room, ws, msg));
  ws.on("close", () => {
    removeConn(room, ws);
    console.log(
      `[room node:${nodeId}] user ${payload.user_id} disconnected (clients: ${room.conns.size})`
    );
  });
});

server.listen(PORT, () => {
  console.log(`Collab server listening on port ${PORT}`);
});
