# Real-Time Collaboration Design

## Overview

Add real-time collaborative editing to the Jakarta platform using Yjs (CRDT) with y-prosemirror bindings, a dedicated Node.js WebSocket server, and Figma-style presence with cursors and margin avatars.

**Depends on:** `2026-02-17-sharing-collaboration-design.md` (ownership, permissions, memberships)

## Key Decisions

| Aspect | Decision |
|--------|----------|
| Content loading | Always via Yjs — WS server loads markdown → Yjs doc, clients receive via sync |
| Persistence | Dual: Yjs binary state every 5s (fast), markdown every 30s (for versions/export) |
| Binary state storage | PostgreSQL, separate `YjsState` table |
| Schema sharing | Milkdown headless in collab server — guarantees 1:1 parity with frontend |
| AI + collab | Configurable per user: local (default) or visible to all collaborators |
| Cursors | Cursor + colored selection + avatar in margin (Figma-style) |
| Offline | Hybrid: edit offline for 60s grace period, then block editor until reconnection |

## Collab Server Architecture

### File structure

```
collab/
├── server.js          — HTTP + WebSocket, room management
├── persistence.js     — Dual persistence (binary 5s, markdown 30s)
├── auth.js            — JWT validation + role check via Django internal API
├── schema.js          — Milkdown headless for ProseMirror schema + markdown serialization
├── package.json
└── Dockerfile
```

### Dependencies

```json
{
  "yjs": "^13.6.0",
  "y-websocket": "^2.0.4",
  "y-protocols": "^1.0.6",
  "ws": "^8.16.0",
  "jsonwebtoken": "^9.0.2",
  "@milkdown/core": "^7.6.3",
  "@milkdown/preset-commonmark": "^7.6.3",
  "@milkdown/preset-gfm": "^7.6.3",
  "@milkdown/utils": "^7.6.3"
}
```

### Docker Compose

```yaml
collab:
  build: ./collab
  ports:
    - "4444:4444"
  environment:
    JWT_SECRET: ${JWT_SECRET}
    DJANGO_API_URL: http://backend:8000
    INTERNAL_API_KEY: ${INTERNAL_API_KEY}
    PORT: 4444
  depends_on:
    - backend
```

### Room lifecycle

1. **Client connects** → `ws://collab:4444/node:{nodeId}?token={jwt}`
2. **Auth**: `auth.js` validates JWT, calls `GET /api/internal/node-access/{nodeId}/?user_id={id}` → `{allowed, role}`
   - If `role < editor`: connection marked read-only (receives sync, cannot send updates)
3. **Room creation** (first client for this node):
   a. Try `GET /api/internal/nodes/{nodeId}/yjs-state/` → binary state
   b. If binary state exists: `Y.applyUpdate(ydoc, binaryState)` → restore doc
   c. If not: `GET /api/internal/nodes/{nodeId}/` → `content_md` → `schema.js` parses markdown → ProseMirror doc → initializes `Y.XmlFragment`
4. **Room exists**: normal Yjs sync (client receives current state)
5. **Persistence** (on every Yjs doc change):
   a. Debounce 5s → save binary state: `PATCH /api/internal/nodes/{nodeId}/yjs-state/` with `Y.encodeStateAsUpdate(ydoc)`
   b. Debounce 30s → convert + save markdown: `schema.js` converts `Y.XmlFragment` → ProseMirror doc → markdown → `PATCH /api/internal/nodes/{nodeId}/content/`
6. **Last client disconnects**:
   a. Flush: save binary state + markdown immediately
   b. Keep room in memory for 60s (grace period for reconnection)
   c. After 60s with no clients → destroy room, free memory

### Permission enforcement on WebSocket

| Role | Receive sync | Send updates | Awareness (see) | Awareness (publish) |
|------|-------------|-------------|-----------------|-------------------|
| Viewer | Y | N | Y | Y (cursor only) |
| Commenter | Y | N | Y | Y (cursor only) |
| Editor | Y | Y | Y | Y |
| Admin | Y | Y | Y | Y |
| Owner | Y | Y | Y | Y |

## Django Internal API

New endpoints, accessible only from Docker network (protected by `X-Internal-Key` header):

```
GET    /api/internal/node-access/{nodeId}/?user_id={id}  → {allowed: bool, role: str}
GET    /api/internal/nodes/{nodeId}/                       → {content_md, ...}
GET    /api/internal/nodes/{nodeId}/yjs-state/             → {state: base64} or 404
PATCH  /api/internal/nodes/{nodeId}/yjs-state/             → {state: base64}
PATCH  /api/internal/nodes/{nodeId}/content/               → {content_md: str}
```

### YjsState model (new)

```python
class YjsState(models.Model):
    node = models.OneToOneField(Node, related_name="yjs_state", on_delete=models.CASCADE)
    state = models.BinaryField()  # Y.encodeStateAsUpdate(ydoc)
    updated_at = models.DateTimeField(auto_now=True)
```

## Frontend Integration

### Plugin stack change

Current:
```
commonmark → gfm → history → listener → slash → selectionTooltip
→ commentDeco → aiText → linkPreview
```

Collaborative mode:
```
commonmark → gfm → ySyncPlugin → yCursorPlugin → yUndoPlugin
→ listener → slash → selectionTooltip → commentDeco → aiText → linkPreview
```

Changes:
- `history` replaced by `yUndoPlugin` (collaborative undo/redo)
- `ySyncPlugin` inserted right after schema plugins (before everything else)
- `yCursorPlugin` after sync (for remote cursor decorations)
- `listener` remains but no longer feeds REST autosave — only updates local UI state
- Autosave REST disabled when collabSession is active

### New dependencies

```
yjs ^13.6.0
y-prosemirror ^1.2.0
y-websocket ^2.0.4
```

### collabPlugin.js — public API

```javascript
export function createCollabSession(nodeId, jwt, userInfo) {
  return {
    ydoc,                    // Y.Doc instance
    provider,                // WebsocketProvider
    awareness,               // provider.awareness
    xmlFragment,             // ydoc.getXmlFragment('prosemirror')
    aiSuggestions,           // ydoc.getMap('aiSuggestions')
    prosemirrorPlugins: [    // injected into Milkdown
      ySyncPlugin(xmlFragment),
      yCursorPlugin(awareness),
      yUndoPlugin(),
    ],
    connectionState,         // reactive: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
    destroy(),               // cleanup
  }
}
```

### MarkdownEditor.jsx — mode switching

```jsx
// New prop: collabSession (null if no collab)
if (collabSession) {
  // Collaborative: Yjs plugins, NO history, NO defaultValueCtx
  editor.use(collabSyncPlugin(collabSession));
  editor.use(collabCursorPlugin(collabSession));
  editor.use(collabUndoPlugin(collabSession));
} else {
  // Single-user: history plugin, defaultValueCtx = markdown
  editor.use(history);
}
```

Editor re-created when `docId` or `!!collabSession` changes.

### App.jsx — orchestration

- New state: `collabSession`, `connectionStatus`
- On node select: destroy old session → `createCollabSession(nodeId, jwt, userInfo)`
- Autosave disabled when `collabSession` is truthy (collab server persists)
- `connectionStatus` passed to `ConnectionBanner`

## Cursors, Presence & Margin Avatars

### Awareness data per client

```javascript
awareness.setLocalStateField('user', {
  name: "Alice",
  color: "#4A90D9",        // from hash(userId), 12-color palette
  initials: "A",
  aiMode: "idle",          // "idle" | "reviewing" | "streaming"
  aiVisible: false,        // whether AI suggestions are shared
})
```

### Three presence layers

**Layer 1: Cursor in text** (built-in via `yCursorPlugin`)
- Colored vertical line at cursor position
- Username label appears on cursor movement, fades after 3s inactivity

**Layer 2: Colored selection** (built-in via `yCursorPlugin`)
- Semi-transparent highlight with user color when selecting text

**Layer 3: Margin avatar** (custom `marginAvatarPlugin`)

```
┌─ left margin ──┐┌─── editor content ──────────────────────┐
│                 ││ # My document                            │
│      [A] ──────>││ This is a paragraph with text...█        │
│                 ││                                          │
│ [B] ──────────>││ Bob is editing█ this line...              │
└─────────────────┘└──────────────────────────────────────────┘
```

Implementation: ProseMirror plugin that:
1. Listens to Yjs awareness changes
2. For each remote user with active cursor: resolve position → DOM coords via `view.coordsAtPos(pos)`
3. Render avatar circles as `position: absolute` elements in a margin container
4. Update positions on every `view.update`
5. Tooltip with full name on hover

```css
.margin-avatar {
  position: absolute;
  left: -40px;
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
  z-index: 5;
}
```

### Topbar presence indicator

```
[topbar] ──── Document.md ──── (A)(B)(+2) ──── [Share]
```

Component `PresenceIndicator.jsx`:
- Subscribes to `awareness.on('change', ...)`
- Filters users with non-null state
- Stacked circles (max 3 visible, then `+N` overflow badge)
- Tooltip shows full list of names

## AI Configurable in Collaborative Mode

### Two modes

**Local (default, `aiVisible: false`):**
1. User requests AI review
2. `awareness.setLocalStateField('user', { aiMode: "reviewing" })` → others see subtle "using AI..." indicator
3. AI generates response → `aiTextPlugin` shows diff locally (unchanged behavior)
4. Accept → edit applied to ProseMirror doc → Yjs propagates to everyone
5. Reject → decorations cleared locally, nothing changes for others

**Shared (`aiVisible: true`):**
1. User enables "Share AI suggestions" in preferences
2. User requests AI review
3. Snapshot saved to `Y.Map('aiSuggestions')`: `{status: "reviewing", oldMarkdown}`
4. AI generates response → map updated: `{status: "done", oldMarkdown, newMarkdown}`
5. Y.Map syncs to all clients via Yjs
6. Other clients see banner: "Alice suggests AI changes — [View diff] [Ignore]"
7. Any editor can accept (applies changes, clears map entry) or reject (clears map entry)

### Y.Map structure

```
ydoc.getMap('aiSuggestions')
  └── userId_123: {
        status: "idle" | "reviewing" | "streaming" | "done",
        oldMarkdown: "...",
        newMarkdown: "...",
        timestamp: 1708123456
      }
```

### User preference

- Toggle: "Share my AI suggestions with collaborators"
- Storage: `localStorage` (UI preference, no backend needed)
- Default: `false` (local mode)
- Location: SettingsModal or AssistantPanel header

### Impact on existing components

| Component | Local mode | Shared mode |
|-----------|-----------|-------------|
| `aiTextPlugin.js` | Unchanged | Unchanged (reused to render diff) |
| `AssistantPanel.jsx` | Unchanged | Add "X suggests changes" banner |
| `MarkdownEditor.jsx` | Unchanged | Observe `Y.Map('aiSuggestions')`, trigger diff display |
| `App.jsx` | Unchanged | Pass `aiSuggestions` observer to editor |

## Offline Hybrid Behavior

### Connection state machine

```
connecting ──(WS open)──► connected ──(WS close)──► reconnecting (0-60s)
    ▲                          ▲                          │
    │                          │ (WS open)                │ (60s timeout)
    │                          └──────────────────────────│
    │                                                     ▼
    └────────────────────────────────────────────── disconnected
                          (retry every 10s)
```

### Behavior per state

| State | Editor | UI | Yjs behavior |
|-------|--------|-----|-------------|
| `connecting` | Loading skeleton | Spinner in topbar | Handshake in progress |
| `connected` | Editable | Subtle green dot | Full bidirectional sync |
| `reconnecting` | Editable (60s grace) | Yellow banner with countdown | Accumulates local updates |
| `disconnected` | Blocked (read-only) | Red banner "No connection" | Auto-retry every 10s |

### Reconnection reconciliation

When Yjs reconnects after offline editing:
- `WebsocketProvider` automatically sends accumulated updates
- Yjs CRDT resolves conflicts without intervention
- May cause visual "jump" if another user edited same lines
- No special UI needed — Yjs handles this transparently

### Connection banner UI

```
Yellow: ⚠ Reconnecting... editing available for 45s more  [Retry]
Red:    ✕ No connection — retrying automatically           [Retry]
```

Component `ConnectionBanner.jsx`:
- Receives `connectionState` as prop
- Renders above editor (position sticky)
- Visual countdown in reconnecting mode
- "Retry" button forces `provider.connect()`
- Auto-hides when back to `connected`

## Implementation Tasks

### Task 1: YjsState model + internal Django API
- Create `YjsState` model (OneToOne with Node, BinaryField)
- Create `internal_views.py` with endpoints for node-access, yjs-state CRUD, content update
- Protect with `X-Internal-Key` header
- Migration + tests

### Task 2: Collab server — scaffolding + auth
- Create `collab/` directory with package.json, Dockerfile
- Implement `auth.js` — JWT validation + Django API role check
- Implement `server.js` — WebSocket server with room creation
- Update `docker-compose.yml`
- Manual test: connect, verify auth

### Task 3: Collab server — schema + persistence
- Implement `schema.js` — Milkdown headless, markdown ↔ ProseMirror ↔ Y.XmlFragment
- Implement `persistence.js` — dual persistence (binary 5s, markdown 30s)
- Room lifecycle: load from DB, persist, grace period cleanup
- Manual test: create room, edit, verify DB persistence

### Task 4: Frontend — collabPlugin.js
- Install yjs, y-prosemirror, y-websocket
- Create `collabPlugin.js` with `createCollabSession()` factory
- Connection state machine (connecting → connected → reconnecting → disconnected)
- Cleanup on destroy

### Task 5: Frontend — MarkdownEditor Yjs integration
- Modify MarkdownEditor to accept `collabSession` prop
- Swap history ↔ yUndoPlugin based on mode
- Skip `defaultValueCtx` in collab mode
- Wire into App.jsx: create/destroy session on node change, disable autosave

### Task 6: Frontend — cursor + selection (built-in)
- Configure `yCursorPlugin` with user colors and names
- Cursor label styling (fade after 3s)
- Selection highlight styling
- Test with two browser tabs

### Task 7: Frontend — margin avatar plugin
- Create `marginAvatarPlugin` — ProseMirror plugin
- Listen to awareness, resolve cursor positions to DOM coords
- Render colored circles in left margin
- Smooth position transitions
- Hover tooltip with name

### Task 8: Frontend — PresenceIndicator topbar component
- Create `PresenceIndicator.jsx`
- Subscribe to awareness changes
- Stacked avatars (max 3 + overflow)
- Wire into topbar

### Task 9: Frontend — ConnectionBanner
- Create `ConnectionBanner.jsx`
- Yellow/red banner based on state
- Countdown timer in reconnecting mode
- Retry button
- Editor read-only toggle in disconnected state

### Task 10: AI configurable mode
- Add `aiVisible` to awareness data
- Add "Share AI suggestions" toggle in SettingsModal
- Create Y.Map('aiSuggestions') observer in MarkdownEditor
- Shared mode: publish suggestions to Y.Map, show banner to others
- Local mode: unchanged behavior
- Accept/reject propagation via Y.Map
