import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const DJANGO_API_URL = process.env.DJANGO_API_URL || "http://backend:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "dev-internal-key";

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

export async function checkNodeAccess(nodeId, userId) {
  const url = `${DJANGO_API_URL}/api/internal/node-access/${nodeId}/?user_id=${userId}`;
  const res = await fetch(url, {
    headers: { "X-Internal-Key": INTERNAL_API_KEY },
  });
  if (!res.ok) return { allowed: false, role: null };
  return res.json();
}

export async function getNodeContent(nodeId) {
  const url = `${DJANGO_API_URL}/api/internal/nodes/${nodeId}/`;
  const res = await fetch(url, {
    headers: { "X-Internal-Key": INTERNAL_API_KEY },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getYjsState(nodeId) {
  const url = `${DJANGO_API_URL}/api/internal/nodes/${nodeId}/yjs-state/`;
  const res = await fetch(url, {
    headers: { "X-Internal-Key": INTERNAL_API_KEY },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.state, "base64");
}

export async function saveYjsState(nodeId, stateBuffer) {
  const url = `${DJANGO_API_URL}/api/internal/nodes/${nodeId}/yjs-state/`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({ state: stateBuffer.toString("base64") }),
  });
}

export async function saveNodeContent(nodeId, contentMd) {
  const url = `${DJANGO_API_URL}/api/internal/nodes/${nodeId}/content/`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({ content_md: contentMd }),
  });
}
