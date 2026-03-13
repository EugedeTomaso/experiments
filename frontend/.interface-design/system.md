# Mive Design System

Writing and creation tool with three-zone layout: outline rail, markdown editor, and AI assistant panel.

## Direction

Notion-inspired writing environment. Three zones that give the editor maximum space with the AI assistant as a first-class citizen alongside the document. Borderless editor — content floats directly on a white surface with no card container. Borders-only depth elsewhere. Minimal color — blue accent reserved for links and focus rings only, never for navigation active states. Warmer gray palette.

## Layout

Three-column flex layout, all collapsible:

| Zone             | Width    | Position | Content                                     |
|------------------|----------|----------|---------------------------------------------|
| Outline Rail     | 220px    | Left     | File tree only. Collapsible via topbar. Canvas bg (`--canvas`). Default state: collapsed to sidebar rail. |
| Editor Area      | Fluid    | Center   | Document header + editor. Max-width 720px. White surface bg. No card around editor — content is borderless. |
| Assistant Pane   | 440px    | Right    | White surface pane, integrated with editor. Thread + composer. Toggle via topbar. Default state: open. |
| Topbar           | 48px h   | Top      | Brand + project switcher (left), toggles (right) |

### Sidebar Rail (Collapsed State)

Default sidebar state is collapsed to an icon rail. Click to expand to full 220px outline.

```css
.sidebar-rail {
  width: 48px;
  background: var(--canvas);
  border-right: 1px solid var(--border-subtle);
}
```

- 48px wide, shows folder icon centered
- Click anywhere on rail to expand sidebar to full width
- Topbar outline toggle also expands/collapses
- Smooth transition: 250ms ease-out for width change

### Topbar Structure
- **Left**: Brand name → divider → ProjectSwitcher dropdown
- **Right**: Outline toggle, Assistant toggle, Settings toggle (all `topbar-icon-btn`)

### Document Header
- Large title (40px/700) — editable inline, Notion-style
- "Untitled" titles shown in muted `--text-4`, auto-select on focus
- Meta row: word count + save status (left), icon-only actions (right: Versions, Export, `⋯` overflow)
- Overflow menu (`⋯`): Review all / grammar / clarity / style
- Contextual review bar: appears between header and editor only when comments or diff exist. Contains diff toggle pill, comment navigator (◀ N/M ▶), and review progress.
- Bottom status bar: sticky zoom controls (A-/100%/A+) at bottom-right of editor viewport

### Assistant Pane (White Surface)
- Explicit white surface (`--surface`) background — same surface as editor
- Separated from editor via `border-left: 1px solid --border-subtle` on the pane + invisible `.pane-divider` grab zone (8px, no visible line, 3px×32px handle on hover at 0.4 opacity)
- Editor keeps `max-width: 720px; margin: 0 auto` — centers in available space
- Assistant width stored in state + `localStorage('mive:assistant-width')`, default 380px, range 280–600px
- Double-click divider resets to default width
- Top bar: pill-shaped agent selector + circular "+" button + close
- Chat thread: 20px gap, 14px/1.6 text — same reading comfort as editor
- Messages use avatar-driven layout (24px circles) — no bubbles, clean editorial feel
- Suggestion chips: pill-shaped actions above composer
- Composer: white pill (`--surface` bg, `--border`, 12px radius)
- Enter animation: fade-in (`assistant-pane-in`)
- Responsive (< 900px): becomes fixed bottom sheet with `--surface` bg

## Tokens

Defined in `src/index.css` `:root`.

### Spacing

- Base unit: `4px`
- Scale: 4, 8, 12, 16, 24, 32, 48
- Tree indent: `depth * 16 + 8` px

### Radius

| Token          | Value | Usage                        |
|----------------|-------|------------------------------|
| `--radius-sm`  | 6px   | Buttons, inputs, tree items  |
| `--radius-md`  | 8px   | Cards, popovers, editor      |
| `--radius-lg`  | 12px  | Reserved                     |
| `50%`          | —     | Agent dot                    |
| `999px`        | —     | Pills (status badge)         |

### Typography

- Font: `--font-sans` — Inter, -apple-system, system-ui, sans-serif
- Monospace: `--font-mono` — SF Mono, Menlo, Monaco (slash menu icons, shortcuts)
- Display: `--font-display` — 'Instrument Serif', Georgia, serif (brand moments only)

| Role           | Size  | Weight | Tracking  |
|----------------|-------|--------|-----------|
| Eyebrow        | 11px  | 500    | 0.08em    |
| Chat role      | 11px  | 600    | 0.04em    |
| Label          | 12px  | 500    | —         |
| Body           | 13px  | 400    | —         |
| Base           | 14px  | 400    | —         |
| Brand          | 14px  | 600    | -0.01em   |
| Document title | 40px  | 700    | -0.03em   |

**Display font usage (`--font-display`):**
- Use for: logo wordmark, landing page headings, welcome/onboarding headings, empty state titles
- Never use for: editor content, UI labels, buttons, navigation, form inputs, chat messages

**Editor font picker:** Users can choose between three font families for editor content. Stored in `mive:editor-font` in localStorage. Applied as a class on `.editor-shell`.

| Option | Class            | Stack                                            |
|--------|------------------|--------------------------------------------------|
| Sans   | `.font-sans`     | Inter, -apple-system, system-ui, sans-serif      |
| Serif  | `.font-serif`    | 'Source Serif 4', Georgia, 'Times New Roman', serif |
| Mono   | `.font-mono`     | 'JetBrains Mono', 'SF Mono', Menlo, monospace    |

### Colors

All via CSS variables. No hardcoded hex/rgba in components. Supports light and dark themes via `[data-theme]` selector on `:root`.

**Surfaces:** `--canvas`, `--surface`, `--surface-inset`
**Text:** `--text-1` (primary), `--text-2`, `--text-3`, `--text-4` (muted)
**Borders:** `--border` (default), `--border-subtle`, `--border-strong`
**Accent:** `--accent`, `--accent-hover`, `--accent-soft`, `--accent-medium`, `--accent-border`
**Primary:** `--primary`, `--primary-hover`, `--on-primary`
**Semantic:** `--success`/`-soft`/`-border`, `--warning`, `--error`/`-soft`
**Controls:** `--control-bg`, `--control-border`, `--control-focus`

#### Light Mode (default)

| Token              | Value       |
|--------------------|-------------|
| `--canvas`         | `#f7f7f5`   |
| `--surface`        | `#ffffff`   |
| `--surface-inset`  | `#f3f3f1`   |
| `--text-1`         | `#1a1a1a`   |
| `--text-2`         | `#444`      |
| `--text-3`         | `#666`      |
| `--text-4`         | `#999`      |
| `--border`         | `#e5e5e3`   |
| `--border-subtle`  | `#eeeeec`   |
| `--border-strong`  | `#d0d0ce`   |

#### Dark Mode (`[data-theme="dark"]`)

Warm deep gray palette — not pure black. All the same CSS variable names, remapped.

| Token              | Value       |
|--------------------|-------------|
| `--canvas`         | `#1a1a1a`   |
| `--surface`        | `#232323`   |
| `--surface-inset`  | `#2a2a2a`   |
| `--text-1`         | `#e8e8e6`   |
| `--text-2`         | `#b0b0ae`   |
| `--text-3`         | `#888886`   |
| `--text-4`         | `#666664`   |
| `--border`         | `#333331`   |
| `--border-subtle`  | `#2c2c2a`   |
| `--border-strong`  | `#444442`   |
| `--accent`         | `#6ea1f7`   |
| `--accent-soft`    | `rgba(110,161,247,0.1)` |
| `--shadow-float`   | `0 4px 16px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15)` |
| `--error`          | `#f87171`   |
| `--success`        | `#6ee7a0`   |
| `--warning`        | `#fbbf24`   |

**Theme transition:** All themed properties transition smoothly on toggle.

```css
* {
  transition: background-color var(--theme-transition),
              color var(--theme-transition),
              border-color var(--theme-transition),
              box-shadow var(--theme-transition);
}
--theme-transition: 300ms ease;
```

**Theme persistence:** Stored in `mive:theme` in localStorage. Values: `light`, `dark`, `system`. The `system` option follows `prefers-color-scheme` media query.

### Depth

Borders-only for static elements. Single `--shadow-float` token for floating UI.

- Static: `1px solid var(--border)` — no shadow
- Floating: `var(--shadow-float)` — `0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)`
- Focus ring: `var(--control-focus)` — `0 0 0 2px rgba(37,99,235,0.2)`

### Transitions

| Token              | Value  | Usage                  |
|--------------------|--------|------------------------|
| `--duration-fast`  | 150ms  | Hover, color, bg       |
| `--duration-normal`| 200ms  | Slide-over, panels     |
| `--theme-transition` | 300ms | Theme switch (bg, color, border, shadow) |
| `--ease`           | cubic-bezier(0.25, 0.1, 0.25, 1) | All transitions |

#### Transition Standards

| Duration | Easing    | Usage                                            |
|----------|-----------|--------------------------------------------------|
| 150ms    | ease      | Micro-interactions: hover states, button feedback, color changes |
| 200ms    | ease-out  | Document open: title fade-in                     |
| 250ms    | ease-out  | Panel show/hide: sidebar, assistant pane          |
| 300ms    | ease      | Theme switch, editor width change, focus mode     |
| 300ms    | ease + 100ms stagger | Document open: content blocks fade-in  |

## Patterns

### Button — Primary

```css
border: none;
background: var(--primary);
color: var(--on-primary);
padding: 8px 16px;
border-radius: var(--radius-sm);
font-weight: 500;
font-size: 13px;
```

States: `:hover` (--primary-hover), `:focus-visible` (--control-focus), `:disabled` (opacity 0.4)

### Button — Ghost

```css
border: 1px solid var(--border);
background: transparent;
color: var(--text-3);
padding: 4px 8px;
border-radius: var(--radius-sm);
font-size: 12px;
```

States: `:hover` (`rgba(0,0,0,0.03)` bg, --text-1 color, --border-strong), `:focus-visible` (--accent border, --control-focus)

### Topbar Icon Button

```css
border: 1px solid transparent;
background: transparent;
width: 32px;
height: 32px;
border-radius: var(--radius-sm);
color: var(--text-3);
```

States: `:hover` (`rgba(0,0,0,0.03)` bg), `.active` (--surface-inset bg, --text-1 color — muted gray, never blue)

### Card

```css
border: 1px solid var(--border);
border-radius: var(--radius-md);
padding: 12px;
background: var(--surface);
```

### Control (Input / Select / Textarea)

```css
padding: 8px 12px;
border-radius: var(--radius-sm);
border: 1px solid var(--control-border);
background: var(--control-bg);
color: var(--text-1);
font-size: 13px;
```

States: `:focus` (--accent border, --control-focus shadow)

### Tree Item

```css
border: none;
border-radius: var(--radius-sm);
background: transparent;
padding: 5px 8px;
font-size: 13px;
color: var(--text-2);
```

States: `:hover` (`rgba(0,0,0,0.03)`), `.active` (`--surface-inset` bg, `--text-1` color, weight 500 — neutral, never blue)
Features: drag-and-drop, inline rename (double-click), delete on hover, collapsible folders.

### Chat Message

Avatar-driven horizontal layout — no bubbles, no role labels. Both left-aligned.

```css
.chat-message { display: flex; gap: 10px; align-items: flex-start; }
.chat-avatar { width: 24px; height: 24px; border-radius: 50%; }
```

- User avatar: `--surface-inset` bg, `--text-3` color, person icon (12px)
- Assistant avatar: `--accent-soft` bg, `--accent` color, sparkle icon (12px)
- User content: `--text-1`, 14px/1.6
- Assistant content: `--text-2`, 14px/1.6
- Thread gap: 20px between messages

### Assistant Pane

```css
.assistant-pane {
  width: 380px;
  background: var(--surface);
}
.assistant-pane-composer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```

Composer is a clean pill: `--surface` (white) bg, `--border`, 12px radius. Focus-within shows accent border + control-focus ring. Send button is 28px circle.

**Two modes: Conversation List and Thread**

- **List mode** (no active conversation): Shows past conversations for the current document. Each item shows title, relative timestamp, message count, and last message preview. Clicking enters thread mode. Typing in composer creates a new conversation.
- **Thread mode** (active conversation): Shows back button + editable title in header, messages in chat thread, composer to continue. Delete button in header actions.

Conversation titles auto-generated from first user message (50 char, word-boundary truncated). Editable inline (contentEditable) in thread header.

```css
.conversation-item { padding: 12px 16px; border-radius: var(--radius-sm); }
.conversation-item:hover { background: var(--accent-soft); }
.conversation-item-title { font-size: 13px; font-weight: 500; color: var(--text-1); }
.conversation-item-meta { font-size: 11px; color: var(--text-4); }
.assistant-pane-back { width: 28px; height: 28px; /* ghost button pattern */ }
.assistant-pane-thread-title { font-size: 13px; font-weight: 500; /* inline editable */ }
```

### Floating Panel (Popover / Menu / Dropdown)

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-float);
padding: 4-8px;
z-index: 100;
```

## Focus Mode

Distraction-free writing mode that hides all UI chrome to let the writer focus on the document.

### Activation

- **Auto-activate:** Triggers after 3 seconds of continuous typing
- **Manual toggle:** `Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Windows)
- **Exit:** Move mouse to screen edges, press `Cmd+Shift+F` again, or stop typing and move mouse

### Edge Hover Reveal

Moving the cursor to screen edges reveals hidden UI elements:

| Edge   | Zone     | Reveals           |
|--------|----------|-------------------|
| Left   | 24px     | Sidebar rail      |
| Right  | 24px     | Assistant pane    |
| Top    | 12px     | Topbar            |

### CSS

`.focus-mode` class is applied to `.app-shell` when active.

```css
.app-shell.focus-mode .sidebar,
.app-shell.focus-mode .sidebar-rail {
  opacity: 0;
  width: 0;
  transition: opacity 250ms ease-out, width 250ms ease-out;
}
.app-shell.focus-mode .assistant-pane {
  opacity: 0;
  width: 0;
  transition: opacity 250ms ease-out, width 250ms ease-out;
}
.app-shell.focus-mode .topbar {
  opacity: 0;
  transition: opacity 250ms ease-out;
}
.app-shell.focus-mode .editor-section {
  max-width: 780px; /* breathes from 720px */
  transition: max-width 300ms ease;
}
```

Panels fade to 0 opacity and collapse to 0 width. Editor max-width expands from 720px to 780px to use reclaimed space. All transitions use 250ms ease-out for panels, 300ms ease for editor width.

## AI Integration

Three-tier AI intensity system that lets writers control how proactive the AI assistant is.

### Intensity Levels

| Level    | Behavior                                                      |
|----------|---------------------------------------------------------------|
| Silent   | AI responds only when explicitly asked. No proactive suggestions. |
| Active   | Ghost text suggestions after pauses. Contextual chip suggestions in assistant. |
| Coauthor | Maximum assistance. Continuous ghost text, inline prompts, proactive review suggestions. |

Stored in `mive:ai-intensity` in localStorage. Shown as indicator in topbar.

### Ghost Text

AI-generated continuation suggestions that appear inline as the writer pauses.

```css
.ai-ghost-text {
  color: var(--text-4);
  opacity: 0.6;
  font-style: italic;
  pointer-events: none;
  user-select: none;
}
```

- Appears as a ProseMirror decoration after detecting a typing pause
- `Tab` to accept the suggestion (inserts text)
- `Escape` to dismiss
- Continuing to type also dismisses
- Only active at `active` and `coauthor` intensity levels

### Inline Prompt

Floating input that lets writers give AI instructions without leaving the editor.

- **Trigger:** `Cmd+J` (Mac) / `Ctrl+J` (Windows)
- **Behavior:** Small floating input appears near the cursor position
- **With selection:** Prompt applies to selected text, response shows as inline diff
- **Without selection:** Prompt generates new text at cursor position

```css
.inline-prompt {
  background: var(--surface);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
  padding: 8px 12px;
  font-size: 13px;
  min-width: 280px;
}
.inline-prompt:focus-within {
  border-color: var(--accent);
  box-shadow: var(--control-focus);
}
```

## Agent Personalities

Four pre-installed AI agent personalities, each tuned for a different writing assistance style.

| Agent          | Role         | Temperature | Description                                    |
|----------------|--------------|-------------|------------------------------------------------|
| The Mirror     | Reflect      | 0.3         | Echoes back what you wrote, surfaces patterns and themes |
| The Challenger | Question     | 0.6         | Asks probing questions, challenges assumptions  |
| The Polisher   | Edit         | 0.2         | Precise line-editing, grammar, clarity, concision |
| The Explorer   | Expand       | 0.8         | Generates alternatives, explores tangents, brainstorms |

### Visual Indicator

Each agent has a subtle visual indicator in the assistant panel header (agent selector pill). The indicator reflects the active agent personality. Agent color is derived from the agent's accent — no additional color tokens needed.

## Components

| Component         | File                              | Description                              |
|-------------------|-----------------------------------|------------------------------------------|
| AuthShell         | `components/AuthShell.jsx`        | Auth page router (login/register/forgot/reset) |
| LoginPage         | `components/LoginPage.jsx`        | Sign-in form with social buttons          |
| RegisterPage      | `components/RegisterPage.jsx`     | Account creation form                     |
| ForgotPasswordPage| `components/ForgotPasswordPage.jsx`| Password reset request                   |
| ResetPasswordPage | `components/ResetPasswordPage.jsx`| New password form (from email link)       |
| ProjectSwitcher   | `components/ProjectSwitcher.jsx`  | Topbar dropdown for project selection     |
| AssistantPanel    | `components/AssistantPanel.jsx`   | Right panel with conversation history + chat thread |
| VersionsMenu      | `components/VersionsMenu.jsx`     | Document header dropdown for versions     |
| TreeItem          | `components/TreeItem.jsx`         | Recursive outline tree item               |
| CommentInput      | `components/CommentInput.jsx`     | Floating inline comment input             |
| CommentPopover    | `components/CommentPopover.jsx`   | Click-on-highlight comment popover        |
| SelectionToolbar  | `components/SelectionToolbar.jsx` | Formatting toolbar (Bold/Italic/Strike/Code + Comment) |
| SlashMenu         | `components/SlashMenu.jsx`        | `/` command menu in editor                |
| AgentCreatorSlideOver | `components/AgentCreatorSlideOver.jsx` | AI-powered agent creation flow |
| SpotlightTour     | `components/SpotlightTour.jsx`        | Post-creation guided overlay tour       |
| SettingsModal     | `components/SettingsModal.jsx`    | Centered modal with left nav sections     |
| ProjectWizard     | `components/ProjectWizard.jsx`    | Multi-step project creation wizard with AI structure generation |

### Settings Modal

Centered 640x480 modal with left nav (180px, `--surface-inset` bg) + content area. Left nav uses same item pattern as tree (hover/active states with `--accent-soft`/`--accent-medium`). Sections are data-driven from a `SECTIONS` array — adding a section means one array entry + one conditional content block.

Sections: Provider Keys, Editor, AI Defaults. Settings values persisted to `localStorage` with `mive:` prefix keys.

```css
.settings-modal { border-radius: var(--radius-lg); box-shadow: var(--shadow-float); }
.settings-nav { background: var(--surface-inset); border-right: 1px solid var(--border); }
.settings-nav-item.active { background: var(--accent-medium); color: var(--accent); }
```

Responsive (< 900px): full-screen, nav becomes horizontal row at top.

### Project Wizard

Full-page multi-step project creation flow. Replaces main `.app` content when active (conditional render, not overlay). Canvas bg, 480px centered content, 64px top padding. Three path variants with different step counts.

**Standard path (5 steps):**
1. **Type** — 10 project types as vertical list of bordered options (Novel, Short Story, Screenplay, TV Series, YouTube, Article, Academic, Product, Freeform, Custom). Click advances.
2. **Scope** — Extension/sub-type selection per project type (e.g., Novella/Standard/Saga).
3. **Details** — Combined description + material. Textarea for description, material mode buttons ("Starting fresh" default-selected / "Notes" / "Draft"). Paste area for notes/draft.
4. **Structure** — AI generates folder/file tree via `/api/ai/stream`. Skeleton loading preview during generation. Checkboxes to toggle, double-click or Enter/F2 to rename. Regenerate button. Falls back to `FALLBACK_STRUCTURES` if AI unavailable.
5. **Name** — Input pre-filled with AI suggestion. Enter to create. Success animation (checkmark pop) on creation.

**Custom path (6 steps):** Type → Custom Description → AI Questions → Material → Structure → Name.

**Freeform path (2 steps):** Type → Name.

**Progress indicator:** Dot-based progress at top from step 2 onwards. Current = `--primary` (scaled 1.33x), completed = `--text-3`, remaining = `--border-strong`.

**Directional animations:** Forward steps slide up (`translateY(12px)`), backward steps slide down (`translateY(-12px)`).

**Skeleton loading:** 7 placeholder lines with varied widths and pulse animation, previewing structure tree shape during AI generation. Replaces spinner.

**Notices:** AI fallback warnings use `--warning` color with tinted background and border.

```css
.wizard { flex: 1; background: var(--canvas); }
.wizard-body { max-width: 480px; margin: 0 auto; padding: 64px 32px 48px; }
.wizard-step { gap: 24px; animation: wizard-step-in 250ms var(--ease); }
.wizard-step.backward { animation: wizard-step-in-backward 250ms var(--ease); }
.wizard-heading { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
.wizard-type-option { padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); }
.wizard-type-option:hover { border-color: var(--border-strong); background: var(--surface-inset); }
.wizard-type-option:focus-visible { border-color: var(--accent); box-shadow: var(--control-focus); }
.wizard-material-option.selected { border-color: var(--accent-border); background: var(--accent-soft); }
.wizard-structure-item { padding: 8px 12px; animation: wizard-item-in 200ms var(--ease) both; }
.wizard-check { border-radius: 4px; }
.wizard-check.checked { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.wizard-progress-dot { width: 6px; height: 6px; border-radius: 50%; }
.wizard-progress-dot.active { background: var(--primary); transform: scale(1.33); }
.wizard-notice { color: var(--warning); background: rgba(217,119,6,0.06); border: 1px solid rgba(217,119,6,0.15); }
```

All interactive elements have `:focus-visible` states. All spacing on 4px grid. Tree indent: `depth * 16 + 8` (matches sidebar). Responsive (< 640px): 32px/16px padding, 20px heading.

### Welcome Walkthrough (Interactive)

Full-page onboarding flow with guided interaction cues. Steps: Welcome → Type → Name → Structure → Assistant. All CTA buttons have pulsing ring animation (`.wt-pulse`) to draw the eye. Type selection step has hint text ("Pick one to continue") and subtle border glow on first option. Name step shows "or press Enter ↵" hint.

```css
.wt-pulse::after { inset: -4px; border: 2px solid var(--primary); animation: wt-pulse-ring 2s ease-out infinite; }
.wt-pulse-subtle { animation: wt-subtle-glow 2.5s ease-in-out infinite; /* border-color oscillates */ }
.welcome-hint { font-size: 12px; color: var(--text-4); }
```

### Spotlight Tour (Post-Creation)

3-step overlay tour shown after project creation, highlights real UI elements:
1. **Outline rail** — informational, click anywhere to advance
2. **Editor section** — informational
3. **Assistant toggle** — `clickTarget` step, user clicks the real button to advance and open assistant

Uses clip-path polygon with rectangular cutout for dark overlay (`rgba(0,0,0,0.45)`). Pulsing ring (`border: 2px solid rgba(255,255,255,0.5)`) around target. Tooltip uses card pattern. For `clickTarget` steps, backdrop has `pointer-events: none` so clicks reach the real element. Keyboard: Enter/ArrowRight to advance, Escape to skip. 800ms initial delay for app settle.

```css
.spotlight-backdrop { background: rgba(0,0,0,0.45); clip-path: polygon(/* hole */); z-index: 9991; }
.spotlight-ring { border: 2px solid rgba(255,255,255,0.5); animation: spotlight-ring-pulse 2s ease-in-out infinite; z-index: 9992; }
.spotlight-tooltip { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-float); z-index: 9993; }
.spotlight-tooltip-btn { /* Primary button pattern, 12px font, 6px 14px padding */ }
```

Component: `components/SpotlightTour.jsx`. Triggered from `App.jsx` via `showAppTour` state after `handleWalkthroughComplete`.

### Formatting Toolbar

Floating toolbar appears on text selection. Contains inline mark toggles + comment action.

```css
.selection-toolbar { padding: 4px; gap: 2px; border-radius: var(--radius-md); box-shadow: var(--shadow-float); }
.fmt-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); }
.fmt-btn-active { background: var(--accent-medium); color: var(--accent); border-color: var(--accent-border); }
```

Buttons use native `addEventListener('mousedown')` to prevent ProseMirror focus loss. Active marks detected via `isMarkActive()` on every view update.

### Editor Typography

Document content uses larger, more readable typography than the UI shell (Notion-inspired):

| Property | Value | Notes |
|----------|-------|-------|
| Font size | 16px | Up from 14px base — reading-optimized |
| Line height | 1.75 | Generous interlineado for long-form text |
| Paragraph color | `--text-1` | Same as headings — dark, unified. Notion-style. |
| Heading sizes | 1.875em/1.5em/1.25em | H1/H2/H3 — clear hierarchy |
| Heading weight | 700/650/600 | H1/H2/H3 |
| Block spacing | `0.75em` top margin via `> * + *` | Adjacent sibling combinator |
| Placeholder | "Start writing, or press '/' for commands…" | Shown when editor empty, `--text-4` |
| Blockquote | `3px solid --accent-border` left border, italic | |
| Code (inline) | `--surface-inset` bg, `--border-subtle` border | |
| Code (block) | `--surface-inset` bg, `--border` border, `16px 20px` padding | |
| HR | `1px solid --border`, `1.5em` vertical margin | |

### Auth Pages (Login / Register / Forgot / Reset)

Borderless forms floating on canvas background — no card container. Pen-on-paper design: underline-only inputs. Centered narrow column (360px max-width). Brand name at top, generous vertical spacing.

**Layout:** `auth-page` (full viewport, flex-center, `--canvas` bg) → `auth-container` (360px max-width, column, center-aligned). Fade-in entry animation (300ms, translateY 8px).

**Inputs:** Bottom-border-only (`border-bottom: 1px solid --border`, no other borders). Transparent background. 15px font, 12px vertical padding. Focus state: `--text-1` underline color. Placeholder: `--text-4`.

**Social buttons:** Side-by-side ghost buttons with provider icons (Google multicolor SVG, GitHub currentColor SVG). `--surface` bg, `--border`, `--radius-sm`. Hover: `--border-strong`, `--surface-inset` bg. Disabled state at 0.5 opacity (UI-only for now).

**Divider:** Horizontal line with centered "or" text. `--border` lines, `--text-4` label, 12px font.

**Submit button:** Full-width primary button (`--primary` bg, `--on-primary` color, `--radius-sm`). 14px/500 weight. Disabled: 0.5 opacity.

**Error messages:** `--error` color text on `--error-soft` background, `--radius-sm`, 13px font.

**Navigation links:** Text buttons (`auth-link-btn`) — `--text-3` color, no decoration, hover to `--text-1`.

```css
.auth-page { min-height: 100vh; background: var(--canvas); display: flex; align-items: center; justify-content: center; }
.auth-container { max-width: 360px; }
.auth-brand { font-size: 14px; font-weight: 600; margin-bottom: 48px; }
.auth-heading { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
.auth-input { border: none; border-bottom: 1px solid var(--border); background: transparent; padding: 12px 0; font-size: 15px; }
.auth-input:focus { border-bottom-color: var(--text-1); }
.auth-social-btn { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-sm); }
.auth-submit-btn { background: var(--primary); color: var(--on-primary); border-radius: var(--radius-sm); }
```

**Auth state:** `AuthContext.jsx` (React context) + `AuthGate.jsx` (conditional render). JWT tokens stored in `localStorage` with `mive:` prefix (`mive:access_token`, `mive:refresh_token`). AuthShell manages page routing (login/register/forgot/reset) without a router library.

## Rules

1. All colors via CSS variables — no hardcoded values. Both light and dark themes must be supported.
2. All shadows via `--shadow-float` — no inline shadow definitions
3. All transitions use `--duration-fast` or `--duration-normal` with `--ease`
4. All radius via tokens — no arbitrary pixel values
5. Spacing on 4px grid (4, 8, 12, 16, 24, 32, 48)
6. Every interactive element needs `:hover`, `:focus-visible`, and `:disabled` (where applicable)
7. Borders-only depth for static elements — shadows reserved for floating UI
8. Editor content centered with 720px max-width (780px in focus mode)
9. Assistant uses chat pattern (conversation thread), not prompt+output
10. Dark mode uses `[data-theme="dark"]` selector — never `@media (prefers-color-scheme)` directly for styling
11. Display font (`--font-display`) is reserved for brand moments — never in editor content or UI chrome
12. AI features respect the current intensity level — check `mive:ai-intensity` before showing proactive suggestions
