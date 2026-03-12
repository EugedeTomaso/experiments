# Reviewer Panel Delight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the reviewer side panel feel more alive, swap emoji icons for SVG icons, and render AI/report output as real markdown.

**Architecture:** Introduce a small reviewer-panel config/util layer plus two reusable UI primitives: a thinking state component and a markdown renderer. Wire them into the tools/chat/report surfaces and refresh the reviewer CSS with lightweight motion and typography.

**Tech Stack:** React, Vite, `react-markdown`, existing app CSS, node:test

---

### Task 1: Reviewer panel config helpers

**Files:**
- Create: `frontend/src/components/reviewerPanelConfig.js`
- Create: `frontend/src/components/reviewerPanelConfig.test.js`

**Step 1: Write the failing test**

Assert that reviewer tools use named icon ids instead of emoji and that loading-copy helpers return stable strings.

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/reviewerPanelConfig.test.js`

**Step 3: Write minimal implementation**

Export tool metadata, icon ids, and helper functions for thinking labels.

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/reviewerPanelConfig.test.js`

### Task 2: Shared reviewer primitives

**Files:**
- Create: `frontend/src/components/ReviewerIcon.jsx`
- Create: `frontend/src/components/ReviewerMarkdown.jsx`
- Create: `frontend/src/components/ReviewerThinkingState.jsx`

**Step 1: Implement SVG icons**

Add compact inline SVG icons for reviewer tools and tree nodes.

**Step 2: Implement markdown renderer**

Wrap `react-markdown` with reviewer-specific class names.

**Step 3: Implement thinking state**

Add spinner, status copy, and skeleton lines.

### Task 3: Wire reviewer panel surfaces

**Files:**
- Modify: `frontend/src/components/AIToolsPanel.jsx`
- Modify: `frontend/src/components/ReviewerChatPanel.jsx`
- Modify: `frontend/src/components/ReportBuilder.jsx`
- Modify: `frontend/src/components/ReaderView.jsx`

**Step 1: Move tool metadata to shared config**

Replace inline emoji definitions with icon ids and shared labels.

**Step 2: Render markdown**

Use `ReviewerMarkdown` for tool results, assistant messages, and report preview text.

**Step 3: Improve loading states**

Use `ReviewerThinkingState` in tools/chat and add richer per-tool/per-chat status copy.

**Step 4: Replace tree emojis**

Use `ReviewerIcon` for folder/file nodes.

### Task 4: Refresh reviewer CSS

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Add reviewer markdown typography**

Style headings, lists, blockquotes, code, links, and spacing.

**Step 2: Add motion**

Add hover states, result entrances, spinner animation, shimmer, and tab polish.

**Step 3: Add reduced-motion fallback**

Disable or simplify non-essential animations.

### Task 5: Verify and redeploy

**Files:**
- None

**Step 1: Run tests**

Run: `node --test frontend/src/components/reviewerPanelConfig.test.js`

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Redeploy reviewer UI to Hetzner**

Sync touched frontend files, rebuild nginx image, restart services.

**Step 4: Dogfood reviewer panel**

Verify:
- tool icons are SVG, not emoji
- tool result markdown renders correctly
- chat markdown renders correctly
- thinking state has richer motion
