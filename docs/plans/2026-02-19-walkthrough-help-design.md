# Walkthrough, Tour & Help Center — Design

## Overview

Polish the Welcome Walkthrough and SpotlightTour (visual, copy, flow), and add a new Help Center accessible from the topbar.

## 1. Welcome Walkthrough — Redesign

### Flow (6 steps)

| Step | Key | Title | Content |
|------|-----|-------|---------|
| 0 | hero | "Your ideas deserve a room, not a blank page." | Brand mark, tagline, two CTAs: "Create your first project" / "Explore on your own" |
| 1 | type | "What are you making?" | Project types with SVG icons per type. Short, direct descriptions. |
| 2 | name | "Give it a working title." | Name input + description textarea. Hint: "Working titles change — that's the point." |
| 3 | structure | "We'll set up the scaffolding." | AI-generated structure. Copy: "Your assistant can see the whole project — the brief, the outline, sibling documents. That's what makes it useful." Skeleton loading, checkboxes, rename, regenerate. |
| 4 | features | "Three things to know." | Three animated cards: (1) Select text → formatting toolbar, (2) Review button → inline suggestions, (3) ⌘J → assistant. Each with a mini visual mock. |
| 5 | launch | "Ready." | CTA "Start writing" with animation. Smooth transition to app + SpotlightTour. |

### Key changes from current

- **New step 4** (features showcase) replaces the static review mock — shows 3 core features as interactive cards
- **SVG icons** on project type options (book, film, newspaper, etc.)
- **Rewritten copy** throughout — concise, opinionated, memorable
- **Better launch transition** — not just a cold "Start writing"
- Step count stays manageable (6 vs current 5)
- Freeform path skips steps 3+4, goes hero → type → name → launch

### Copy principles

- Short sentences. Active voice.
- Personality without being cute — confident, direct
- Each heading should work standalone as a statement
- Hints in `--text-4`, parenthetical, never patronizing

### Visual improvements

- Type icons: 20x20 SVG, `--text-3` color, left of label
- Features cards: `--surface` bg, `--border`, `--radius-md`, 12px padding. Icon top, title, one-liner description. Subtle hover lift.
- Pulse animation on CTAs (keep existing `.wt-pulse`)
- Smoother page transitions (300ms instead of 250ms)

## 2. SpotlightTour — Polish

### Reduced to 7 steps

| # | Target | Title | Copy |
|---|--------|-------|------|
| 1 | `.outline-rail` | "Your project outline" | "Every file and folder lives here. Press ⌘B to toggle it. Drag to reorder, double-click to rename." |
| 2 | `.rail-create-btn` | "Add to your project" | "New files and folders — build the structure that fits your work." |
| 3 | `.editor-section` | "Your writing space" | "We loaded a sample draft so you can jump right in. Select text for formatting, or press / for commands." |
| 4 | `.review-btn` | "AI review" | "Hit Review. Your AI reads the whole draft and leaves notes — like handing it to a trusted editor. Approve the ones you like, dismiss the rest." |
| 5 | `[aria-label="Toggle assistant"]` | "Your AI assistant" | "Press ⌘J to open. It reads your entire project and remembers what you teach it across conversations." (clickTarget) |
| 6 | `.agent-selector-pill` | "Choose your assistant" | "Different assistants for different jobs — a brainstormer, a strict editor, a researcher. Pick the right one." |
| 7 | `[aria-label="Settings"]` | "Settings" | "API keys, editor preferences, AI defaults — all here." |

### Removed steps (discoverable on their own)
- Project home (`.rail-project-header`) — users find this naturally
- Project switcher (`.project-switcher`) — obvious UI element
- Memory strip (`.memory-strip`) — shown in Help Center

### UI improvements

- **Skip tour link** in every tooltip footer
- **Progress dots** in tooltip footer (like walkthrough)
- **Smoother animations**: tooltip fade 400ms, spotlight transition 350ms
- **Better copy** as shown above

## 3. Help Center — New Component

### Access

`?` button in topbar (next to Settings gear icon). Opens a modal.

### Modal structure

Same pattern as SettingsModal — centered 640x480 modal with left nav + content area.

### Sections

| Section | Nav Label | Content |
|---------|-----------|---------|
| Getting Started | Getting Started | 3-4 mini-guides as clickable cards: "Create a project", "Use the AI assistant", "Review your writing", "Organize with folders". Each expands to show detail. "Replay tour" button at bottom. |
| Shortcuts | Shortcuts | Table grouped by category. **Editor**: ⌘B bold, ⌘I italic, ⌘E code, ⌘⇧X strikethrough, / slash commands. **Navigation**: ⌘B toggle sidebar, ⌘J toggle assistant. **Actions**: ⌘S save, review. Clean table, monospace kbd tags. |
| Features | Features | One paragraph + shortcut per feature: Projects, Documents, AI Review, AI Assistant, Agents, Memory, Versions, Export. Card-like sections. |
| FAQ | FAQ | 5-8 expandable accordion items: "How does the AI read my project?", "Can I use my own API keys?", "How do versions work?", "Is my writing private?", "What AI models are supported?", "How does memory work?", "Can I export my work?", "How do I collaborate?" |
| Contact | Contact | Three action cards: "Report a bug" (link/email), "Request a feature" (link/email), "Get help" (email). Clean, minimal. |

### Design

- Same visual language as SettingsModal
- Nav items with small SVG icons (16x16)
- Accordion in FAQ: `--border-subtle` separator, chevron rotation on open
- Shortcut keys: `<kbd>` styled like existing (`--surface-inset` bg, `--border`, mono font)
- Getting Started cards: `--surface` bg, `--border`, hover state
- "Replay tour" button: ghost button pattern

### Component: `HelpModal.jsx`

Props: `isOpen`, `onClose`, `onReplayTour`

### State in App.jsx

- `isHelpOpen` state
- `?` button in topbar icon group
- `onReplayTour` triggers `setShowAppTour(true)` + closes help modal

## Technical notes

- All three pieces are frontend-only — no backend changes
- Help content is hardcoded (not fetched) — can evolve to CMS later
- Walkthrough shares existing AI structure generation logic
- Tour shares existing spotlight/clip-path mechanism
- Help modal reuses SettingsModal CSS patterns
