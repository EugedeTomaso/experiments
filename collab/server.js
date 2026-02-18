import http from "http";
import { WebSocketServer } from "ws";
import { verifyToken, checkNodeAccess } from "./auth.js";

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
  const roomName = url.pathname.slice(1); // "node:123"
  const token = url.searchParams.get("token");

  // Parse room name
  const match = roomName.match(/^node:(\d+)$/);
  if (!match) {
    ws.close(4400, "Invalid room name");
    return;
  }
  const nodeId = parseInt(match[1], 10);

  // Verify JWT
  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4401, "Invalid token");
    return;
  }

  // Check access
  const { allowed, role } = await checkNodeAccess(nodeId, payload.user_id);
  if (!allowed) {
    ws.close(4403, "Access denied");
    return;
  }

  const readOnly = role === "viewer" || role === "commenter";

  console.log(
    `[room node:${nodeId}] user ${payload.user_id} connected (role: ${role}, readOnly: ${readOnly})`
  );

  // TODO: Task 4 will add Yjs room management here
  // For now, just keep the connection alive
  ws.on("close", () => {
    console.log(`[room node:${nodeId}] user ${payload.user_id} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`Collab server listening on port ${PORT}`);
});
