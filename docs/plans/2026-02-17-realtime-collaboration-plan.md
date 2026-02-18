# Real-Time Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time collaborative editing using Yjs with Figma-style cursors, dual persistence, and configurable AI suggestions.

**Architecture:** A Node.js y-websocket server handles real-time document sync via Yjs CRDTs. Django exposes internal APIs for auth, persistence, and Yjs state storage. The frontend integrates y-prosemirror into Milkdown, replacing the history plugin with collaborative undo and the REST autosave with WebSocket-based persistence.

**Tech Stack:** Yjs 13.6, y-prosemirror 1.2, y-websocket 2.0, Node.js 20, Milkdown 7.6.3, Django 5.2, PostgreSQL 16

**Design doc:** `docs/plans/2026-02-17-realtime-collaboration-design.md`

---

## Task 1: YjsState Django Model

**Files:**
- Modify: `backend/core/models.py:296` (append after PublishRecord)
- Create: `backend/core/migrations/0015_yjsstate.py` (auto-generated)
- Test: `backend/core/tests/test_yjs_models.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_yjs_models.py`:

```python
from django.test import TestCase
from core.models import Node, Project, Workspace, YjsState


class YjsStateTest(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        self.user = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.workspace = Workspace.objects.create(name="Test")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.user
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc"
        )

    def test_create_yjs_state(self):
        state_bytes = b"\x01\x02\x03\x04"
        yjs = YjsState.objects.create(node=self.node, state=state_bytes)
        yjs.refresh_from_db()
        self.assertEqual(bytes(yjs.state), state_bytes)

    def test_one_to_one_constraint(self):
        YjsState.objects.create(node=self.node, state=b"\x01")
        with self.assertRaises(Exception):
            YjsState.objects.create(node=self.node, state=b"\x02")

    def test_cascade_delete_with_node(self):
        YjsState.objects.create(node=self.node, state=b"\x01")
        self.node.delete()
        self.assertEqual(YjsState.objects.count(), 0)

    def test_update_state(self):
        yjs = YjsState.objects.create(node=self.node, state=b"\x01")
        yjs.state = b"\x05\x06"
        yjs.save()
        yjs.refresh_from_db()
        self.assertEqual(bytes(yjs.state), b"\x05\x06")
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_yjs_models -v2`
Expected: ImportError — `YjsState` does not exist.

**Step 3: Add the YjsState model**

Append to `backend/core/models.py` after the PublishRecord class:

```python
class YjsState(models.Model):
    node = models.OneToOneField(Node, related_name="yjs_state", on_delete=models.CASCADE)
    state = models.BinaryField()
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"YjsState for {self.node.title}"
```

**Step 4: Generate and run migration**

Run: `docker exec experiments-backend-1 python manage.py makemigrations core --name yjsstate`
Then: `docker exec experiments-backend-1 python manage.py migrate`

**Step 5: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_yjs_models -v2`
Expected: 4 tests PASS.

**Step 6: Commit**

```bash
git add backend/core/models.py backend/core/migrations/0015_*.py backend/core/tests/test_yjs_models.py
git commit -m "feat: add YjsState model for Yjs binary state persistence"
```

---

## Task 2: Internal Django API for Collab Server

**Files:**
- Create: `backend/core/internal_views.py`
- Modify: `backend/core/urls.py:92` (add internal routes)
- Modify: `backend/server/settings.py` (add INTERNAL_API_KEY setting)
- Test: `backend/core/tests/test_internal_api.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_internal_api.py`:

```python
import base64
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from core.models import Node, Project, ProjectMembership, Workspace, YjsState


@override_settings(INTERNAL_API_KEY="test-secret-key")
class InternalNodeAccessTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.editor = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.outsider = User.objects.create_user("carol", "carol@test.com", "pass1234")

        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc", content_md="# Hello"
        )
        ProjectMembership.objects.create(
            project=self.project, user=self.editor, role="editor",
            invited_by=self.owner, invited_email="bob@test.com", accepted=True,
        )
        self.client = APIClient()
        self.headers = {"HTTP_X_INTERNAL_KEY": "test-secret-key"}

    def test_no_key_returns_403(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.owner.id}"
        )
        self.assertEqual(response.status_code, 403)

    def test_owner_access(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.owner.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["allowed"])
        self.assertEqual(response.data["role"], "owner")

    def test_editor_access(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.editor.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["allowed"])
        self.assertEqual(response.data["role"], "editor")

    def test_outsider_denied(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.outsider.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["allowed"])


@override_settings(INTERNAL_API_KEY="test-secret-key")
class InternalYjsStateTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc", content_md="# Hello"
        )
        self.client = APIClient()
        self.headers = {"HTTP_X_INTERNAL_KEY": "test-secret-key"}

    def test_get_yjs_state_not_found(self):
        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/yjs-state/", **self.headers
        )
        self.assertEqual(response.status_code, 404)

    def test_save_and_get_yjs_state(self):
        state_b64 = base64.b64encode(b"\x01\x02\x03").decode()
        response = self.client.patch(
            f"/api/internal/nodes/{self.node.id}/yjs-state/",
            {"state": state_b64},
            format="json",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/yjs-state/", **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["state"], state_b64)

    def test_update_content(self):
        response = self.client.patch(
            f"/api/internal/nodes/{self.node.id}/content/",
            {"content_md": "# Updated"},
            format="json",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.node.refresh_from_db()
        self.assertEqual(self.node.content_md, "# Updated")

    def test_get_node_content(self):
        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/", **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["content_md"], "# Hello")
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_internal_api -v2`
Expected: 404 — routes don't exist.

**Step 3: Add INTERNAL_API_KEY setting**

In `backend/server/settings.py`, append at the end:

```python
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev-internal-key")
```

**Step 4: Create internal_views.py**

Create `backend/core/internal_views.py`:

```python
import base64

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Node, YjsState
from .permissions import get_user_role


class InternalAPIMixin:
    """Mixin that checks X-Internal-Key header instead of JWT auth."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def check_internal_key(self, request):
        key = request.META.get("HTTP_X_INTERNAL_KEY", "")
        if key != settings.INTERNAL_API_KEY:
            return False
        return True


class NodeAccessView(InternalAPIMixin, APIView):
    """GET /api/internal/node-access/{node_id}/?user_id={id}"""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response(
                {"detail": "user_id required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node = Node.objects.select_related("project__owner").get(id=node_id)
        except Node.DoesNotExist:
            return Response({"allowed": False, "role": None})

        from django.contrib.auth.models import User
        try:
            user = User.objects.get(id=int(user_id))
        except User.DoesNotExist:
            return Response({"allowed": False, "role": None})

        role = get_user_role(user, node.project)
        return Response({"allowed": role is not None, "role": role})


class InternalNodeDetailView(InternalAPIMixin, APIView):
    """GET /api/internal/nodes/{node_id}/ — returns node data for collab server."""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response({
            "id": node.id,
            "title": node.title,
            "content_md": node.content_md,
            "project_id": node.project_id,
        })


class YjsStateView(InternalAPIMixin, APIView):
    """GET/PATCH /api/internal/nodes/{node_id}/yjs-state/"""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            yjs = YjsState.objects.get(node_id=node_id)
        except YjsState.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response({
            "state": base64.b64encode(bytes(yjs.state)).decode(),
            "updated_at": yjs.updated_at,
        })

    def patch(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        state_b64 = request.data.get("state")
        if not state_b64:
            return Response(
                {"detail": "state required"}, status=status.HTTP_400_BAD_REQUEST
            )

        state_bytes = base64.b64decode(state_b64)
        yjs, _ = YjsState.objects.update_or_create(
            node_id=node_id,
            defaults={"state": state_bytes},
        )
        return Response({"status": "ok"})


class InternalNodeContentView(InternalAPIMixin, APIView):
    """PATCH /api/internal/nodes/{node_id}/content/ — update content_md from collab server."""

    def patch(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        content_md = request.data.get("content_md")
        if content_md is None:
            return Response(
                {"detail": "content_md required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        node.content_md = content_md
        node.save(update_fields=["content_md", "updated_at"])
        return Response({"status": "ok"})
```

**Step 5: Add URL routes**

In `backend/core/urls.py`, add imports and paths:

```python
from .internal_views import (
    InternalNodeContentView,
    InternalNodeDetailView,
    NodeAccessView,
    YjsStateView,
)

# Add to urlpatterns:
    # Internal (collab server)
    path("api/internal/node-access/<int:node_id>/", NodeAccessView.as_view(), name="internal-node-access"),
    path("api/internal/nodes/<int:node_id>/", InternalNodeDetailView.as_view(), name="internal-node-detail"),
    path("api/internal/nodes/<int:node_id>/yjs-state/", YjsStateView.as_view(), name="internal-yjs-state"),
    path("api/internal/nodes/<int:node_id>/content/", InternalNodeContentView.as_view(), name="internal-node-content"),
```

**Step 6: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_internal_api -v2`
Expected: All 7 tests PASS.

**Step 7: Commit**

```bash
git add backend/core/internal_views.py backend/core/urls.py backend/server/settings.py backend/core/tests/test_internal_api.py
git commit -m "feat: add internal Django API for collab server (node-access, yjs-state, content)"
```

---

## Task 3: Collab Server — Scaffolding, Auth, Package Setup

**Files:**
- Create: `collab/package.json`
- Create: `collab/Dockerfile`
- Create: `collab/auth.js`
- Create: `collab/server.js` (minimal — just auth + WS accept)
- Modify: `docker-compose.yml:44` (add collab service)

**Step 1: Create collab directory and package.json**

Create `collab/package.json`:

```json
{
  "name": "jakarta-collab",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "ws": "^8.16.0",
    "yjs": "^13.6.0",
    "y-protocols": "^1.0.6",
    "lib0": "^0.2.88"
  }
}
```

**Step 2: Create auth.js**

Create `collab/auth.js`:

```javascript
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
```

**Step 3: Create minimal server.js**

Create `collab/server.js`:

```javascript
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
```

**Step 4: Create Dockerfile**

Create `collab/Dockerfile`:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 4444
CMD ["npm", "start"]
```

**Step 5: Update docker-compose.yml**

Add the collab service after the frontend service in `docker-compose.yml`:

```yaml
  collab:
    build: ./collab
    environment:
      JWT_SECRET: ${JWT_SECRET:-dev-insecure-secret-key-change-me}
      DJANGO_API_URL: http://backend:8000
      INTERNAL_API_KEY: ${INTERNAL_API_KEY:-dev-internal-key}
      PORT: 4444
    ports:
      - "4444:4444"
    depends_on:
      - backend
```

Note: `JWT_SECRET` must match Django's `SECRET_KEY` (used by SimpleJWT for HS256).

**Step 6: Build and test**

Run: `docker compose build collab`
Then: `docker compose up collab -d`
Then: `curl http://localhost:4444/health` → should return `ok`

**Step 7: Commit**

```bash
git add collab/ docker-compose.yml
git commit -m "feat: scaffold collab server with JWT auth and Django API integration"
```

---

## Task 4: Collab Server — Yjs Room Management + Persistence

**Files:**
- Create: `collab/rooms.js`
- Create: `collab/persistence.js`
- Modify: `collab/server.js` (wire room management into WS handler)

**Step 1: Create rooms.js — room lifecycle manager**

Create `collab/rooms.js`:

```javascript
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
  const conns = new Map(); // ws → { readOnly, userId }

  const room = { nodeId, ydoc, awareness, persistence, conns, _destroyTimer: null, _initialized: false, _initPromise: null };

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
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder, encoder, room.ydoc, conn
      );

      // If this is a sync step 2 or update from a read-only client, ignore writes
      if (conn.readOnly && syncMessageType === syncProtocol.messageYjsUpdate) {
        return; // drop the update
      }

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

// Listen for doc updates and broadcast to all connected clients
function setupBroadcast(room) {
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
```

**Step 2: Create persistence.js — dual persistence**

Create `collab/persistence.js`:

```javascript
import * as Y from "yjs";
import { getYjsState, saveYjsState, saveNodeContent, getNodeContent } from "./auth.js";

const BINARY_DEBOUNCE_MS = 5_000;   // 5s for binary state
const MARKDOWN_DEBOUNCE_MS = 30_000; // 30s for markdown conversion

export function createPersistence(nodeId, ydoc) {
  let binaryTimer = null;
  let markdownTimer = null;
  let destroyed = false;

  function scheduleBinarySave() {
    if (destroyed) return;
    clearTimeout(binaryTimer);
    binaryTimer = setTimeout(async () => {
      if (destroyed) return;
      const state = Y.encodeStateAsUpdate(ydoc);
      await saveYjsState(nodeId, Buffer.from(state)).catch((err) => {
        console.error(`[persistence node:${nodeId}] binary save failed:`, err.message);
      });
    }, BINARY_DEBOUNCE_MS);
  }

  function scheduleMarkdownSave() {
    if (destroyed) return;
    clearTimeout(markdownTimer);
    markdownTimer = setTimeout(async () => {
      if (destroyed) return;
      // TODO: Task 5 will add schema.js for Yjs → ProseMirror → Markdown conversion
      // For now, skip markdown persistence (binary state is sufficient for MVP)
      console.log(`[persistence node:${nodeId}] markdown save placeholder`);
    }, MARKDOWN_DEBOUNCE_MS);
  }

  // Listen for changes
  ydoc.on("update", () => {
    scheduleBinarySave();
    scheduleMarkdownSave();
  });

  return {
    async load() {
      // Try binary state first
      const binaryState = await getYjsState(nodeId);
      if (binaryState) {
        Y.applyUpdate(ydoc, new Uint8Array(binaryState));
        console.log(`[persistence node:${nodeId}] loaded from binary state`);
        return;
      }

      // Fall back to markdown
      const nodeData = await getNodeContent(nodeId);
      if (nodeData && nodeData.content_md) {
        // TODO: Task 5 will add markdown → Yjs conversion via schema.js
        // For now, store raw markdown in a Y.Text as placeholder
        const ytext = ydoc.getText("raw-markdown");
        ytext.insert(0, nodeData.content_md);
        console.log(`[persistence node:${nodeId}] loaded from markdown (placeholder)`);
      }
    },

    async flush() {
      clearTimeout(binaryTimer);
      clearTimeout(markdownTimer);
      const state = Y.encodeStateAsUpdate(ydoc);
      await saveYjsState(nodeId, Buffer.from(state)).catch((err) => {
        console.error(`[persistence node:${nodeId}] flush binary failed:`, err.message);
      });
      // TODO: flush markdown too once schema.js is ready
    },

    destroy() {
      destroyed = true;
      clearTimeout(binaryTimer);
      clearTimeout(markdownTimer);
    },
  };
}
```

**Step 3: Update server.js to use room management**

Replace the TODO section in `collab/server.js`:

```javascript
import http from "http";
import { WebSocketServer } from "ws";
import { verifyToken, checkNodeAccess } from "./auth.js";
import { getOrCreateRoom, initRoom, addConn, removeConn, handleMessage } from "./rooms.js";

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
```

**Step 4: Test**

Rebuild: `docker compose build collab && docker compose up collab -d`
Check logs: `docker compose logs collab`
Expected: "Collab server listening on port 4444"

**Step 5: Commit**

```bash
git add collab/rooms.js collab/persistence.js collab/server.js
git commit -m "feat: add Yjs room management with dual persistence and read-only enforcement"
```

---

## Task 5: Collab Server — Schema (Milkdown Headless for Markdown ↔ Yjs)

**Files:**
- Create: `collab/schema.js`
- Modify: `collab/package.json` (add Milkdown dependencies)
- Modify: `collab/persistence.js` (replace placeholders with real conversion)

**Step 1: Add Milkdown dependencies**

Update `collab/package.json` dependencies:

```json
{
  "@milkdown/core": "^7.6.3",
  "@milkdown/preset-commonmark": "^7.6.3",
  "@milkdown/preset-gfm": "^7.6.3",
  "@milkdown/transformer": "^7.6.3",
  "prosemirror-model": "^1.19.0"
}
```

Run: `cd collab && npm install`

**Step 2: Create schema.js**

Create `collab/schema.js`:

```javascript
import { Editor } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { schemaCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { Node as ProseMirrorNode } from "prosemirror-model";
import * as Y from "yjs";
import { yXmlFragmentToProseMirrorRootNode, prosemirrorToYXmlFragment } from "y-prosemirror";

let _schema = null;
let _parser = null;
let _serializer = null;

async function ensureInitialized() {
  if (_schema) return;

  // Create a headless Milkdown editor just to extract the schema and parser/serializer
  const editor = Editor.make().use(commonmark).use(gfm);
  await editor.create();

  const ctx = editor.ctx;
  _schema = ctx.get(schemaCtx);
  _parser = ctx.get(parserCtx);
  _serializer = ctx.get(serializerCtx);

  // We don't need the editor anymore, but keep schema/parser/serializer
  await editor.destroy();
}

/**
 * Parse markdown string into a ProseMirror document node.
 */
export async function markdownToProseMirrorDoc(markdown) {
  await ensureInitialized();
  return _parser(markdown);
}

/**
 * Serialize a ProseMirror document node to markdown string.
 */
export async function proseMirrorDocToMarkdown(doc) {
  await ensureInitialized();
  return _serializer(doc);
}

/**
 * Initialize a Y.XmlFragment from a markdown string.
 * Call this when creating a new room from DB content.
 */
export async function markdownToYXmlFragment(ydoc, fragmentName, markdown) {
  await ensureInitialized();
  const doc = _parser(markdown);
  const fragment = ydoc.getXmlFragment(fragmentName);

  // Convert ProseMirror doc to Y.XmlFragment
  ydoc.transact(() => {
    prosemirrorToYXmlFragment(doc, fragment);
  });

  return fragment;
}

/**
 * Convert a Y.XmlFragment back to markdown.
 * Call this when persisting to the DB.
 */
export async function yXmlFragmentToMarkdown(ydoc, fragmentName) {
  await ensureInitialized();
  const fragment = ydoc.getXmlFragment(fragmentName);
  const doc = yXmlFragmentToProseMirrorRootNode(fragment, _schema);
  return _serializer(doc);
}

export { _schema as schema };
```

Note: The exact Milkdown headless API may need adjustment during implementation. The key methods (`schemaCtx`, `parserCtx`, `serializerCtx`) are the standard Milkdown context keys. If Milkdown's headless mode requires a DOM stub (like `jsdom`), add it to the collab server dependencies.

**Step 3: Update persistence.js — replace placeholders**

In `collab/persistence.js`, replace the placeholder `load()` and markdown save:

```javascript
import { markdownToYXmlFragment, yXmlFragmentToMarkdown } from "./schema.js";

// In load():
// Replace the "Fall back to markdown" section:
const nodeData = await getNodeContent(nodeId);
if (nodeData && nodeData.content_md) {
  await markdownToYXmlFragment(ydoc, "prosemirror", nodeData.content_md);
  console.log(`[persistence node:${nodeId}] loaded from markdown → Yjs`);
}

// In scheduleMarkdownSave():
// Replace the placeholder:
const markdown = await yXmlFragmentToMarkdown(ydoc, "prosemirror");
await saveNodeContent(nodeId, markdown).catch((err) => {
  console.error(`[persistence node:${nodeId}] markdown save failed:`, err.message);
});

// In flush():
// Add markdown flush:
const markdown = await yXmlFragmentToMarkdown(ydoc, "prosemirror");
await saveNodeContent(nodeId, markdown).catch((err) => {
  console.error(`[persistence node:${nodeId}] flush markdown failed:`, err.message);
});
```

**Step 4: Test**

Rebuild: `docker compose build collab && docker compose up collab -d`
Verify: `docker compose logs collab` — no import errors.

**Step 5: Commit**

```bash
git add collab/schema.js collab/package.json collab/package-lock.json collab/persistence.js
git commit -m "feat: add Milkdown headless schema for markdown ↔ Yjs conversion"
```

---

## Task 6: Frontend — Install Yjs Dependencies + collabPlugin.js

**Files:**
- Modify: `frontend/package.json` (add yjs, y-prosemirror, y-websocket)
- Create: `frontend/src/collabPlugin.js`

**Step 1: Install dependencies**

Run: `cd frontend && npm install yjs y-prosemirror y-websocket`

**Step 2: Create collabPlugin.js**

Create `frontend/src/collabPlugin.js`:

```javascript
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
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/collabPlugin.js
git commit -m "feat: add collabPlugin.js with Yjs session management and connection state machine"
```

---

## Task 7: Frontend — Integrate Yjs into MarkdownEditor

**Files:**
- Modify: `frontend/src/MarkdownEditor.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Update MarkdownEditor to accept collabSession**

In `frontend/src/MarkdownEditor.jsx`, update the editor initialization to conditionally use Yjs plugins or history:

- Add `collabSession` prop
- When `collabSession` is truthy:
  - Do NOT set `defaultValueCtx` (content comes from Yjs)
  - Do NOT use `history` plugin
  - Instead, use `$prose(() => collabSession.prosemirrorPlugins[0])` etc. to inject Yjs plugins
  - The `$prose` wrapper from `@milkdown/kit/utils` creates Milkdown-compatible plugins from raw ProseMirror plugins
- When `collabSession` is falsy: unchanged behavior (history + defaultValueCtx)

Key code change in `useEditor`:

```javascript
const editor = Editor.make()
  .config((ctx) => {
    ctx.set(rootCtx, root);
    if (!collabSession) {
      ctx.set(defaultValueCtx, value || "");
    }
    // ... rest of config
  })
  .config(nord)
  .use(commonmark)
  .use(gfm);

if (collabSession) {
  // Inject each Yjs ProseMirror plugin via $prose wrapper
  for (const plugin of collabSession.prosemirrorPlugins) {
    editor.use($prose(() => plugin));
  }
} else {
  editor.use(history);
}

editor
  .use(listener)
  .use(slash)
  // ... rest of plugins
```

Re-create the editor when `docId` or `!!collabSession` changes by including both in the dependency array.

**Step 2: Update App.jsx to manage collabSession**

In `frontend/src/App.jsx`:

- Add state: `const [collabSession, setCollabSession] = useState(null)`
- Add state: `const [connectionStatus, setConnectionStatus] = useState("disconnected")`
- On activeNodeId change:
  - Destroy previous session
  - Create new session via `createCollabSession(activeNodeId, accessToken, { name: user.name, id: user.id })`
  - Subscribe to connection changes
- Skip autosave when `collabSession` is active (the collab server handles persistence)
- Pass `collabSession` to `<MarkdownEditor>`
- Pass `connectionStatus` for UI indicators

**Step 3: Manual test**

Open two browser tabs to the same document. Type in one — verify it appears in the other.

**Step 4: Commit**

```bash
git add frontend/src/MarkdownEditor.jsx frontend/src/App.jsx
git commit -m "feat: integrate Yjs into MarkdownEditor with collab/single-user mode switching"
```

---

## Task 8: Frontend — Cursor and Selection Styling

**Files:**
- Modify: `frontend/src/index.css` (add cursor and selection styles)

**Step 1: Add y-prosemirror cursor styles**

`y-prosemirror` renders cursor and selection decorations with specific class names. Add to `frontend/src/index.css`:

```css
/* Remote cursor — colored line */
.yRemoteSelection {
  opacity: 0.3;
}

/* Remote cursor caret — vertical line */
.yRemoteSelectionHead {
  position: absolute;
  border-left: 2px solid;
  border-color: inherit;
  height: 1.4em;
  margin-left: -1px;
}

/* Cursor label — username above caret */
.yRemoteSelectionHead::after {
  content: attr(data-client-name);
  position: absolute;
  top: -1.4em;
  left: -1px;
  padding: 1px 4px;
  border-radius: 3px 3px 3px 0;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  color: white;
  background-color: inherit;
  opacity: 1;
  transition: opacity 0.3s;
}
```

**Step 2: Test with two tabs**

Open same doc in two browser tabs. Select text in one — verify colored highlight in other. Move cursor — verify colored caret with name label.

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add y-prosemirror cursor and selection styles"
```

---

## Task 9: Frontend — Margin Avatar Plugin

**Files:**
- Create: `frontend/src/marginAvatarPlugin.js`
- Modify: `frontend/src/MarkdownEditor.jsx` (add plugin when collab active)
- Modify: `frontend/src/index.css` (margin avatar styles)

**Step 1: Create marginAvatarPlugin.js**

A ProseMirror plugin (via `$prose`) that:
- Gets the awareness instance from the collab session
- On each `view.update`, iterates remote users with cursor positions
- Resolves positions to DOM coordinates via `view.coordsAtPos()`
- Renders/updates positioned avatar circles in a container alongside the editor

```javascript
import { Plugin } from "prosemirror-state";
import { $prose } from "@milkdown/kit/utils";

export function createMarginAvatarPlugin(awareness) {
  let container = null;

  return $prose(() => new Plugin({
    view(editorView) {
      container = document.createElement("div");
      container.className = "margin-avatar-container";
      editorView.dom.parentElement.style.position = "relative";
      editorView.dom.parentElement.appendChild(container);

      function updateAvatars() {
        if (!container) return;
        container.innerHTML = "";

        const states = awareness.getStates();
        const localId = awareness.clientID;

        states.forEach((state, clientId) => {
          if (clientId === localId) return;
          if (!state.user || !state.cursor) return;

          const { anchor } = state.cursor;
          if (anchor == null) return;

          try {
            const coords = editorView.coordsAtPos(anchor);
            const editorRect = editorView.dom.getBoundingClientRect();
            const top = coords.top - editorRect.top;

            const avatar = document.createElement("div");
            avatar.className = "margin-avatar";
            avatar.style.backgroundColor = state.user.color;
            avatar.style.top = `${top}px`;
            avatar.textContent = state.user.initials;
            avatar.title = state.user.name;
            container.appendChild(avatar);
          } catch {
            // Position may be invalid
          }
        });
      }

      awareness.on("change", updateAvatars);

      return {
        update: updateAvatars,
        destroy() {
          awareness.off("change", updateAvatars);
          container?.remove();
          container = null;
        },
      };
    },
  }));
}
```

**Step 2: Add styles**

Append to `frontend/src/index.css`:

```css
.margin-avatar-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.margin-avatar {
  position: absolute;
  left: -36px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: white;
  transition: top 150ms ease;
  pointer-events: auto;
  cursor: default;
}
```

**Step 3: Wire into MarkdownEditor**

In the collab branch of `useEditor`, add the margin avatar plugin after the Yjs plugins:

```javascript
if (collabSession) {
  // ... Yjs plugins ...
  editor.use(createMarginAvatarPlugin(collabSession.awareness));
}
```

**Step 4: Commit**

```bash
git add frontend/src/marginAvatarPlugin.js frontend/src/MarkdownEditor.jsx frontend/src/index.css
git commit -m "feat: add Figma-style margin avatar plugin for remote cursors"
```

---

## Task 10: Frontend — PresenceIndicator + ConnectionBanner

**Files:**
- Create: `frontend/src/components/PresenceIndicator.jsx`
- Create: `frontend/src/components/ConnectionBanner.jsx`
- Modify: `frontend/src/App.jsx` (wire both components)
- Modify: `frontend/src/index.css` (styles)

**Step 1: Create PresenceIndicator.jsx**

```jsx
import { useState, useEffect } from "react";

const MAX_VISIBLE = 3;

export default function PresenceIndicator({ awareness }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    function update() {
      const states = awareness.getStates();
      const localId = awareness.clientID;
      const remote = [];
      states.forEach((state, clientId) => {
        if (clientId !== localId && state.user) {
          remote.push(state.user);
        }
      });
      setUsers(remote);
    }

    awareness.on("change", update);
    update();
    return () => awareness.off("change", update);
  }, [awareness]);

  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="presence-indicator">
      {visible.map((u, i) => (
        <div
          key={i}
          className="presence-avatar"
          style={{ backgroundColor: u.color, zIndex: MAX_VISIBLE - i }}
          title={u.name}
        >
          {u.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div className="presence-overflow" title={users.slice(MAX_VISIBLE).map(u => u.name).join(", ")}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create ConnectionBanner.jsx**

```jsx
import { useState, useEffect } from "react";

export default function ConnectionBanner({ connectionState, onRetry }) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (connectionState !== "reconnecting") {
      setCountdown(60);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionState]);

  if (connectionState === "connected" || connectionState === "connecting") {
    return null;
  }

  const isReconnecting = connectionState === "reconnecting";

  return (
    <div className={`connection-banner ${isReconnecting ? "warning" : "error"}`}>
      <span>
        {isReconnecting
          ? `Reconectando... edición disponible por ${countdown}s más`
          : "Sin conexión — reintentando automáticamente"}
      </span>
      <button className="connection-retry-btn" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
```

**Step 3: Add styles**

Append to `frontend/src/index.css`:

```css
/* Presence indicator */
.presence-indicator {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.presence-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: white;
  margin-left: -6px;
  border: 2px solid var(--surface-1, white);
  cursor: default;
}

.presence-avatar:first-child {
  margin-left: 0;
}

.presence-overflow {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--surface-inset);
  margin-left: -6px;
  border: 2px solid var(--surface-1, white);
}

/* Connection banner */
.connection-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 16px;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.connection-banner.warning {
  background: #fef3cd;
  color: #856404;
}

.connection-banner.error {
  background: #f8d7da;
  color: #721c24;
}

.connection-retry-btn {
  padding: 2px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
```

**Step 4: Wire into App.jsx topbar and editor area**

- Render `<PresenceIndicator awareness={collabSession?.awareness} />` in the topbar, next to the Share button
- Render `<ConnectionBanner connectionState={connectionStatus} onRetry={() => collabSession?.provider.connect()} />` above the editor

**Step 5: Commit**

```bash
git add frontend/src/components/PresenceIndicator.jsx frontend/src/components/ConnectionBanner.jsx frontend/src/App.jsx frontend/src/index.css
git commit -m "feat: add PresenceIndicator topbar component and ConnectionBanner for offline state"
```

---

## Task 11: AI Configurable Mode — Awareness + Y.Map Integration

**Files:**
- Modify: `frontend/src/collabPlugin.js` (expose aiSuggestions map helpers)
- Modify: `frontend/src/MarkdownEditor.jsx` (observe aiSuggestions Y.Map)
- Modify: `frontend/src/components/SettingsModal.jsx` (add toggle)
- Create: `frontend/src/components/AiSuggestionBanner.jsx`

**Step 1: Add AI helper methods to collabPlugin.js**

Add to the `createCollabSession` return object:

```javascript
publishAiSuggestion(userId, oldMarkdown, newMarkdown) {
  aiSuggestions.set(String(userId), {
    status: "done",
    oldMarkdown,
    newMarkdown,
    timestamp: Date.now(),
  });
},

clearAiSuggestion(userId) {
  aiSuggestions.delete(String(userId));
},

setAiMode(mode) {
  awareness.setLocalStateField("user", {
    ...awareness.getLocalState()?.user,
    aiMode: mode,
  });
},

setAiVisible(visible) {
  awareness.setLocalStateField("user", {
    ...awareness.getLocalState()?.user,
    aiVisible: visible,
  });
},
```

**Step 2: Create AiSuggestionBanner.jsx**

A component that observes the Y.Map and shows banners when other users share AI suggestions:

```jsx
import { useState, useEffect } from "react";

export default function AiSuggestionBanner({ aiSuggestions, currentUserId, onViewDiff, onAccept, onReject }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!aiSuggestions) return;

    function update() {
      const items = [];
      aiSuggestions.forEach((value, key) => {
        if (key !== String(currentUserId) && value.status === "done") {
          items.push({ userId: key, ...value });
        }
      });
      setSuggestions(items);
    }

    aiSuggestions.observe(update);
    update();
    return () => aiSuggestions.unobserve(update);
  }, [aiSuggestions, currentUserId]);

  if (suggestions.length === 0) return null;

  return (
    <div className="ai-suggestion-banners">
      {suggestions.map((s) => (
        <div key={s.userId} className="ai-suggestion-banner">
          <span>Un colaborador sugiere cambios via IA</span>
          <button onClick={() => onViewDiff(s)}>Ver diff</button>
          <button onClick={() => onAccept(s)}>Aceptar</button>
          <button onClick={() => onReject(s)}>Rechazar</button>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Add "Share AI suggestions" toggle to SettingsModal**

In `frontend/src/components/SettingsModal.jsx`, add a toggle that reads/writes `localStorage.getItem("marvin:ai-visible")` and calls `collabSession.setAiVisible(value)`.

**Step 4: Wire AI flow in App.jsx**

When the user triggers AI review and `aiVisible` is true:
1. Call `collabSession.publishAiSuggestion(userId, oldMarkdown, newMarkdown)`
2. Other clients see the banner via `AiSuggestionBanner`
3. Accept: apply markdown, call `collabSession.clearAiSuggestion(userId)`
4. Reject: call `collabSession.clearAiSuggestion(userId)`

When `aiVisible` is false: unchanged behavior (local decorations only).

**Step 5: Commit**

```bash
git add frontend/src/collabPlugin.js frontend/src/MarkdownEditor.jsx frontend/src/components/AiSuggestionBanner.jsx frontend/src/components/SettingsModal.jsx frontend/src/App.jsx
git commit -m "feat: add configurable AI suggestions mode with Y.Map sync"
```

---

## File Index

| File | Status | Tasks |
|------|--------|-------|
| `backend/core/models.py` | Modify | 1 |
| `backend/core/internal_views.py` | Create | 2 |
| `backend/core/urls.py` | Modify | 2 |
| `backend/server/settings.py` | Modify | 2 |
| `backend/core/tests/test_yjs_models.py` | Create | 1 |
| `backend/core/tests/test_internal_api.py` | Create | 2 |
| `collab/package.json` | Create | 3, 5 |
| `collab/Dockerfile` | Create | 3 |
| `collab/auth.js` | Create | 3 |
| `collab/server.js` | Create | 3, 4 |
| `collab/rooms.js` | Create | 4 |
| `collab/persistence.js` | Create | 4, 5 |
| `collab/schema.js` | Create | 5 |
| `docker-compose.yml` | Modify | 3 |
| `frontend/package.json` | Modify | 6 |
| `frontend/src/collabPlugin.js` | Create | 6, 11 |
| `frontend/src/MarkdownEditor.jsx` | Modify | 7, 9 |
| `frontend/src/App.jsx` | Modify | 7, 10, 11 |
| `frontend/src/index.css` | Modify | 8, 9, 10 |
| `frontend/src/marginAvatarPlugin.js` | Create | 9 |
| `frontend/src/components/PresenceIndicator.jsx` | Create | 10 |
| `frontend/src/components/ConnectionBanner.jsx` | Create | 10 |
| `frontend/src/components/AiSuggestionBanner.jsx` | Create | 11 |
| `frontend/src/components/SettingsModal.jsx` | Modify | 11 |
