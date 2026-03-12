# Reviewer Panel Delight Design

## Goal

Make the reviewer side panel feel more alive and more legible by improving AI thinking states, replacing emoji iconography with product-grade SVG icons, and rendering AI/report output as real markdown instead of plain text.

## Scope

- `frontend/src/components/AIToolsPanel.jsx`
- `frontend/src/components/ReviewerChatPanel.jsx`
- `frontend/src/components/ReportBuilder.jsx`
- `frontend/src/components/ReaderView.jsx`
- reviewer panel styles in `frontend/src/App.css`

## Direction

Keep the reviewer UI editorial and focused, not playful. Motion should signal work in progress and result arrival, not distract from reading. The memorable change is that AI output feels like a reviewed artifact rather than a blob of text.

## Decisions

### 1. Thinking states

- Add a shared reviewer thinking pattern with:
  - richer spinner treatment
  - rotating status copy
  - shimmer/skeleton body while the AI is working
- Use this in:
  - tool execution
  - reviewer chat
  - report submission/save feedback where useful

### 2. Iconography

- Replace emoji tool icons with inline SVG icons.
- Also replace folder/file emojis in the reviewer document tree for consistency.
- Keep the icon system local to the reviewer experience to avoid broader app churn.

### 3. Markdown rendering

- Render AI outputs with `react-markdown` through a shared reviewer markdown component.
- Apply reviewer-specific typography styles for:
  - headings
  - paragraphs
  - lists
  - blockquotes
  - inline code and code blocks
  - emphasis/strong
- Use the same renderer in:
  - tool results
  - assistant chat replies
  - report preview summary/comments

### 4. Motion and polish

- Add subtle entrance animation for new results.
- Improve tool card hover/active states.
- Smooth tab/content transitions.
- Respect `prefers-reduced-motion`.

## Verification

- local helper tests for reviewer panel config/loading copy
- `npm run build`
- redeploy to Hetzner
- dogfood reviewer flow on `http://178.104.39.241/app`
