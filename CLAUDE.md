# CLAUDE.md

## Project Overview

AI-powered Markdown writing studio with project trees, versioning, inline comments, and configurable AI agents. Notion-style editor built on ProseMirror/Milkdown.

## Architecture

- **Backend**: Django 5.2 + DRF, PostgreSQL 16, JWT auth (SimpleJWT)
- **Frontend**: React 18.2 + Vite, Milkdown v7.6.3 (ProseMirror-based markdown editor)
- **Infrastructure**: Docker Compose (3 services: db, backend, frontend)

## Development

### Starting the stack

```bash
docker compose up --build
```

- API: http://localhost:8000
- Web: http://localhost:5173 (Docker) / http://localhost:5174 (local `npm run dev`)
- DB: PostgreSQL on port 5432 (user: app, password: app, db: app)

Requires `ENCRYPTION_KEY` env var (Fernet key) for encrypted API key storage.

### Frontend (local dev)

```bash
cd frontend
npm install
npm run dev        # Vite dev server with HMR
npm run build      # Production build
npm run lint       # ESLint
```

### Backend (runs in Docker)

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations
docker exec -it experiments-backend-1 python manage.py migrate
docker exec -it experiments-backend-1 python manage.py shell
```

### Docker mount mismatch

Docker containers mount from `/Users/eugeniodetomaso/Projects/experiments/`, NOT from the Conductor workspace. Backend changes made in this workspace must be copied to the Docker mount source to take effect:

```bash
cp backend/<file> /Users/eugeniodetomaso/Projects/experiments/backend/<file>
```

### Testing

Playwright e2e tests in `frontend/tests/`. Config at `frontend/playwright.config.js`.

```bash
cd frontend
npx playwright test                    # Run all tests
npx playwright test tests/<file>.spec.js  # Run specific test
```

- Base URL: `http://localhost:5174`
- Headless, screenshots on, video on failure
- Tests share state across runs (same DB) — use `.last()` or `.first()` for locators that may match multiple elements

## Code Organization

### Backend (`backend/`)

| File | Purpose |
|------|---------|
| `core/models.py` | All models: Project, Node, Version, Comment, Agent, Conversation, Message, etc. |
| `core/views.py` | DRF ViewSets + AI stream/review endpoints |
| `core/serializers.py` | DRF serializers |
| `core/urls.py` | All API routes (auth, CRUD, AI, export, publish) |
| `core/llm.py` | LLM provider integration (OpenAI, Anthropic, DeepSeek, Groq, etc.) |
| `core/auth_views.py` | JWT register/login/refresh/password-reset |
| `core/export_views.py` | Document export (PDF, DOCX, EPUB) |
| `core/publish_views.py` | OAuth platform publishing |
| `server/settings.py` | Django config (DB, JWT, CORS, apps) |

### Frontend (`frontend/src/`)

| File | Purpose |
|------|---------|
| `main.jsx` | React root with AuthProvider + AuthGate |
| `App.jsx` | Main shell — all top-level state, 33+ component imports |
| `App.css` | All component styles (large file) |
| `index.css` | Design tokens and global typography |
| `MarkdownEditor.jsx` | Milkdown editor wrapper |
| `api.js` | API client with JWT auto-refresh |
| `AuthContext.jsx` | Auth state (tokens in localStorage as `mive:*`) |

Key components in `src/components/`:
- `AssistantPanel.jsx` — Right-side AI chat (list + thread modes)
- `FolderView.jsx` — Document tree/outline sidebar
- `SelectionToolbar.jsx` — Formatting toolbar (Bold/Italic/Strike/Code/Comment)
- `SlashMenu.jsx` — `/` command palette
- `ProjectWizard.jsx` — Multi-step project creation with AI
- `CommentThread.jsx` — Inline comment replies
- `SettingsModal.jsx` — Settings center

## Key Patterns

### Milkdown / ProseMirror

- Plugins use `tooltipFactory`/`TooltipProvider` from `@milkdown/kit/plugin/tooltip`, `$prose` from `@milkdown/kit/utils`
- `TooltipProvider` uses `@floating-ui/dom` (NOT tippy.js) — no `tippyOptions` or `interactive` option
- Mark toggle commands: `toggleStrongCommand`, `toggleEmphasisCommand`, `toggleInlineCodeCommand` from commonmark; `toggleStrikethroughCommand` from gfm. Execute via `callCommand(cmd.key)`
- ProseMirror decorations via Plugin with `DecorationSet`, updated through `tr.setMeta(pluginKey, data)`

### React ↔ ProseMirror Communication

- CustomEvent dispatched on `editorView.dom` with `bubbles: true`, listeners on wrapper `ref`
- Tooltip button clicks must use native `addEventListener('mousedown', handler)` via `useRef` + `useEffect` (React 18 delegates events to root, causing ProseMirror focus loss with `onMouseDown`)
- Save selection in a ref on every view update so it's available regardless of focus state

### Styling Conventions

- Design system documented in `frontend/.interface-design/system.md`
- All editor content styles scoped under `.editor-shell .ProseMirror`
- CSS custom properties for colors, spacing, shadows — see `index.css`
- Warm gray palette: `--canvas: #f7f7f5`, `--surface: white`, `--surface-inset: #f3f3f1`
- Topbar active states: muted gray (`--surface-inset` bg), never blue accent
- No shadows on static elements; `--shadow-float` only for floating panels

### API

- All endpoints under `/api/`
- JWT tokens: `mive:access_token` / `mive:refresh_token` in localStorage
- Auto-refresh on 401 with request deduplication
- Streaming AI responses via `POST /api/ai/stream`

## API Routes Summary

- Auth: `/api/auth/{register,login,refresh,me,password-reset}/`
- CRUD: `/api/{projects,nodes,versions,comments,agents,conversations,messages,memories}/`
- AI: `/api/ai/{stream,review,comment-reply}`
- Export: `/api/export/{node,project}/<id>/`
- Publish: `/api/publish/{connect,callback,connections,history}/`
- Search: `/api/search/`

## Common Pitfalls

- Backend code changes in this workspace don't affect the running Docker container — must copy to Docker mount source
- `flushSync` warnings from Milkdown's `@prosemirror-adapter/react` are harmless, ignore them
- Playwright tests share DB state — design tests to be resilient to existing data
- The `App.css` file is very large — search for specific selectors rather than reading the whole file
