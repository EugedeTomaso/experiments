# Comment System Refactor & Version Restore Fix

**Date:** 2026-02-18
**Status:** Approved

## Problem Statement

Five bugs stem from inconsistent state management in the comment system:

1. **Version Restore does nothing visually** — `setDraft()` updates state but never calls `editorRef.current.replaceContent()`, so Milkdown editor keeps showing old content.
2. **Highlights don't disappear on resolve (intermittent)** — `commentDecorationPlugin.js` only filters `status !== "resolved"` but not "approved" or "rejected", causing ghost highlights.
3. **Inconsistent state after approve/reject** — Approve uses a 1.5s `setTimeout` to transition "approved" → "resolved". During this gap, comment is excluded from `unresolvedComments` but still has a visible highlight.
4. **Comment navigation (prev/next) broken** — Two conflicting sources of truth: `unresolvedComments` (React state) vs `getNavigableCommentIds()` (DOM queries). Counter N/M shows incorrect numbers, buttons don't change comment reliably.
5. **Thread positions incorrectly after navigation** — `scrollIntoView()` + immediate `getBoundingClientRect()` captures stale rect before scroll completes.

### Root cause

Three separate sources of truth for comment state:
- `comments[]` state in App.jsx
- DOM elements with `data-comment-id` (read by `getNavigableCommentIds`)
- Comment data inside ProseMirror decoration plugin (received via `tr.setMeta`)

Each filters/interprets comment status differently, causing desynchronization.

## Design

### Architecture: Single source of truth via `useComments` hook

Extract all comment state and logic from App.jsx into a centralized `useComments` hook:

```
useComments(nodeId, editorRef)
  ├── comments[]           — full list from API
  ├── openComments[]       — filtered: root, not resolved/approved/rejected, has quoted_text
  ├── activeThread         — { comment, rect } | null
  ├── focusedId            — ID of focused comment
  ├── navIndex             — current position in openComments (0-based)
  ├── navTotal             — openComments.length
  ├── actions:
  │   ├── approve(id)      — apply suggestion + API call + CSS transition → resolve
  │   ├── reject(id)       — API call + update state
  │   ├── resolve(id)      — API call + update state
  │   ├── delete(id)       — API call + remove from state
  │   ├── reply(parentId, body)
  │   ├── create(payload)
  │   ├── navigateTo(id)   — scroll + open thread with correct rect
  │   ├── navigatePrev()   — iterate openComments[], wrap around
  │   ├── navigateNext()   — iterate openComments[], wrap around
  │   ├── openThread(comment, rect)
  │   └── closeThread()
  └── syncToEditor()       — dispatch openComments to ProseMirror plugin
```

**Key rule:** `openComments` is the ONLY list used for navigation, counting, and decorations. No DOM queries, no inconsistent filters.

### Fix details

**Fix 1 — Decoration filter alignment:**
`buildDecorations()` receives `openComments` (pre-filtered) instead of filtering internally. The decoration plugin no longer decides what to show — it renders whatever it receives.

**Fix 2 — Approve flow without limbo state:**
1. Apply suggestion to editor via `replaceContent`
2. Call API `approve()`
3. Update local state to "approved"
4. CSS transition (1.5s fade-out) on the highlight
5. On CSS `transitionend`, call API `resolve()` and update state
6. Visual animation preserved, but state is always correct and consistent

**Fix 3 — Navigation based on `openComments`:**
`navigatePrev/Next` iterate over `openComments[]` (sorted by `position_from`), not DOM queries. Navigation index always valid because it's derived from the same filtered list.

**Fix 4 — Thread repositioning after scroll:**
`navigateTo(id)` uses `scrollIntoView()` + `requestAnimationFrame` + `getBoundingClientRect()` to capture rect only after layout is complete.

**Fix 5 — Version Restore (separate from comments):**
In `handleRestoreVersion()`, after `setDraft()`, call `editorRef.current.replaceContent(version.content_md)`.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useComments.js` (new) | Centralized hook with all comment logic |
| `src/App.jsx` | Replace ~200 lines of comment state/handlers with `useComments()` |
| `src/commentDecorationPlugin.js` | Receive pre-filtered comments, remove internal filter |
| `src/MarkdownEditor.jsx` | Receive `openComments` for plugin sync |
| `src/App.jsx` (restore) | Add `replaceContent()` call in `handleRestoreVersion` |

### Files NOT changed

Backend, API, models, serializers, CommentInput, CommentPopover, CommentThread (props only), VersionsMenu.
