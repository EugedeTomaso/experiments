# Marvin Design System

Writing and creation tool with three-zone layout: outline rail, markdown editor, and AI assistant panel.

## Direction

Creator-centric focused environment. Three zones that give the editor maximum space with the AI assistant as a first-class citizen alongside the document. Borders-only depth. Minimal color — blue accent used sparingly for active/focus states.

## Layout

Three-column flex layout, all collapsible:

| Zone             | Width    | Position | Content                                     |
|------------------|----------|----------|---------------------------------------------|
| Outline Rail     | 220px    | Left     | File tree only. Collapsible via topbar.      |
| Editor Area      | Fluid    | Center   | Document header + editor. Max-width 760px.   |
| Assistant Pane   | 380px    | Right    | Transparent canvas pane. Thread + composer. Toggle via topbar. |
| Topbar           | 48px h   | Top      | Brand + project switcher (left), toggles (right) |

### Topbar Structure
- **Left**: Brand name → divider → ProjectSwitcher dropdown
- **Right**: Outline toggle, Assistant toggle, Settings toggle (all `topbar-icon-btn`)

### Document Header
- Large title (28px/700) — editable inline
- Meta row: word count, VersionsMenu dropdown, Save button

### Assistant Pane (Canvas Sibling)
- Transparent pane: `background: transparent`, no border, no shadow — lives on canvas
- Editor keeps `max-width: 760px; margin: 0 auto` — centers in available space
- Draggable divider between editor and pane (`.pane-divider`, 12px hit zone, subtle 1px line at rest, 4px×48px handle on hover)
- Assistant width stored in state + `localStorage('marvin:assistant-width')`, default 380px, range 280–600px
- Double-click divider resets to default width
- Top bar: pill-shaped agent selector + circular "+" button + close
- Chat thread: scrollable, messages float on canvas
- Assistant messages use `--surface` bg (white on canvas for contrast)
- Suggestion chips: pill-shaped actions above composer
- Composer: white pill (`--surface` bg, `--border`, 12px radius) — most prominent element
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

- Font: Inter, -apple-system, system-ui, sans-serif
- Monospace: SF Mono, Menlo, Monaco (slash menu icons, shortcuts)

| Role           | Size  | Weight | Tracking  |
|----------------|-------|--------|-----------|
| Eyebrow        | 11px  | 500    | 0.08em    |
| Chat role      | 11px  | 600    | 0.04em    |
| Label          | 12px  | 500    | —         |
| Body           | 13px  | 400    | —         |
| Base           | 14px  | 400    | —         |
| Brand          | 14px  | 600    | -0.01em   |
| Document title | 28px  | 700    | -0.03em   |

### Colors

All via CSS variables. No hardcoded hex/rgba in components.

**Surfaces:** `--canvas`, `--surface`, `--surface-inset`
**Text:** `--text-1` (primary), `--text-2`, `--text-3`, `--text-4` (muted)
**Borders:** `--border` (default), `--border-subtle`, `--border-strong`
**Accent:** `--accent`, `--accent-hover`, `--accent-soft`, `--accent-medium`, `--accent-border`
**Primary:** `--primary`, `--primary-hover`, `--on-primary`
**Semantic:** `--success`/`-soft`/`-border`, `--warning`, `--error`/`-soft`
**Controls:** `--control-bg`, `--control-border`, `--control-focus`

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
| `--ease`           | cubic-bezier(0.25, 0.1, 0.25, 1) | All transitions |

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

States: `:hover` (--accent-soft bg, --text-1 color, --border-strong), `:focus-visible` (--accent border, --control-focus)

### Topbar Icon Button

```css
border: 1px solid transparent;
background: transparent;
width: 32px;
height: 32px;
border-radius: var(--radius-sm);
color: var(--text-3);
```

States: `:hover` (--accent-soft bg), `.active` (--accent border + color + bg)

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

States: `:hover` (--accent-soft), `.active` (--accent-medium, --accent color, weight 500)
Features: drag-and-drop, inline rename (double-click), delete on hover, collapsible folders.

### Chat Message

User messages: plain text, `--text-2` color
Assistant messages: `--surface-inset` background, `--radius-md`, 10px 12px padding

### Canvas Pane (Assistant)

```css
.assistant-pane {
  width: 380px;
  background: transparent;
  /* No border, no shadow — content sits directly on canvas */
}
.assistant-pane-composer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
```

Composer is a white pill on canvas: `--surface` bg, `--border`, 12px radius. Focus-within shows accent border + control-focus ring. Send button is 28px circle.

### Floating Panel (Popover / Menu / Dropdown)

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-float);
padding: 4-8px;
z-index: 100;
```

## Components

| Component         | File                              | Description                              |
|-------------------|-----------------------------------|------------------------------------------|
| ProjectSwitcher   | `components/ProjectSwitcher.jsx`  | Topbar dropdown for project selection     |
| AssistantPanel    | `components/AssistantPanel.jsx`   | Right panel with chat thread              |
| VersionsMenu      | `components/VersionsMenu.jsx`     | Document header dropdown for versions     |
| TreeItem          | `components/TreeItem.jsx`         | Recursive outline tree item               |
| CommentInput      | `components/CommentInput.jsx`     | Floating inline comment input             |
| CommentPopover    | `components/CommentPopover.jsx`   | Click-on-highlight comment popover        |
| SelectionToolbar  | `components/SelectionToolbar.jsx` | Formatting toolbar (Bold/Italic/Strike/Code + Comment) |
| SlashMenu         | `components/SlashMenu.jsx`        | `/` command menu in editor                |
| AgentCreatorSlideOver | `components/AgentCreatorSlideOver.jsx` | AI-powered agent creation flow |
| SettingsModal     | `components/SettingsModal.jsx`    | Centered modal with left nav sections     |

### Settings Modal

Centered 640x480 modal with left nav (180px, `--surface-inset` bg) + content area. Left nav uses same item pattern as tree (hover/active states with `--accent-soft`/`--accent-medium`). Sections are data-driven from a `SECTIONS` array — adding a section means one array entry + one conditional content block.

Sections: Provider Keys, Editor, AI Defaults. Settings values persisted to `localStorage` with `marvin:` prefix keys.

```css
.settings-modal { border-radius: var(--radius-lg); box-shadow: var(--shadow-float); }
.settings-nav { background: var(--surface-inset); border-right: 1px solid var(--border); }
.settings-nav-item.active { background: var(--accent-medium); color: var(--accent); }
```

Responsive (< 900px): full-screen, nav becomes horizontal row at top.

### Formatting Toolbar

Floating toolbar appears on text selection. Contains inline mark toggles + comment action.

```css
.selection-toolbar { padding: 4px; gap: 2px; border-radius: var(--radius-md); box-shadow: var(--shadow-float); }
.fmt-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); }
.fmt-btn-active { background: var(--accent-medium); color: var(--accent); border-color: var(--accent-border); }
```

Buttons use native `addEventListener('mousedown')` to prevent ProseMirror focus loss. Active marks detected via `isMarkActive()` on every view update.

### Editor Typography

Document content uses larger, more readable typography than the UI shell:

| Property | Value | Notes |
|----------|-------|-------|
| Font size | 16px | Up from 14px base — reading-optimized |
| Line height | 1.75 | Generous interlineado for long-form text |
| Paragraph color | `--text-2` | Slightly softer than headings |
| Heading weight | 700/650/600 | H1/H2/H3 — clear hierarchy |
| Block spacing | `0.75em` top margin via `> * + *` | Adjacent sibling combinator |
| Blockquote | `3px solid --accent-border` left border, italic | |
| Code (inline) | `--surface-inset` bg, `--border-subtle` border | |
| Code (block) | `--surface-inset` bg, `--border` border, `16px 20px` padding | |
| HR | `1px solid --border`, `1.5em` vertical margin | |

## Rules

1. All colors via CSS variables — no hardcoded values
2. All shadows via `--shadow-float` — no inline shadow definitions
3. All transitions use `--duration-fast` or `--duration-normal` with `--ease`
4. All radius via tokens — no arbitrary pixel values
5. Spacing on 4px grid (4, 8, 12, 16, 24, 32, 48)
6. Every interactive element needs `:hover`, `:focus-visible`, and `:disabled` (where applicable)
7. Borders-only depth for static elements — shadows reserved for floating UI
8. Editor content centered with 760px max-width
9. Assistant uses chat pattern (conversation thread), not prompt+output
