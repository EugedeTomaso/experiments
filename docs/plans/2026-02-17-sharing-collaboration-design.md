# Sharing & Collaboration Design

## Overview

Add project sharing, role-based permissions, invitations, public links, and real-time collaborative editing to the Jakarta platform.

**Approach**: Yjs (CRDT) + y-prosemirror + dedicated WebSocket server (Node.js) for real-time sync. Django REST handles auth, permissions, invitations, and metadata.

## Data Model

### Project changes

```
Project (existing, modified)
  + owner: FK -> User (required)
  + visibility: enum ['private', 'link_viewable'] (default: 'private')
  + share_token: UUID (generated on first share)
```

### New model: ProjectMembership

```
ProjectMembership
  project: FK -> Project
  user: FK -> User (nullable, filled on accept)
  role: enum ['viewer', 'commenter', 'editor', 'admin']
  invited_by: FK -> User
  invited_email: str
  accepted: bool (default: false)
  created_at: datetime
  updated_at: datetime
  unique_together: (project, user)
```

### Permission hierarchy

| Role       | View | Comment | Edit nodes | Manage members | Delete project | Transfer ownership |
|------------|------|---------|------------|----------------|----------------|--------------------|
| Viewer     | Y    |         |            |                |                |                    |
| Commenter  | Y    | Y       |            |                |                |                    |
| Editor     | Y    | Y       | Y          |                |                |                    |
| Admin      | Y    | Y       | Y          | Y              |                |                    |
| Owner      | Y    | Y       | Y          | Y              | Y              | Y                  |

### Access resolution

1. `user == project.owner` -> full access
2. `ProjectMembership(project, user, accepted=True)` -> role-based access
3. `project.visibility == 'link_viewable'` + valid `share_token` -> viewer (no auth required)
4. Otherwise -> 403

## Invitations

### By email

1. Admin/Owner enters email + role in ShareDialog
2. Backend creates `ProjectMembership(accepted=False, invited_email=email)`
3. If email has account -> in-app notification (+ optional email)
4. If no account -> email with invitation link leading to registration
5. On login/register, user sees pending invitations -> accept/decline
6. Accept -> `membership.accepted = True`, `membership.user = user`

### API

```
POST   /api/projects/{id}/invite/                {email, role}
GET    /api/invitations/                          pending invitations for current user
POST   /api/invitations/{id}/accept/
POST   /api/invitations/{id}/decline/
DELETE  /api/projects/{id}/members/{user_id}/
PATCH  /api/projects/{id}/members/{user_id}/      {role}
```

## Public Links

1. Owner/Admin enables "Share with link" -> `visibility = 'link_viewable'`
2. `share_token` (UUID) generated if not present
3. URL: `/shared/{share_token}` -> read-only project view, no auth required
4. Disable: set `visibility = 'private'` (token preserved but inactive)
5. Regenerate: `POST /api/projects/{id}/regenerate-share-token/` -> new UUID, old links stop working

### API

```
PATCH  /api/projects/{id}/                        {visibility: 'link_viewable'}
POST   /api/projects/{id}/regenerate-share-token/
GET    /api/shared/{token}/                       public, returns project + nodes read-only
```

## Real-Time Collaboration

### Architecture

```
Clients (Milkdown + y-prosemirror)
    |
    | WebSocket
    v
y-websocket server (Node.js, Docker service, port 4444)
    |
    | HTTP (internal API)
    v
Django API (permissions, metadata, persistence)
```

### y-websocket server responsibilities

- Each node is a Yjs room: `node:{node_id}`
- On connect: validate JWT, check role via Django internal API
- Viewers/Commenters: receive sync, read-only awareness (no write)
- Editors+: full bidirectional sync
- Persist Yjs doc -> markdown -> Django API every ~30s and on last client disconnect

### Yjs <-> Markdown sync

- Yjs doc is source of truth while clients are connected
- On persist: Yjs doc -> ProseMirror state -> Markdown -> `node.content_md`
- On open (no active Yjs session): `content_md` -> ProseMirror -> Yjs doc
- Existing version system continues: versions created from `content_md` every 10 min

### Milkdown integration

```js
// Plugins added to Milkdown editor
ySyncPlugin(yXmlFragment)      // content sync
yCursorPlugin(awareness)        // remote cursors with name/color
yUndoPlugin()                   // collaborative undo/redo

// Connection
const ydoc = new Y.Doc()
const provider = new WebsocketProvider(WS_URL, `node:${nodeId}`, ydoc)
// JWT sent as query param or first message
```

### Presence

- y-prosemirror awareness: each client publishes `{name, color, cursor}`
- Colored cursors with username labels in editor
- Topbar shows avatars of connected users

### Fallback

- If WebSocket server unavailable, editor works in single-user mode with REST save

## Frontend Changes

### Navigation

- ProjectSwitcher/AllProjects: "My projects" and "Shared with me" sections
- Role badge on shared projects
- Owner avatar on shared projects

### Topbar

- "Share" button -> opens ShareDialog
- Presence indicator (connected user avatars) — Phase 3
- WebSocket connection indicator — Phase 3

### ShareDialog (new component)

- Toggle "Anyone with the link can view" + copy link button
- Email input + role selector + "Invite" button
- Member list with editable role dropdown (Admin/Owner only)
- Remove member button
- Owner transfer option (owner only)

### Editor

- Phase 1-2: no changes
- Phase 3: Yjs plugins replace direct REST save; colored cursors; collaborative undo
- Viewers/Commenters: `editable: false`, comments per role

### Public view (`/shared/{token}`)

- Simplified layout: read-only, no sidebar, no AI assistant
- Banner "You're viewing a shared project" with login/register CTA
- No authentication required

### App state changes

- `fetchProjects` differentiates owned vs shared
- `currentRole` available in context for active project
- UI actions conditional on role
- WebSocket connection + awareness state (Phase 3)

## Infrastructure

### Docker Compose addition

```yaml
collab:
  build: ./collab
  ports:
    - "4444:4444"
  environment:
    - JWT_SECRET=${JWT_SECRET}
    - DJANGO_API_URL=http://backend:8000
  depends_on:
    - backend
```

### Internal Django endpoints (Docker network only)

```
GET   /api/internal/node-access/{node_id}/?user_id={id}  -> {allowed, role}
PATCH /api/internal/nodes/{id}/content/                    -> update content_md
```

### Email

- Development: Django `console.EmailBackend`
- Production: Resend/SendGrid/SES via `EMAIL_BACKEND` config

### Security

- Public links: rate limiting on `/shared/{token}/`
- WebSocket: JWT expiry forces reconnect with fresh token
- Internal endpoints: Docker network isolation or shared API key
- `share_token`: UUID v4, non-guessable, regenerable

## Implementation Phases

### Phase 1 — Ownership & Permissions (foundation)

- Add `owner` to Project, create `ProjectMembership` model
- Data migration: assign owner to existing projects
- Django REST permission classes: `IsProjectOwner`, `IsProjectMember`, `HasProjectRole`
- Filter viewsets: users see only their projects + memberships
- Permission tests

### Phase 2 — Invitations & Sharing

- Invitation API (invite, accept, decline, remove, change role)
- ShareDialog UI component
- Public links: share_token, visibility toggle, public read-only view
- Invitation emails
- Pending invitations view on login

### Phase 3 — Real-Time Collaboration

- y-websocket Node.js server (Docker service)
- y-prosemirror integration in Milkdown: sync, cursors, collaborative undo
- WebSocket auth: JWT validation, role-based write access
- Yjs doc <-> content_md sync (periodic persistence)
- Presence indicator in topbar
- Fallback to single-user mode

### Phase 4 — Polish & Enhancements

- In-app notifications (invitations, new comments on shared projects)
- Basic activity log (who edited what, when)
- Ownership transfer UI
- Reconnection optimization and offline handling
