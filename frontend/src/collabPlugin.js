import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from "y-prosemirror";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || "ws://localhost:4444";
const OFFLINE_GRACE_MS = 60_000;

const COLORS = [
  "#4A90D9", "#E8734A", "#50B83C", "#9C6ADE",
  "#EEC200", "#47C1BF", "#DE3618", "#637381",
  "#F49342", "#5C6AC4", "#00848E", "#BF0711",
];

function userColor(userId) {
  return COLORS[userId % COLORS.length];
}

export function createCollabSession(nodeId, jwt, userInfo) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    COLLAB_URL,
    `node:${nodeId}`,
    ydoc,
    { params: { token: jwt } }
  );

  const awareness = provider.awareness;
  const xmlFragment = ydoc.getXmlFragment("prosemirror");
  const aiSuggestions = ydoc.getMap("aiSuggestions");

  // Set local awareness
  awareness.setLocalStateField("user", {
    name: userInfo.name || "Anonymous",
    color: userColor(userInfo.id),
    initials: (userInfo.name || "A").charAt(0).toUpperCase(),
    aiMode: "idle",
    aiVisible: false,
  });

  // Connection state machine
  let connectionState = "connecting";
  let offlineTimer = null;
  const listeners = new Set();

  function notifyListeners() {
    listeners.forEach((fn) => fn(connectionState));
  }

  provider.on("status", ({ status }) => {
    if (status === "connected") {
      clearTimeout(offlineTimer);
      offlineTimer = null;
      connectionState = "connected";
      notifyListeners();
    }
  });

  provider.on("connection-close", () => {
    if (connectionState === "connected") {
      connectionState = "reconnecting";
      notifyListeners();

      offlineTimer = setTimeout(() => {
        connectionState = "disconnected";
        notifyListeners();
      }, OFFLINE_GRACE_MS);
    }
  });

  // Build ProseMirror plugins
  const prosemirrorPlugins = [
    ySyncPlugin(xmlFragment),
    yCursorPlugin(awareness),
    yUndoPlugin(),
  ];

  return {
    ydoc,
    provider,
    awareness,
    xmlFragment,
    aiSuggestions,
    prosemirrorPlugins,

    get connectionState() {
      return connectionState;
    },

    onConnectionChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    destroy() {
      clearTimeout(offlineTimer);
      awareness.destroy();
      provider.disconnect();
      ydoc.destroy();
      listeners.clear();
    },
  };
}
