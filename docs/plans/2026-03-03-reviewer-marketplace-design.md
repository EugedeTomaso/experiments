# Reviewer Marketplace Design

**Date:** 2026-03-03
**Status:** Approved
**Approach:** B — Reviewer App (separate shell, shared components)

## Overview

A marketplace where professional reviewers and editors discover published manuscripts, read them with AI-powered analysis tools, and deliver structured review reports to writers. Transforms Mive from a writer's tool into a writer + editor platform.

### Key decisions

- **Reviewers are external professionals** (freelance editors, beta readers) who register specifically to review, not to write.
- **AI score** helps reviewers prioritize what to read — a quality/maturity indicator, not a vanity metric.
- **AI tools**: pre-built analysis buttons + free-form chat for deeper exploration.
- **Deliverable**: reviewer submits a structured final report (summary + inline comments + verdict) as a closed package — no back-and-forth.
- **Marketplace is open**: any writer can list, any reviewer can browse. AI score acts as natural quality filter.
- **MVP priority**: the reviewer's reading + AI + report-building experience.

---

## 1. Data Model

### New models

**`ReviewerProfile`** — extends User with reviewer-specific data.

| Field | Type | Notes |
|-------|------|-------|
| `user` | OneToOne → User | |
| `bio` | TextField | |
| `specialties` | JSONField | e.g. ["literary fiction", "sci-fi"] |

**`MarketplaceListing`** — a project published to the marketplace.

| Field | Type | Notes |
|-------|------|-------|
| `project` | OneToOne → Project | |
| `published_by` | FK → User | The writer |
| `status` | CharField | draft / listed / delisted |
| `genre` | CharField | |
| `word_count` | IntegerField | |
| `synopsis` | TextField | |
| `ai_score` | JSONField | Structured score (see Section 4) |
| `ai_score_updated_at` | DateTimeField | |
| `listed_at` | DateTimeField | |
| `delisted_at` | DateTimeField | nullable |

**`Review`** — the report a reviewer delivers.

| Field | Type | Notes |
|-------|------|-------|
| `listing` | FK → MarketplaceListing | |
| `reviewer` | FK → User | |
| `status` | CharField | in_progress / submitted / read_by_author |
| `summary` | TextField | Free-form general summary |
| `verdict` | CharField | promising / needs_work / publish_ready |
| `started_at` | DateTimeField | |
| `submitted_at` | DateTimeField | nullable |

**`ReviewComment`** — inline comments within a review.

| Field | Type | Notes |
|-------|------|-------|
| `review` | FK → Review | |
| `node` | FK → Node | |
| `body` | TextField | |
| `position_from` | IntegerField | Range start in document |
| `position_to` | IntegerField | Range end in document |
| `comment_type` | CharField | praise / suggestion / issue / note |

**`ReviewAIConversation`** and **`ReviewAIMessage`** — reviewer's AI chat (separate from writer's).

| Field | Type | Notes |
|-------|------|-------|
| `review` | FK → Review | |
| `node` | FK → Node | nullable, if scoped to a chapter |
| role/content/etc. | | Same schema as Conversation/Message |

### Existing model changes

- **User**: add `user_type` field (writer / reviewer), set at registration, immutable.

---

## 2. API Endpoints

### Marketplace (authenticated reviewers)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/marketplace/` | List listings (filters: genre, score, keyword, sort) |
| `GET` | `/api/marketplace/<listing_id>/` | Listing detail (synopsis, score, metadata, preview) |
| `GET` | `/api/marketplace/<listing_id>/nodes/` | Project node tree (read-only) |
| `GET` | `/api/marketplace/<listing_id>/nodes/<node_id>/` | Single node content |

### Listings (writers only, own projects)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/listings/` | Publish project to marketplace |
| `PATCH` | `/api/listings/<id>/` | Edit metadata (synopsis, genre) |
| `POST` | `/api/listings/<id>/delist/` | Remove from marketplace |
| `POST` | `/api/listings/<id>/refresh-score/` | Re-calculate AI score |
| `GET` | `/api/listings/<id>/reviews/` | View received reviews |

### Reviews (reviewers only)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/reviews/` | Start review of a listing |
| `GET` | `/api/reviews/` | My reviews (in_progress + submitted) |
| `GET` | `/api/reviews/<id>/` | Review detail |
| `PATCH` | `/api/reviews/<id>/` | Update summary, verdict |
| `POST` | `/api/reviews/<id>/submit/` | Deliver report to writer |

### Review comments

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/reviews/<id>/comments/` | List review comments |
| `POST` | `/api/reviews/<id>/comments/` | Create inline comment |
| `PATCH` | `/api/reviews/<id>/comments/<cid>/` | Edit comment |
| `DELETE` | `/api/reviews/<id>/comments/<cid>/` | Delete comment |

### Reviewer AI

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/reviews/<id>/ai/analyze` | Pre-built analysis tools |
| `POST` | `/api/reviews/<id>/ai/chat` | Free-form contextual chat |
| `GET` | `/api/reviews/<id>/ai/conversations/` | AI chat history |

### AI Score (internal)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/internal/score-project/<project_id>/` | Generate/update AI score |

---

## 3. Frontend Architecture

### Shell routing

```
main.jsx
├── AuthProvider + AuthGate
│   ├── user_type === "writer"  →  App.jsx (unchanged)
│   └── user_type === "reviewer" →  ReviewerApp.jsx (new shell)
```

### ReviewerApp.jsx layout

```
┌──────────────────────────────────────────────────┐
│  Topbar (logo, search, avatar/settings)          │
├──────────────────────────────────────────────────┤
│  Content (switches by active view)               │
└──────────────────────────────────────────────────┘
```

### Screens

**1. MarketplaceBrowse** — Grid/list of listings with title, author, genre, truncated synopsis, AI score badge, word count. Filter bar (genre, score range, sort). Search. Click → detail.

**2. ListingDetail** — Full synopsis, AI score breakdown (radar or bar chart), metadata. Preview (~500 words of first node). "Start Review" button.

**3. ReaderView** (core MVP screen):

```
┌─────────────────────────────────────────────────────────┐
│  Topbar (project title, progress, "Submit Review")      │
├────────┬──────────────────────────┬─────────────────────┤
│        │                          │                     │
│  Node  │   Milkdown Editor        │  Right Panel (tabs) │
│  Tree  │   (read-only)            │  - AI Tools         │
│        │                          │  - AI Chat          │
│        │   [select text →         │  - Report Builder   │
│        │    comment toolbar]      │                     │
│        │                          │                     │
└────────┴──────────────────────────┴─────────────────────┘
```

- **Node tree**: FolderView-style, read-only, no drag/drop.
- **Editor**: Milkdown read-only. Text selection shows mini-toolbar with "Add Comment" (type + body).
- **AI Tools tab**: Pre-built buttons (Analyze Structure, Evaluate Prose, Find Inconsistencies, Chapter Summaries, Character Map, Compare to Genre). Results render as markdown inline.
- **AI Chat tab**: Free-form chat contextualized to current node/selection.
- **Report Builder tab**: Verdict dropdown, summary textarea, inline comments grouped by node. Preview Report + Submit Review buttons.

**4. MyReviews** — List of in-progress and submitted reviews. Status badges, date, project. Click → ReaderView (if in_progress) or read-only report (if submitted).

### Shared components (reused from writer app)

- `MarkdownEditor.jsx` (read-only mode)
- `api.js` (API client with auto-refresh)
- `AuthContext.jsx` (extended with `user_type`)
- Auth pages (Login, Register, etc.)
- Design tokens / CSS variables from `index.css`

### New components (reviewer-exclusive)

- `ReviewerApp.jsx`, `MarketplaceBrowse.jsx`, `ListingDetail.jsx`, `ReaderView.jsx`, `MyReviews.jsx`
- `AIToolsPanel.jsx`, `ReviewerChatPanel.jsx`, `ReportBuilder.jsx`
- `ScoreBadge.jsx`, `ScoreRadar.jsx`
- `ReviewCommentToolbar.jsx`
- `ListingCard.jsx`

---

## 4. AI Score

### Dimensions

| Dimension | What it measures | Range |
|-----------|------------------|-------|
| Prose Quality | Clarity, flow, narrative voice, language use | 1–10 |
| Structure | Organization, pacing, narrative arcs, transitions | 1–10 |
| Consistency | Character continuity, timeline, worldbuilding, plot holes | 1–10 |
| Completeness | How finished it feels — beginning/middle/end, loose threads | 1–10 |
| Overall | Weighted average of the 4 dimensions | 1–10 |

### Stored format

```json
{
  "overall": 7.2,
  "prose_quality": 8.0,
  "structure": 7.5,
  "consistency": 6.5,
  "completeness": 6.8,
  "summary": "Well-written prose with strong voice. Structure is solid but Act 2 sags. Some timeline inconsistencies in chapters 4-6.",
  "model": "gpt-4o",
  "tokens_used": 12500
}
```

### Calculation

1. Triggered on `POST /api/listings/` or `POST /api/listings/<id>/refresh-score/`.
2. Concatenate all project nodes (respecting tree order), send to LLM with structured evaluation prompt.
3. If project exceeds context window, evaluate by sections and average with a final synthesis pass.
4. Save to `ai_score` + `ai_score_updated_at`.
5. Uses existing `ProviderKey` system for LLM calls.

---

## 5. Reviewer AI Tools

### Pre-built tools (AI Tools tab)

| Tool | Scope | Output |
|------|-------|--------|
| Analyze Structure | Project | Narrative arc map, pacing per chapter, tension points |
| Evaluate Prose | Current node | Voice analysis, clarity, show vs tell, repetitions |
| Find Inconsistencies | Project | Plot holes, timeline contradictions, characterization shifts |
| Chapter Summaries | Project | 2–3 sentence summary per node/chapter |
| Character Map | Project | Character list, relationships, appearances per chapter |
| Compare to Genre | Project | Positioning vs declared genre conventions |

Results render as markdown in the panel. Reviewer can copy fragments to Report Builder.

### Free-form chat (AI Chat tab)

Same pattern as existing AssistantPanel but:
- Context: project content (read-only), not writer's drafts.
- Can reference active node or text selection.
- Responses can be cited in the report.

---

## 6. Auth & Permissions

### Registration

Extended RegisterPage with role selection step:
- **Writer**: current flow (register → demo project → editor).
- **Reviewer**: register → ReviewerProfile (bio + specialties) → marketplace.

`user_type` set at registration, immutable.

### Permission matrix

| Resource | Writer | Reviewer |
|----------|--------|----------|
| Own projects (CRUD) | Yes | No |
| Editor (write mode) | Yes | No |
| Create marketplace listing | Yes | No |
| View received reviews | Yes (own projects) | No |
| Marketplace browse | No | Yes |
| Read content via marketplace | No | Yes |
| Create review | No | Yes |
| Reviewer AI tools | No | Yes |
| Writer AssistantPanel | Yes | No |
| Reviewer AI Chat | No | Yes |

### Enforcement

- **Backend**: `@require_user_type("reviewer")` / `@require_user_type("writer")` decorator on ViewSets. Marketplace/reviews only respond to reviewers; listings/projects only to writers.
- **Frontend**: `AuthGate` routes to `App.jsx` or `ReviewerApp.jsx` based on `user_type` from `/api/auth/me/`.
- **Content access**: reviewers access content only via `/api/marketplace/<listing_id>/nodes/`. Never direct `/api/nodes/<id>/`. Delist = immediate access revocation.

---

## Writer-side integration

In the existing `App.jsx`, a new section/notification for received reviews. Opening a review shows:
- Verdict + summary from reviewer.
- Inline comments positioned on the writer's text (similar to existing Comment system).
- Writer can mark as "read" (changes status to `read_by_author`).

No back-and-forth — it's a closed deliverable.
