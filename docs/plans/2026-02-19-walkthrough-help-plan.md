# Walkthrough, Tour & Help Center — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the Welcome Walkthrough (new copy, icons, features showcase step), trim and polish the SpotlightTour, and add a new Help Center modal accessible from the topbar.

**Architecture:** Three frontend-only changes — rewrite WelcomeWalkthrough.jsx (new steps, icons, copy), edit SpotlightTour.jsx (fewer steps, progress dots, skip link), create HelpModal.jsx (reuses SettingsModal pattern). All CSS added to App.css following existing design system tokens. App.jsx gets new `isHelpOpen` state and `?` topbar button.

**Tech Stack:** React 18.2, CSS custom properties (design tokens in index.css), SVG icons inline.

**Design doc:** `docs/plans/2026-02-19-walkthrough-help-design.md`

---

### Task 1: Rewrite WelcomeWalkthrough copy and add project type icons

**Files:**
- Modify: `frontend/src/components/WelcomeWalkthrough.jsx`

**Context:** The walkthrough has 5 steps (0-4). We're updating copy on all steps and adding SVG icons to project types. The step structure stays the same for now (steps 0-4); we add the new "features" step in Task 2.

**Step 1: Update the PROJECT_TYPES array to include icons**

In `WelcomeWalkthrough.jsx`, replace the `PROJECT_TYPES` array (lines 6-16) with one that includes an `icon` field — a small SVG path string for each type. Use simple recognizable icons:

```jsx
const PROJECT_TYPES = [
  { id: "novel", label: "Novel", desc: "Long-form fiction with chapters and arcs", icon: "M4 2.5h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a.5.5 0 0 1-.5-.5v-14A.5.5 0 0 1 4 2.5Zm0 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2" },
  { id: "short-story", label: "Short Story", desc: "Single narrative, shorter form", icon: "M3.5 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm2 4h5m-5 3h5m-5 3h3" },
  { id: "screenplay", label: "Screenplay", desc: "Film or theater script", icon: "M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1H2Zm0 3h12m-12 3h12m0-6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4" },
  { id: "tv-series", label: "TV Series", desc: "Show bible and episode outlines", icon: "M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Zm3 10h6m-3 0v2" },
  { id: "youtube", label: "YouTube / Video", desc: "Video scripts and production notes", icon: "M2.5 4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Zm4 2l3.5 2-3.5 2Z" },
  { id: "article", label: "Article / Essay", desc: "Editorial or long-form essays", icon: "M3 2.5h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm1.5 3h7m-7 2.5h7m-7 2.5h4" },
  { id: "academic", label: "Academic", desc: "Thesis, papers, and research", icon: "M8 2L2 5l6 3 6-3Zm-6 5v4l6 3 6-3V7" },
  { id: "product", label: "Product / Work", desc: "Briefs, specs, and roadmaps", icon: "M2.5 3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Zm2.5 3h2m-2 2.5h6m-6 2.5h4" },
  { id: "freeform", label: "Freeform", desc: "Empty project — start from scratch", icon: "M12 3l1 1-8 8-2.5.5.5-2.5 8-8ZM10.5 4.5l1 1" },
];
```

**Step 2: Update the type option rendering to show icons**

In the step 1 render block (around line 517-526), update the button to include the SVG icon:

```jsx
<button
  key={type.id}
  className={`welcome-type-option ${i === 0 ? "wt-pulse-subtle" : ""}`}
  onClick={() => handleTypeSelect(type.id)}
>
  <div className="welcome-type-option-inner">
    <svg className="welcome-type-icon" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={type.icon} />
    </svg>
    <div className="welcome-type-text">
      <span className="welcome-type-label">{type.label}</span>
      <span className="welcome-type-desc">{type.desc}</span>
    </div>
  </div>
</button>
```

**Step 3: Update all step copy**

Replace the following text strings:

- Step 0 heading: `"Your ideas deserve a room, not a blank page."`
- Step 0 text: `"Mive gives your work structure and intelligence. Outline, draft, and revise — with an AI that reads everything you've written."`
- Step 0 subtext: `"For novels, screenplays, articles, academic papers, and anything worth writing well."`
- Step 1 heading: `"What are you making?"`
- Step 1 text: `"Chapters, acts, sections — we'll set up the right structure for your work. What's the project?"`
- Step 1 hint: `"Pick one to continue"`
- Step 2 heading: `"Give it a working title."`
- Step 2 text: `"Working titles change — that's the point."`
- Step 2 hint: `"or press Enter ↵"`
- Step 3 heading (structure): `"We'll set up the scaffolding."`
- Step 3 text (structure): `"Your assistant sees the whole project — the brief, the outline, sibling documents. That's what makes it useful."`
- Step 4 heading (review/launch, will be replaced by features step in Task 2): keep as is for now

**Step 4: Commit**

```bash
git add frontend/src/components/WelcomeWalkthrough.jsx
git commit -m "feat(walkthrough): update copy and add project type icons"
```

---

### Task 2: Add features showcase step to WelcomeWalkthrough

**Files:**
- Modify: `frontend/src/components/WelcomeWalkthrough.jsx`
- Modify: `frontend/src/App.css`

**Context:** Replace the old "review mock" step with a new "features showcase" step showing 3 cards. Adjust step numbering: hero(0), type(1), name(2), structure(3), features(4), launch(5). For freeform: hero(0), type(1), name(2), features(3), launch(4).

**Step 1: Update step flow in the component**

Change the step comments and logic. The key changes:

1. The old `assistantStep` (step 3 or 4 depending on freeform) becomes the features step. The launch step is one step after.
2. Update `totalDots` and step progression logic.
3. Replace `renderReviewStep()` with `renderFeaturesStep()` and `renderLaunchStep()`.

Update the step constants near the top of the component (around line 264):

```jsx
// Step flow: 0=hero, 1=type, 2=name, 3=structure(non-freeform), 4=features, 5=launch
// Freeform: 0=hero, 1=type, 2=name, 3=features, 4=launch
const featuresStep = projectType === "freeform" ? 3 : 4;
const launchStep = projectType === "freeform" ? 4 : 5;
const totalDots = projectType === "freeform" ? 3 : 4;
const currentDotIndex = step - 2;
```

**Step 2: Add the features showcase render function**

Replace `renderReviewStep` with `renderFeaturesStep`:

```jsx
const renderFeaturesStep = () => (
  <>
    <h1 className="welcome-heading">Three things to know.</h1>
    <div className="welcome-features">
      <div className="welcome-feature-card">
        <div className="welcome-feature-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <div className="welcome-feature-title">Select to format</div>
        <div className="welcome-feature-desc">
          Highlight any text and a toolbar appears — bold, italic, strikethrough, code, or leave a comment.
        </div>
      </div>
      <div className="welcome-feature-card">
        <div className="welcome-feature-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 15l2 2 4-4" />
          </svg>
        </div>
        <div className="welcome-feature-title">AI review</div>
        <div className="welcome-feature-desc">
          Hit Review and your AI reads the whole draft — then leaves inline suggestions, like a real editor.
        </div>
      </div>
      <div className="welcome-feature-card">
        <div className="welcome-feature-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" />
            <path d="M19 10l.75 1.7 1.75.8-1.75.8L19 15l-.75-1.7-1.75-.8 1.75-.8Z" />
            <path d="M9 17l.6 1.3 1.4.7-1.4.6L9 21l-.6-1.4-1.4-.6 1.4-.7Z" />
          </svg>
        </div>
        <div className="welcome-feature-title">AI assistant</div>
        <div className="welcome-feature-desc">
          Press <kbd>⌘J</kbd> to chat. It reads your entire project and remembers your preferences.
        </div>
      </div>
    </div>
    <button className="welcome-cta wt-pulse" onClick={() => goForward(launchStep)}>
      Continue
    </button>
  </>
);
```

**Step 3: Add the launch step render function**

```jsx
const renderLaunchStep = () => (
  <>
    <div className="welcome-brand">
      <div className="welcome-brand-mark">M</div>
    </div>
    <h1 className="welcome-heading">Ready.</h1>
    <p className="welcome-text">
      We've loaded a sample draft so you can try everything right away.
    </p>
    <button
      className={`welcome-cta ${!isCreating ? "wt-pulse" : ""}`}
      onClick={handleComplete}
      disabled={isCreating}
    >
      {isCreating ? "Creating..." : "Start writing"}
    </button>
  </>
);
```

**Step 4: Update the JSX step rendering**

Replace the old step 3/4 conditional blocks with:

```jsx
{/* Step 3: Structure (non-freeform only) */}
{step === 3 && projectType !== "freeform" && (
  <div className={stepClass} key="structure">
    {/* ... existing structure step content ... */}
    {/* Update the Continue button onClick to goForward(4) */}
  </div>
)}

{/* Features step */}
{step === featuresStep && (
  <div className={stepClass} key="features">
    {renderFeaturesStep()}
  </div>
)}

{/* Launch step */}
{step === launchStep && (
  <div className={stepClass} key="launch">
    {renderLaunchStep()}
  </div>
)}
```

Also update `handleNameContinue` — for freeform, go to step 3 (features). For non-freeform, go to step 3 (structure) and generate if needed.

**Step 5: Add CSS for features cards**

Add to `App.css` after the `.welcome-hint` block (around line 8409):

```css
/* ── Features showcase ── */

.welcome-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 400px;
}

.welcome-feature-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  animation: wizard-item-in 200ms var(--ease) both;
}

.welcome-feature-card:nth-child(1) { animation-delay: 0ms; }
.welcome-feature-card:nth-child(2) { animation-delay: 80ms; }
.welcome-feature-card:nth-child(3) { animation-delay: 160ms; }

.welcome-feature-icon {
  color: var(--text-3);
  margin-bottom: 4px;
}

.welcome-feature-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}

.welcome-feature-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.welcome-feature-desc kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 11px;
  font-family: "SF Mono", Menlo, Monaco, monospace;
  font-weight: 500;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-2);
}
```

**Step 6: Add CSS for type option with icon**

Add to `App.css` after `.welcome-type-desc` (around line 8084):

```css
.welcome-type-option-inner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.welcome-type-icon {
  flex-shrink: 0;
  color: var(--text-3);
  margin-top: 1px;
}

.welcome-type-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

**Step 7: Add responsive rules for features cards**

Inside the existing `@media (max-width: 640px)` block (around line 8367), add:

```css
  .welcome-features {
    max-width: 100%;
  }
```

**Step 8: Commit**

```bash
git add frontend/src/components/WelcomeWalkthrough.jsx frontend/src/App.css
git commit -m "feat(walkthrough): add features showcase step and type icons"
```

---

### Task 3: Polish SpotlightTour — reduce steps, add progress dots and skip

**Files:**
- Modify: `frontend/src/components/SpotlightTour.jsx`
- Modify: `frontend/src/App.css`

**Step 1: Replace the STEPS array**

Replace the entire `STEPS` array (lines 5-90) with the trimmed 7-step version:

```jsx
const STEPS = [
  {
    selector: ".outline-rail",
    title: "Your project outline",
    text: "Every file and folder lives here. Press \u2318B to toggle it. Drag to reorder, double-click to rename.",
    align: "right",
    padding: 0,
    radius: 0,
  },
  {
    selector: ".rail-create-btn",
    title: "Add to your project",
    text: "New files and folders — build the structure that fits your work.",
    align: "bottom",
    padding: 4,
    radius: 8,
  },
  {
    selector: ".editor-section",
    title: "Your writing space",
    text: "We loaded a sample draft so you can jump right in. Select text for formatting, or press / for commands.",
    align: "left",
    padding: 12,
    radius: 12,
  },
  {
    selector: ".review-btn",
    title: "AI review",
    text: "Hit Review. Your AI reads the whole draft and leaves notes — like handing it to a trusted editor. Approve the ones you like, dismiss the rest.",
    align: "bottom",
    padding: 4,
    radius: 8,
  },
  {
    selector: '[aria-label="Toggle assistant"]',
    title: "Your AI assistant",
    text: "Press \u2318J to open. It reads your entire project and remembers what you teach it across conversations.",
    align: "bottom",
    clickTarget: true,
    padding: 6,
    radius: 8,
  },
  {
    selector: ".agent-selector-pill",
    title: "Choose your assistant",
    text: "Different assistants for different jobs — a brainstormer, a strict editor, a researcher. Pick the right one.",
    align: "bottom",
    padding: 4,
    radius: 20,
    ensureVisible: '[aria-label="Toggle assistant"]',
  },
  {
    selector: '[aria-label="Settings"]',
    title: "Settings",
    text: "API keys, editor preferences, AI defaults — all here.",
    align: "bottom",
    padding: 6,
    radius: 8,
  },
];
```

**Step 2: Add progress dots and skip link to the tooltip**

Replace the tooltip JSX (around lines 275-291) with:

```jsx
{/* Tooltip */}
<div className="spotlight-tooltip" style={tooltipStyle}>
  <div className="spotlight-tooltip-title">{current.title}</div>
  <p className="spotlight-tooltip-text">{current.text}</p>
  <div className="spotlight-tooltip-footer">
    <div className="spotlight-tooltip-dots">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={`spotlight-dot${i === step ? " active" : i < step ? " completed" : ""}`}
        />
      ))}
    </div>
    {current.clickTarget ? (
      <span className="spotlight-tooltip-hint">Click to try it</span>
    ) : (
      <button className="spotlight-tooltip-btn" onClick={advance}>
        {step === STEPS.length - 1 ? "Start writing" : "Next"}
      </button>
    )}
  </div>
  <button className="spotlight-skip" onClick={onComplete}>
    Skip tour
  </button>
</div>
```

**Step 3: Add CSS for progress dots and skip link**

Add to `App.css` after `.spotlight-tooltip-btn:focus-visible` (around line 8628):

```css
.spotlight-tooltip-dots {
  display: flex;
  gap: 6px;
  align-items: center;
}

.spotlight-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border-strong);
  transition: background var(--duration-fast) var(--ease),
              transform var(--duration-fast) var(--ease);
}

.spotlight-dot.active {
  background: var(--primary);
  transform: scale(1.4);
}

.spotlight-dot.completed {
  background: var(--text-3);
}

.spotlight-skip {
  display: block;
  margin-top: 10px;
  border: none;
  background: transparent;
  color: var(--text-4);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  transition: color var(--duration-fast) var(--ease);
}

.spotlight-skip:hover {
  color: var(--text-2);
}
```

**Step 4: Update tooltip animation to 400ms**

In `App.css`, find the `.spotlight-tooltip` rule (line 8554-8564) and change:

```css
animation: spotlight-tooltip-in 400ms var(--ease);
```

Also in `.spotlight-tour.entering .spotlight-tooltip`, keep as is (the entering class hides it during transition).

**Step 5: Commit**

```bash
git add frontend/src/components/SpotlightTour.jsx frontend/src/App.css
git commit -m "feat(tour): reduce steps, add progress dots and skip link"
```

---

### Task 4: Create HelpModal component

**Files:**
- Create: `frontend/src/components/HelpModal.jsx`

**Context:** This modal reuses the same visual pattern as SettingsModal — overlay + centered modal with left nav + content area. Same CSS class prefix pattern but with `help-` prefix where needed.

**Step 1: Create the component**

```jsx
import { useState } from "react";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8" },
  { id: "shortcuts", label: "Shortcuts", icon: "M18 3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12ZM6 15h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z" },
  { id: "features", label: "Features", icon: "M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" },
  { id: "faq", label: "FAQ", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm0-6v.01M12 8a2 2 0 0 1 1.71 3.04c-.45.7-1.71 1.04-1.71 1.96" },
  { id: "contact", label: "Contact", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Zm16 2-8 5-8-5" },
];

const SHORTCUTS = [
  { category: "Editor", items: [
    { keys: "⌘ B", action: "Bold" },
    { keys: "⌘ I", action: "Italic" },
    { keys: "⌘ E", action: "Inline code" },
    { keys: "⌘ ⇧ X", action: "Strikethrough" },
    { keys: "/", action: "Slash commands" },
    { keys: "⌘ Z", action: "Undo" },
    { keys: "⌘ ⇧ Z", action: "Redo" },
  ]},
  { category: "Navigation", items: [
    { keys: "⌘ B", action: "Toggle sidebar" },
    { keys: "⌘ J", action: "Toggle assistant" },
    { keys: "⌘ ,", action: "Open settings" },
  ]},
  { category: "Actions", items: [
    { keys: "⌘ S", action: "Save" },
    { keys: "⌘ ⇧ E", action: "Export" },
  ]},
];

const FEATURES = [
  { title: "Projects", desc: "Organize your writing into projects with nested files and folders. Each project has its own brief, assistants, and memory.", shortcut: null },
  { title: "Documents", desc: "Rich markdown editor with headings, lists, blockquotes, code blocks, and more. Select text for formatting or press / for slash commands.", shortcut: "/" },
  { title: "AI Review", desc: "Your AI reads the full document and leaves inline suggestions — approve, dismiss, or reply to each one. Like handing your draft to a trusted editor.", shortcut: null },
  { title: "AI Assistant", desc: "A conversational AI that reads your entire project. Ask it to brainstorm, edit, research, or critique. It remembers your preferences.", shortcut: "⌘J" },
  { title: "Agents", desc: "Create multiple AI assistants per project — a brainstormer, a strict editor, a researcher. Each has its own personality and instructions.", shortcut: null },
  { title: "Memory", desc: "Teach your AI preferences like \"no cliches\" or \"use British spelling.\" It remembers across files and conversations.", shortcut: null },
  { title: "Versions", desc: "Every save creates a version. Browse, compare, and restore previous versions of any document.", shortcut: null },
  { title: "Export", desc: "Export your work as PDF, DOCX, EPUB, or Markdown. Export individual documents or entire projects.", shortcut: "⌘⇧E" },
];

const FAQ = [
  { q: "How does the AI read my project?", a: "When you use Review or the Assistant, the AI receives the full content of your current document plus context from sibling documents, the project brief, and any active memories. It sees the whole picture, not just a fragment." },
  { q: "Can I use my own API keys?", a: "Yes. Go to Settings → Provider Keys and add keys for OpenAI, Anthropic, DeepSeek, or any supported provider. Your keys are encrypted and stored on your server." },
  { q: "How do versions work?", a: "Every time your document saves (autosave or manual), a new version is created. Click the version icon in the document header to browse, compare, and restore any previous version." },
  { q: "Is my writing private?", a: "Your data is stored on your own server. We don't have access to your writing, API keys, or any other data. AI requests go directly from your server to the provider." },
  { q: "What AI models are supported?", a: "Any model available through OpenAI, Anthropic, OpenRouter, DeepSeek, Cerebras, or Groq. Configure your preferred provider and model in Settings → AI Defaults." },
  { q: "How does memory work?", a: "Type \"remember: [instruction]\" in the assistant chat, or add memories manually in Settings → Memory. Global memories apply everywhere; project memories apply to one project. The AI includes relevant memories in every conversation." },
  { q: "Can I export my work?", a: "Yes — as PDF, DOCX, EPUB, or Markdown. Export a single document from the document header menu, or an entire project from the project overview." },
  { q: "How do I collaborate?", a: "Click the Share button in the topbar to invite collaborators. They can view, comment, or edit depending on the role you assign. Real-time collaboration is supported." },
];

export function HelpModal({ isOpen, onClose, onReplayTour }) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [expandedFaq, setExpandedFaq] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal help-modal" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          <div className="settings-nav-header">Help</div>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`settings-nav-item ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <svg className="help-nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={section.icon} />
              </svg>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-content-header">
            <h2>{SECTIONS.find((s) => s.id === activeSection)?.label}</h2>
            <button className="settings-close" onClick={onClose} aria-label="Close help">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {activeSection === "getting-started" && (
            <div className="settings-section">
              <p className="settings-description">
                Quick guides to get the most out of Mive.
              </p>
              <div className="help-guides">
                <div className="help-guide-card">
                  <div className="help-guide-number">1</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Create a project</div>
                    <div className="help-guide-desc">
                      Click "New Project" in the sidebar, pick a type (novel, screenplay, article, etc.), and the AI will suggest a structure — files and folders tailored to your work.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">2</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Write and format</div>
                    <div className="help-guide-desc">
                      Start typing in any document. Select text to see the formatting toolbar, or press <kbd>/</kbd> for slash commands — headings, lists, blockquotes, code, and more.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">3</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Review your writing</div>
                    <div className="help-guide-desc">
                      Click the Review button in the document header. Your AI reads the entire draft and leaves inline suggestions. Approve what you like, dismiss the rest.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">4</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Chat with your assistant</div>
                    <div className="help-guide-desc">
                      Press <kbd>⌘J</kbd> to open the assistant. Ask it to brainstorm, rewrite, research, or critique. It reads your whole project and remembers your preferences.
                    </div>
                  </div>
                </div>
              </div>
              <div className="help-replay-section">
                <button className="welcome-ghost-btn" onClick={onReplayTour}>
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
                    <path d="M1 4v4h4" />
                    <path d="M1 8a7 7 0 1 0 2.05-4.95L1 4" />
                  </svg>
                  Replay the tour
                </button>
              </div>
            </div>
          )}

          {activeSection === "shortcuts" && (
            <div className="settings-section">
              <p className="settings-description">
                Keyboard shortcuts to move faster.
              </p>
              {SHORTCUTS.map((group) => (
                <div key={group.category} className="help-shortcut-group">
                  <div className="help-shortcut-category">{group.category}</div>
                  <div className="help-shortcut-list">
                    {group.items.map((item) => (
                      <div key={item.action} className="help-shortcut-row">
                        <span className="help-shortcut-action">{item.action}</span>
                        <kbd className="help-shortcut-keys">{item.keys}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "features" && (
            <div className="settings-section">
              <p className="settings-description">
                Everything Mive can do for your writing.
              </p>
              <div className="help-features-list">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="help-feature-item">
                    <div className="help-feature-header">
                      <span className="help-feature-name">{feature.title}</span>
                      {feature.shortcut && (
                        <kbd className="help-shortcut-keys">{feature.shortcut}</kbd>
                      )}
                    </div>
                    <div className="help-feature-desc">{feature.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "faq" && (
            <div className="settings-section">
              <p className="settings-description">
                Common questions about Mive.
              </p>
              <div className="help-faq-list">
                {FAQ.map((item, i) => (
                  <div key={i} className={`help-faq-item ${expandedFaq === i ? "expanded" : ""}`}>
                    <button
                      className="help-faq-question"
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    >
                      <span>{item.q}</span>
                      <svg className="help-faq-chevron" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                    {expandedFaq === i && (
                      <div className="help-faq-answer">{item.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="settings-section">
              <p className="settings-description">
                We're here to help.
              </p>
              <div className="help-contact-cards">
                <a href="mailto:support@mive.app?subject=Bug Report" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                  <div className="help-contact-title">Report a bug</div>
                  <div className="help-contact-desc">Something broken? Let us know.</div>
                </a>
                <a href="mailto:support@mive.app?subject=Feature Request" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" />
                    <path d="M9 17l.6 1.3 1.4.7-1.4.6L9 21l-.6-1.4-1.4-.6 1.4-.7Z" />
                  </svg>
                  <div className="help-contact-title">Request a feature</div>
                  <div className="help-contact-desc">Ideas for making Mive better.</div>
                </a>
                <a href="mailto:support@mive.app?subject=Help" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
                    <polyline points="22 6 12 13 2 6" />
                  </svg>
                  <div className="help-contact-title">Get help</div>
                  <div className="help-contact-desc">Questions? Reach out anytime.</div>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/HelpModal.jsx
git commit -m "feat(help): create HelpModal component with all sections"
```

---

### Task 5: Add HelpModal CSS styles

**Files:**
- Modify: `frontend/src/App.css`

**Context:** Add styles after the SpotlightTour section (after line ~8630). The HelpModal reuses `.settings-modal-overlay`, `.settings-modal`, `.settings-nav`, `.settings-content`, `.settings-section` etc. We only add new styles for help-specific elements.

**Step 1: Add Help-specific CSS**

Add the following CSS block to `App.css` after the spotlight tour styles:

```css
/* ═══════════════════════════════════════════
   Help Modal
   ═══════════════════════════════════════════ */

.help-modal {
  height: 540px;
}

.help-nav-icon {
  flex-shrink: 0;
  margin-right: 8px;
  vertical-align: -2px;
}

/* ── Getting Started guides ── */

.help-guides {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-guide-card {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.help-guide-card:last-child {
  border-bottom: none;
}

.help-guide-number {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-inset);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.help-guide-content {
  flex: 1;
  min-width: 0;
}

.help-guide-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  margin-bottom: 2px;
}

.help-guide-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.help-guide-desc kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-family: "SF Mono", Menlo, Monaco, monospace;
  font-weight: 500;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-2);
}

.help-replay-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

/* ── Shortcuts ── */

.help-shortcut-group {
  margin-bottom: 16px;
}

.help-shortcut-group:last-child {
  margin-bottom: 0;
}

.help-shortcut-category {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-4);
  margin-bottom: 8px;
}

.help-shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.help-shortcut-row:last-child {
  border-bottom: none;
}

.help-shortcut-action {
  font-size: 13px;
  color: var(--text-2);
}

.help-shortcut-keys {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-family: "SF Mono", Menlo, Monaco, monospace;
  font-weight: 500;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-2);
  min-width: 28px;
  text-align: center;
}

/* ── Features ── */

.help-features-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-feature-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.help-feature-item:last-child {
  border-bottom: none;
}

.help-feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.help-feature-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.help-feature-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

/* ── FAQ ── */

.help-faq-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-faq-item {
  border-bottom: 1px solid var(--border-subtle);
}

.help-faq-item:last-child {
  border-bottom: none;
}

.help-faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: color var(--duration-fast) var(--ease);
}

.help-faq-question:hover {
  color: var(--accent);
}

.help-faq-chevron {
  flex-shrink: 0;
  color: var(--text-4);
  transition: transform var(--duration-fast) var(--ease);
}

.help-faq-item.expanded .help-faq-chevron {
  transform: rotate(180deg);
}

.help-faq-answer {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
  padding: 0 0 12px;
  animation: help-faq-open 200ms var(--ease);
}

@keyframes help-faq-open {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Contact ── */

.help-contact-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-contact-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--duration-fast) var(--ease),
              background var(--duration-fast) var(--ease);
}

.help-contact-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-inset);
}

.help-contact-card svg {
  flex-shrink: 0;
  color: var(--text-3);
}

.help-contact-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.help-contact-desc {
  font-size: 12px;
  color: var(--text-3);
  margin-left: auto;
}

/* ── Help modal responsive ── */

@media (max-width: 900px) {
  .help-modal {
    height: 100vh;
    max-height: 100vh;
    width: 100vw;
    max-width: 100vw;
    border-radius: 0;
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat(help): add HelpModal CSS styles"
```

---

### Task 6: Integrate HelpModal and `?` button into App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add import**

After the SpotlightTour import (line 23), add:

```jsx
import { HelpModal } from "./components/HelpModal";
```

**Step 2: Add state**

After `const [isSettingsOpen, setIsSettingsOpen] = useState(false);` (around line 249), add:

```jsx
const [isHelpOpen, setIsHelpOpen] = useState(false);
```

**Step 3: Add the `?` button in the topbar**

In the topbar actions (around line 2421, before the `<span className="topbar-divider" />`), add:

```jsx
<button
  className="topbar-icon-btn"
  onClick={() => setIsHelpOpen(true)}
  aria-label="Help"
  title="Help"
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
</button>
```

**Step 4: Add the HelpModal render**

Before the closing `</div>` of the main app container (around line 3020, before the SpotlightTour render), add:

```jsx
<HelpModal
  isOpen={isHelpOpen}
  onClose={() => setIsHelpOpen(false)}
  onReplayTour={() => {
    setIsHelpOpen(false);
    setShowAppTour(true);
  }}
/>
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(help): integrate HelpModal with topbar button"
```

---

### Task 7: Visual polish and final testing

**Files:**
- Modify: `frontend/src/App.css` (if needed)
- Modify: `frontend/src/components/WelcomeWalkthrough.jsx` (if needed)

**Step 1: Manual QA checklist**

Run the dev server (`cd frontend && npm run dev`) and verify:

1. **Walkthrough**: Clear `mive:walkthrough-seen` from localStorage and reload. Walk through all 6 steps:
   - Hero page has brand mark, new copy, two CTAs
   - Type selection shows SVG icons per type
   - Name step has updated hint copy
   - Structure step generates correctly for non-freeform types
   - Features step shows 3 cards with staggered animation
   - Launch step shows "Ready." with brand mark and CTA
   - Freeform path skips structure step correctly

2. **SpotlightTour**: Complete the walkthrough to trigger the tour:
   - 7 steps (not 10)
   - Progress dots visible and tracking
   - "Skip tour" link works from every step
   - clickTarget step (assistant) works
   - Escape key ends tour

3. **HelpModal**: Click `?` in topbar:
   - Modal opens with 5 sections in left nav
   - Getting Started shows 4 numbered guides + "Replay tour" button
   - Shortcuts shows grouped keyboard shortcuts with kbd styling
   - Features shows all 8 features with descriptions
   - FAQ accordion opens/closes correctly
   - Contact shows 3 action cards with mailto links
   - "Replay tour" button closes modal and starts SpotlightTour
   - Escape closes modal
   - Clicking overlay closes modal

4. **Responsive**: Resize to < 640px and check walkthrough. Resize to < 900px and check help modal goes full-screen.

**Step 2: Fix any issues found during QA**

Address spacing, alignment, or interaction issues found.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(onboarding): polish walkthrough, tour, and help center"
```
