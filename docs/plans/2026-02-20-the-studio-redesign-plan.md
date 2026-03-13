# "The Studio" Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Mive from a productivity tool into a writing studio — focus mode, AI inline suggestions, dark mode, agent personalities, and new positioning.

**Architecture:** Layer changes on the existing React + Milkdown stack. CSS variable theming for dark mode, ProseMirror plugin extensions for ghost text, state-driven focus mode with CSS transitions. No backend changes except agent seed data.

**Tech Stack:** React 18.2, Milkdown/ProseMirror, CSS custom properties, localStorage for preferences.

---

## Task 1: Dark Mode CSS Tokens

**Files:**
- Modify: `frontend/src/index.css` (lines 3-75, CSS variables section)

**Step 1: Add dark mode variable overrides below the existing `:root` block**

After the closing `}` of `:root`, add:

```css
[data-theme="dark"] {
  /* Surfaces — warm deep grays, not pure black */
  --canvas: #1a1a18;
  --surface: #222220;
  --surface-inset: #2a2a28;

  /* Text hierarchy — lighter weights appear heavier on dark bg */
  --text-1: #e8e8e6;
  --text-2: #a8a8a6;
  --text-3: #7a7a78;
  --text-4: #5a5a58;

  /* Borders */
  --border: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-strong: rgba(255, 255, 255, 0.15);

  /* Accent — brighter blue for dark contrast */
  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --accent-soft: rgba(59, 130, 246, 0.12);
  --accent-medium: rgba(59, 130, 246, 0.18);
  --accent-border: rgba(59, 130, 246, 0.35);

  /* Semantic */
  --success: #10b981;
  --success-soft: rgba(16, 185, 129, 0.12);
  --warning: #f59e0b;
  --warning-soft: rgba(245, 158, 11, 0.12);
  --error: #ef4444;
  --error-soft: rgba(239, 68, 68, 0.12);

  /* Diff highlights */
  --diff-add-bg: rgba(16, 185, 129, 0.18);
  --diff-del-bg: rgba(239, 68, 68, 0.15);

  /* Shadows — more prominent on dark surfaces */
  --shadow-float: 0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2);

  /* Primary button inverts */
  --primary-bg: #e8e8e6;
  --primary-text: #1a1a18;
  --primary-hover: #d0d0ce;
}
```

**Step 2: Add smooth theme transition to `:root`**

In the existing `:root` block, add:

```css
  --theme-transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease, box-shadow 300ms ease;
```

And add to `body` styles:

```css
body, .app-layout, .editor-area, .topbar {
  transition: var(--theme-transition);
}
```

**Step 3: Grep for hardcoded colors in App.css**

Run: `grep -n '#[0-9a-fA-F]\{3,6\}' frontend/src/App.css | head -40`

Replace any hardcoded hex colors with the appropriate CSS variable. Common offenders: hover backgrounds, box-shadows, specific border colors.

**Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/App.css
git commit -m "feat: add dark mode CSS variable tokens"
```

---

## Task 2: Theme Toggle in App

**Files:**
- Modify: `frontend/src/App.jsx` (state initialization section ~line 260)
- Modify: `frontend/src/components/SettingsModal.jsx` (sections array + appearance section)

**Step 1: Add theme state to App.jsx**

Near the existing localStorage-backed state (around line 260), add:

```javascript
const [theme, setTheme] = useState(() => localStorage.getItem('mive:theme') || 'system');
```

**Step 2: Add theme effect to App.jsx**

After the state declaration, add an effect:

```javascript
useEffect(() => {
  localStorage.setItem('mive:theme', theme);
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}, [theme]);

// Also listen for system preference changes when in 'system' mode
useEffect(() => {
  if (theme !== 'system') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, [theme]);
```

**Step 3: Add Appearance section to SettingsModal**

In `SettingsModal.jsx`, update the SECTIONS array:

```javascript
const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "providers", label: "Provider Keys" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI Defaults" },
  { id: "memory", label: "Memory" },
];
```

Add the section content (after the providers conditional block):

```jsx
{activeSection === "appearance" && (
  <div className="settings-section">
    <h3>Theme</h3>
    <p className="settings-desc">Choose your writing environment.</p>
    <div className="settings-row">
      <label>Appearance</label>
      <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  </div>
)}
```

Pass `theme` and `onThemeChange` as props from App.jsx to SettingsModal.

**Step 4: Add topbar theme toggle icon**

In App.jsx's topbar section, add a moon/sun icon button next to the settings icon:

```jsx
<button
  className="topbar-btn"
  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
>
  {theme === 'dark' ? '☀' : '☽'}
</button>
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/SettingsModal.jsx
git commit -m "feat: add theme toggle with light/dark/system modes"
```

---

## Task 3: Layout Defaults — Sidebar Collapsed, Assistant Open

**Files:**
- Modify: `frontend/src/App.jsx` (initial state for `isOutlineOpen`, ~line 200)
- Modify: `frontend/src/App.css` (sidebar rail styles)

**Step 1: Change default sidebar state**

In App.jsx, change the initial state of the outline sidebar to collapsed:

```javascript
// Before:
const [isOutlineOpen, setIsOutlineOpen] = useState(true);
// After:
const [isOutlineOpen, setIsOutlineOpen] = useState(false);
```

Verify that `isAssistantOpen` defaults to `true` (it should already).

**Step 2: Add sidebar rail mode**

When sidebar is collapsed, show a narrow icon rail (48px wide) instead of hiding completely. In App.css, add:

```css
.sidebar-rail {
  width: 48px;
  background: var(--canvas);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 4px;
  flex-shrink: 0;
  transition: width 250ms ease-out;
}

.sidebar-rail .rail-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-3);
  font-size: 13px;
  transition: background 150ms ease, color 150ms ease;
}

.sidebar-rail .rail-icon:hover {
  background: var(--surface-inset);
  color: var(--text-1);
}

.sidebar-rail .rail-icon.active {
  background: var(--surface-inset);
  color: var(--text-1);
}
```

**Step 3: Add rail to App.jsx layout**

In the main layout JSX, when `!isOutlineOpen`, render the rail instead of nothing:

```jsx
{isOutlineOpen ? (
  <FolderView ... />
) : (
  <div className="sidebar-rail">
    <button className="rail-icon" onClick={() => setIsOutlineOpen(true)} title="Open sidebar">
      {/* folder/document icon */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    </button>
    {/* Optionally: document icons from the tree */}
  </div>
)}
```

**Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css
git commit -m "feat: sidebar collapsed by default with icon rail"
```

---

## Task 4: Focus Mode — Auto-Immersive

**Files:**
- Modify: `frontend/src/App.jsx` (new state + effect for focus mode)
- Modify: `frontend/src/App.css` (focus mode styles + transitions)

**Step 1: Add focus mode state to App.jsx**

```javascript
const [isFocusMode, setIsFocusMode] = useState(false);
const focusTimerRef = useRef(null);
const focusModeEnabled = useState(() => localStorage.getItem('mive:focus-mode') !== 'off')[0];
```

**Step 2: Add typing detection effect**

Listen for keydown events on the editor area to detect writing activity:

```javascript
useEffect(() => {
  if (!focusModeEnabled || !selectedNode) return;

  const handleTyping = () => {
    // Reset timer on each keystroke
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);

    focusTimerRef.current = setTimeout(() => {
      setIsFocusMode(true);
    }, 3000);
  };

  const handleInteraction = () => {
    // Any non-typing interaction (click on sidebar, mouse movement to edges) exits focus mode
    setIsFocusMode(false);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  };

  const editorArea = document.querySelector('.editor-area');
  if (!editorArea) return;

  editorArea.addEventListener('keydown', handleTyping);

  return () => {
    editorArea.removeEventListener('keydown', handleTyping);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  };
}, [focusModeEnabled, selectedNode]);
```

**Step 3: Add edge hover detection to exit focus mode**

```javascript
useEffect(() => {
  if (!isFocusMode) return;

  const handleMouseMove = (e) => {
    // Left edge: reveal sidebar
    if (e.clientX < 24) {
      setIsFocusMode(false);
      setIsOutlineOpen(true);
    }
    // Right edge: reveal assistant
    if (e.clientX > window.innerWidth - 24) {
      setIsFocusMode(false);
      setIsAssistantOpen(true);
    }
    // Top edge: reveal topbar
    if (e.clientY < 12) {
      setIsFocusMode(false);
    }
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, [isFocusMode]);
```

**Step 4: Add Cmd+Shift+F shortcut**

In the existing keyboard shortcut handler (or a new useEffect):

```javascript
useEffect(() => {
  const handleShortcut = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      setIsFocusMode(prev => !prev);
    }
  };
  window.addEventListener('keydown', handleShortcut);
  return () => window.removeEventListener('keydown', handleShortcut);
}, []);
```

**Step 5: Apply focus mode class to layout**

In the JSX, add the `focus-mode` class:

```jsx
<div className={`app-layout ${isFocusMode ? 'focus-mode' : ''}`}>
```

**Step 6: Add focus mode CSS**

In App.css:

```css
/* Focus Mode */
.app-layout.focus-mode .sidebar-rail,
.app-layout.focus-mode .folder-view {
  opacity: 0;
  pointer-events: none;
  width: 0;
  overflow: hidden;
  transition: opacity 250ms ease-out, width 250ms ease-out;
}

.app-layout.focus-mode .assistant-panel {
  opacity: 0;
  pointer-events: none;
  width: 0 !important;
  overflow: hidden;
  transition: opacity 250ms ease-out, width 250ms ease-out;
}

.app-layout.focus-mode .pane-divider {
  opacity: 0;
  width: 0;
}

.app-layout.focus-mode .topbar {
  opacity: 0;
  transform: translateY(-100%);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
  pointer-events: none;
}

/* Minimal topbar in focus mode — appears on hover near top */
.app-layout.focus-mode:has(.topbar:hover) .topbar,
.app-layout.focus-mode .topbar-minimal {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Editor breathes */
.app-layout.focus-mode .editor-content {
  max-width: 780px;
  transition: max-width 300ms ease;
}

/* Restore transitions for non-focus */
.sidebar-rail,
.folder-view,
.assistant-panel,
.pane-divider,
.topbar {
  transition: opacity 250ms ease-out, width 250ms ease-out, transform 250ms ease-out;
}
```

**Step 7: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css
git commit -m "feat: add focus mode with 3s auto-activation and edge reveal"
```

---

## Task 5: Transitions & Document Open Animation

**Files:**
- Modify: `frontend/src/App.css` (transition styles)
- Modify: `frontend/src/App.jsx` (document open state)

**Step 1: Add document open animation CSS**

```css
/* Document open animation */
.editor-content.entering .doc-title {
  animation: fadeInUp 200ms ease-out forwards;
}

.editor-content.entering .editor-shell {
  animation: fadeInUp 300ms ease-out 100ms forwards;
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Step 2: Add `entering` class on document switch**

In App.jsx, when `selectedNode` changes, briefly add an `entering` class:

```javascript
const [isDocEntering, setIsDocEntering] = useState(false);

useEffect(() => {
  if (selectedNode) {
    setIsDocEntering(true);
    const timer = setTimeout(() => setIsDocEntering(false), 400);
    return () => clearTimeout(timer);
  }
}, [selectedNode?.id]);
```

Apply in JSX:

```jsx
<div className={`editor-content ${isDocEntering ? 'entering' : ''}`}>
```

**Step 3: Add panel transition polish**

Update existing panel transitions in App.css to use `ease-out` consistently:

```css
.folder-view {
  transition: width 250ms ease-out, opacity 250ms ease-out;
}

.assistant-panel {
  transition: width 250ms ease-out, opacity 250ms ease-out;
}
```

**Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css
git commit -m "feat: add document open animation and panel transitions"
```

---

## Task 6: AI Intensity Levels

**Files:**
- Modify: `frontend/src/App.jsx` (new state for AI intensity)
- Modify: `frontend/src/App.css` (intensity indicator styles)
- Modify: `frontend/src/components/SettingsModal.jsx` (intensity setting)

**Step 1: Add intensity state**

In App.jsx:

```javascript
const [aiIntensity, setAiIntensity] = useState(
  () => localStorage.getItem('mive:ai-intensity') || 'active'
);

useEffect(() => {
  localStorage.setItem('mive:ai-intensity', aiIntensity);
}, [aiIntensity]);
```

**Step 2: Add intensity indicator to topbar**

A small 3-position toggle or clickable indicator near the AI/assistant toggle:

```jsx
<button
  className={`topbar-btn ai-intensity-btn ai-intensity-${aiIntensity}`}
  title={`AI: ${aiIntensity}`}
  onClick={() => {
    const levels = ['silent', 'active', 'coauthor'];
    const next = levels[(levels.indexOf(aiIntensity) + 1) % 3];
    setAiIntensity(next);
  }}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    {/* Spark/wand icon */}
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
</button>
```

**Step 3: Add intensity styles**

```css
.ai-intensity-btn {
  position: relative;
}

.ai-intensity-silent { opacity: 0.4; }
.ai-intensity-active { opacity: 0.7; }
.ai-intensity-coauthor { opacity: 1; color: var(--accent); }
```

**Step 4: Pass intensity to AssistantPanel and MarkdownEditor**

Add `aiIntensity` as a prop to both components. They will use it in later tasks to gate ghost text and proactive suggestions.

**Step 5: Add to SettingsModal**

In the Appearance section:

```jsx
<div className="settings-row">
  <label>AI Presence</label>
  <select value={aiIntensity} onChange={(e) => onAiIntensityChange(e.target.value)}>
    <option value="silent">Silent — only when asked</option>
    <option value="active">Active — subtle suggestions</option>
    <option value="coauthor">Co-author — maximum collaboration</option>
  </select>
</div>
```

**Step 6: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css frontend/src/components/SettingsModal.jsx
git commit -m "feat: add AI intensity levels (silent/active/coauthor)"
```

---

## Task 7: AI Ghost Text (Inline Suggestions)

**Files:**
- Modify: `frontend/src/aiTextAppearPlugin.js` (add ghost text decoration support)
- Modify: `frontend/src/MarkdownEditor.jsx` (pause detection + ghost text trigger)
- Modify: `frontend/src/App.jsx` (API call for ghost text completion)
- Modify: `frontend/src/App.css` (ghost text styles)

**Step 1: Extend the AI text plugin for ghost text**

In `aiTextAppearPlugin.js`, add a new action type `'ghost-text'` to the plugin's state management:

```javascript
// In the plugin's apply function, add handling for ghost text:
if (action === 'show-ghost') {
  // data: { pos: number, text: string }
  const ghostDeco = Decoration.widget(data.pos, () => {
    const span = document.createElement('span');
    span.className = 'ai-ghost-text';
    span.textContent = data.text;
    return span;
  }, { side: 1 });
  return { ...pluginState, ghostDecos: DecorationSet.create(tr.doc, [ghostDeco]) };
}

if (action === 'clear-ghost') {
  return { ...pluginState, ghostDecos: DecorationSet.empty };
}
```

Update the `decorations` method to merge ghost decorations with existing diff decorations.

**Step 2: Add ghost text CSS**

```css
.ai-ghost-text {
  color: var(--text-4);
  opacity: 0.5;
  font-style: italic;
  pointer-events: none;
  user-select: none;
}
```

**Step 3: Add pause detection in MarkdownEditor**

```javascript
// Inside the editor component, add a typing pause detector
const ghostTimerRef = useRef(null);

useEffect(() => {
  if (aiIntensity === 'silent') return;
  if (!editorView) return;

  const handleKeyUp = () => {
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);

    ghostTimerRef.current = setTimeout(() => {
      // Get current cursor position and surrounding context
      const { state } = editorView;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 500), from);

      if (textBefore.trim().length > 20) {
        // Request ghost text from parent via callback
        onRequestGhostText?.(textBefore, from);
      }
    }, 2000);
  };

  editorView.dom.addEventListener('keyup', handleKeyUp);
  return () => {
    editorView.dom.removeEventListener('keyup', handleKeyUp);
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
  };
}, [editorView, aiIntensity]);
```

**Step 4: Add ghost text API call in App.jsx**

```javascript
const handleRequestGhostText = useCallback(async (context, cursorPos) => {
  if (aiIntensity === 'silent') return;

  try {
    const response = await api.post('/api/ai/stream', {
      messages: [{ role: 'user', content: `Continue this text naturally with one sentence. Only return the continuation, nothing else:\n\n${context}` }],
      agent_id: resolvedAgent?.id,
      max_tokens: 100,
    });

    // Show ghost text at cursor position
    const editorView = editorRef.current?.getView?.();
    if (editorView) {
      editorView.dispatch(
        editorView.state.tr.setMeta(aiTextPluginKey, {
          action: 'show-ghost',
          pos: cursorPos,
          text: response.content,
        })
      );
    }
  } catch (err) {
    // Silently fail — ghost text is non-critical
  }
}, [aiIntensity, resolvedAgent]);
```

**Step 5: Add Tab-to-accept handler**

In MarkdownEditor, intercept Tab when ghost text is visible:

```javascript
// In a ProseMirror keymap or handleKeyDown:
if (key === 'Tab' && pluginState.ghostDecos !== DecorationSet.empty) {
  // Insert the ghost text as real content
  const ghostText = /* extract from plugin state */;
  const tr = state.tr.insertText(ghostText, state.selection.from);
  tr.setMeta(aiTextPluginKey, { action: 'clear-ghost' });
  view.dispatch(tr);
  return true; // handled
}
```

**Step 6: Clear ghost on any typing**

Any keystroke (except Tab) should clear ghost text:

```javascript
// In the plugin's apply or in the keydown handler:
if (action !== 'show-ghost' && pluginState.ghostDecos !== DecorationSet.empty) {
  return { ...pluginState, ghostDecos: DecorationSet.empty };
}
```

**Step 7: Commit**

```bash
git add frontend/src/aiTextAppearPlugin.js frontend/src/MarkdownEditor.jsx frontend/src/App.jsx frontend/src/App.css
git commit -m "feat: add AI ghost text suggestions with Tab-to-accept"
```

---

## Task 8: Inline Prompt (Cmd+J)

**Files:**
- Create: `frontend/src/components/InlinePrompt.jsx`
- Modify: `frontend/src/MarkdownEditor.jsx` (shortcut + position tracking)
- Modify: `frontend/src/App.jsx` (inline prompt state + AI call)
- Modify: `frontend/src/App.css` (inline prompt styles)

**Step 1: Create InlinePrompt component**

```jsx
import { useState, useRef, useEffect } from 'react';

export default function InlinePrompt({ position, onSubmit, onClose }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="inline-prompt"
      style={{ top: position.top, left: position.left }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onSubmit(value.trim());
          }
        }}
        placeholder="Ask AI anything..."
      />
    </div>
  );
}
```

**Step 2: Add inline prompt styles**

```css
.inline-prompt {
  position: absolute;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
  padding: 4px 8px;
  min-width: 300px;
  animation: fadeInUp 150ms ease-out;
}

.inline-prompt input {
  width: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text-1);
  background: transparent;
  padding: 6px 4px;
  font-family: inherit;
}

.inline-prompt input::placeholder {
  color: var(--text-4);
}
```

**Step 3: Add Cmd+J shortcut in App.jsx**

```javascript
const [inlinePrompt, setInlinePrompt] = useState(null); // { top, left, from, to, selectedText }

useEffect(() => {
  const handleCmdJ = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      const editorView = editorRef.current?.getView?.();
      if (!editorView) return;

      const { from, to } = editorView.state.selection;
      const coords = editorView.coordsAtPos(from);
      const selectedText = editorView.state.doc.textBetween(from, to);

      setInlinePrompt({
        top: coords.bottom + 8,
        left: coords.left,
        from,
        to,
        selectedText,
      });
    }
  };
  window.addEventListener('keydown', handleCmdJ);
  return () => window.removeEventListener('keydown', handleCmdJ);
}, []);
```

**Step 4: Handle inline prompt submission**

```javascript
const handleInlinePromptSubmit = useCallback(async (instruction) => {
  if (!inlinePrompt) return;
  const { from, to, selectedText } = inlinePrompt;
  setInlinePrompt(null);

  const prompt = selectedText
    ? `Apply this instruction to the selected text. Return ONLY the modified text, nothing else.\n\nInstruction: ${instruction}\n\nSelected text: ${selectedText}`
    : `${instruction}\n\nReturn ONLY the text to insert, nothing else.`;

  try {
    const response = await api.post('/api/ai/stream', {
      messages: [{ role: 'user', content: prompt }],
      agent_id: resolvedAgent?.id,
      max_tokens: 500,
    });

    // Show as diff in editor
    const editorView = editorRef.current?.getView?.();
    if (editorView) {
      // Use existing diff highlight system
      editorRef.current.showDiffHighlights(selectedText, response.content, from);
    }
  } catch (err) {
    console.error('Inline prompt failed:', err);
  }
}, [inlinePrompt, resolvedAgent]);
```

**Step 5: Render InlinePrompt in App.jsx**

```jsx
{inlinePrompt && (
  <InlinePrompt
    position={{ top: inlinePrompt.top, left: inlinePrompt.left }}
    onSubmit={handleInlinePromptSubmit}
    onClose={() => setInlinePrompt(null)}
  />
)}
```

**Step 6: Commit**

```bash
git add frontend/src/components/InlinePrompt.jsx frontend/src/App.jsx frontend/src/App.css frontend/src/MarkdownEditor.jsx
git commit -m "feat: add Cmd+J inline AI prompt with diff response"
```

---

## Task 9: Agent Personalities — Pre-installed Agents

**Files:**
- Modify: `backend/core/demo_project.py` (or equivalent seed data — add default agents)
- Modify: `frontend/src/App.jsx` (ensure agents render with personality)

**Step 1: Define pre-installed agent data**

These agents should be created during user onboarding or project creation. In the backend seed data or demo project setup:

```python
DEFAULT_AGENTS = [
    {
        "name": "The Mirror",
        "role": "Reflects back what you wrote, reformulated, so you see if you said what you meant.",
        "system_prompt": "You are The Mirror. Your role is to reflect back the writer's ideas in different words, helping them see if they communicated what they intended. Never suggest changes — only reformulate and ask 'Is this what you meant?' Be precise, neutral, and Socratic. Use questions, not statements.",
        "temperature": 0.3,
    },
    {
        "name": "The Challenger",
        "role": "Questions your ideas and finds the weak spots in your arguments.",
        "system_prompt": "You are The Challenger. Your role is to question the writer's ideas, find logical gaps, and play devil's advocate. Ask 'Do you really believe this? What would someone who disagrees say?' Be intellectually provocative but respectful. Push the writer to think harder, never to give up.",
        "temperature": 0.6,
    },
    {
        "name": "The Polisher",
        "role": "Pure editing. Cuts, adjusts, tightens. Only craft, never content.",
        "system_prompt": "You are The Polisher. Your role is pure editing craft — cut unnecessary words, tighten sentences, improve rhythm and flow. Never comment on the ideas or content — only on the writing itself. Be terse and surgical. Show, don't explain. When suggesting changes, just show the improved version.",
        "temperature": 0.2,
    },
    {
        "name": "The Explorer",
        "role": "Expands ideas. Brings references, connections, and tangential insights.",
        "system_prompt": "You are The Explorer. Your role is to expand the writer's thinking — bring references, draw connections to other ideas, suggest tangential angles they haven't considered. Say things like 'This reminds me of...' and 'Have you considered...?' Be curious, associative, and expansive. Open doors, don't close them.",
        "temperature": 0.8,
    },
]
```

**Step 2: Add agent seeding to project creation**

In the backend project creation view or wizard endpoint, create these agents for each new project:

```python
for agent_data in DEFAULT_AGENTS:
    Agent.objects.create(project=project, created_by=user, **agent_data)
```

**Step 3: Copy backend changes to Docker mount**

```bash
cp backend/core/demo_project.py /Users/eugeniodetomaso/Projects/experiments/backend/core/demo_project.py
# Also copy any modified view files
```

**Step 4: Commit**

```bash
git add backend/core/demo_project.py
git commit -m "feat: add pre-installed agents (Mirror, Challenger, Polisher, Explorer)"
```

---

## Task 10: Copy & Positioning — Tagline, Empty States, Language

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx` (hero copy, section copy)
- Modify: `frontend/src/App.jsx` (empty states text)
- Modify: `frontend/src/components/AssistantPanel.jsx` (empty state text)
- Modify: `frontend/src/components/ProjectHome.jsx` (language adjustments)

**Step 1: Update landing page hero**

```jsx
{/* Before */}
<span className="hero-eyebrow">AI-powered writing studio</span>
<h1>Where structure meets intelligence.</h1>
<p>Mive gives your writing a home — with outlines that organize your thinking, and an AI assistant that reads everything you've written.</p>

{/* After */}
<span className="hero-eyebrow">A writing studio</span>
<h1>Think deeper. Write better.</h1>
<p>Mive is the space where serious writing happens — with a thinking partner that reads everything you've written and helps you see what you can't.</p>
```

**Step 2: Update section headings on landing page**

Replace productivity language with craft/space language:

- "Not a blank page. A command center" → "Your project. Your space."
- "A writing partner that knows your project" → "A thinking partner. Not a chatbot."
- "An editor that never sleeps" → "Honest feedback. Anytime."
- "And everything else you need" → "Everything a writer needs."

**Step 3: Update empty states in the app**

AssistantPanel empty state:
```jsx
{/* Before */}
"No conversations yet. Start one!"
{/* After */}
"Start a conversation with your writing partner."
```

No documents state:
```jsx
{/* Before */}
"No documents yet. Create one!"
{/* After */}
"Your studio is ready. What are you working on?"
```

**Step 4: Update final CTA on landing page**

```jsx
{/* Before */}
"Ready to write something great?"
"Join writers who use Mive to turn ideas into finished work."

{/* After */}
"Your studio is waiting."
"Join writers who think deeper and write better with Mive."
```

**Step 5: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx frontend/src/App.jsx frontend/src/components/AssistantPanel.jsx frontend/src/components/ProjectHome.jsx
git commit -m "feat: reposition copy — 'Think deeper. Write better.'"
```

---

## Task 11: Display Typography

**Files:**
- Modify: `frontend/index.html` (font import)
- Modify: `frontend/src/index.css` (font-family declarations)
- Modify: `frontend/src/App.css` (brand font usage in specific elements)

**Step 1: Choose and import display font**

Add to `index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```

Note: Instrument Serif is the recommended candidate. If during implementation a different font feels better, swap it — the principle is "a serif with character for brand moments".

**Step 2: Add font variable to index.css**

```css
:root {
  --font-display: 'Instrument Serif', Georgia, serif;
  /* existing --font-body stays as-is */
}
```

**Step 3: Apply display font to brand moments**

In App.css, apply the display font to:

```css
/* App logo/brand in topbar */
.topbar-brand {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: -0.02em;
}

/* Landing page headings */
.hero h1 {
  font-family: var(--font-display);
}

/* Empty state titles */
.empty-state h2 {
  font-family: var(--font-display);
}

/* Project home title could optionally use it */
```

Do NOT apply it to: document content, UI labels, buttons, or navigation. It's for brand personality only.

**Step 4: Add configurable editor font**

In SettingsModal Appearance section, add editor font picker:

```jsx
<div className="settings-row">
  <label>Editor Font</label>
  <select value={editorFont} onChange={(e) => onEditorFontChange(e.target.value)}>
    <option value="sans">Sans-serif (default)</option>
    <option value="serif">Serif</option>
    <option value="mono">Monospace</option>
  </select>
</div>
```

Map to CSS:
```css
.editor-shell.font-sans .ProseMirror { font-family: var(--font-body); }
.editor-shell.font-serif .ProseMirror { font-family: 'Instrument Serif', Georgia, serif; }
.editor-shell.font-mono .ProseMirror { font-family: 'SF Mono', 'Fira Code', monospace; }
```

**Step 5: Commit**

```bash
git add frontend/index.html frontend/src/index.css frontend/src/App.css frontend/src/components/SettingsModal.jsx
git commit -m "feat: add Instrument Serif display font and editor font picker"
```

---

## Task 12: Design System Doc Update

**Files:**
- Modify: `frontend/.interface-design/system.md`

**Step 1: Update system.md to reflect all new patterns**

Add sections for:
- Dark mode variable values and usage rules
- Focus mode behavior and CSS classes
- AI intensity levels and their UI impact
- Display font usage rules (brand moments only)
- Transition timing standards (250ms ease-out for panels, 300ms for theme, 150ms for micro-interactions)
- Agent visual indicators

**Step 2: Commit**

```bash
git add frontend/.interface-design/system.md
git commit -m "docs: update design system for The Studio redesign"
```

---

## Execution Order & Dependencies

```
Task 1 (Dark Mode Tokens)
  └─→ Task 2 (Theme Toggle)
        └─→ Task 11 (Display Typography)
              └─→ Task 12 (Design System Doc Update)

Task 3 (Layout Defaults) ─ independent
  └─→ Task 4 (Focus Mode)
        └─→ Task 5 (Transitions)

Task 6 (AI Intensity Levels) ─ independent
  └─→ Task 7 (Ghost Text)
  └─→ Task 8 (Inline Prompt Cmd+J)

Task 9 (Agent Personalities) ─ independent

Task 10 (Copy & Positioning) ─ independent
```

Tasks 1, 3, 6, 9, and 10 can all start in parallel.
