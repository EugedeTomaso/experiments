# Marvin Design System

Writing tool with sidebar outline, markdown editor, comments, versions, and AI assistant.

## Direction

Quiet, focused writing environment. Borders-only depth. Minimal color — blue accent used sparingly for active/focus states. Dense sidebar, spacious main content.

## Tokens

Defined in `src/index.css` `:root`.

### Spacing

- Base unit: `4px`
- Scale: 4, 8, 12, 16, 24, 32
- Tree indent: `depth * 16 + 8` px

### Radius

| Token          | Value | Usage                        |
|----------------|-------|------------------------------|
| `--radius-sm`  | 6px   | Buttons, inputs, tree items  |
| `--radius-md`  | 8px   | Cards, popovers, editor      |
| `--radius-lg`  | 12px  | Reserved                     |
| `50%`          | —     | Avatar, agent dot            |
| `999px`        | —     | Pills (status badge)         |

### Typography

- Font: Inter, -apple-system, system-ui, sans-serif
- Monospace: SF Mono, Menlo, Monaco (slash menu icons, shortcuts)

| Role       | Size  | Weight | Tracking  |
|------------|-------|--------|-----------|
| Eyebrow    | 11px  | 500    | 0.08em    |
| Label      | 12px  | 500    | —         |
| Body       | 13px  | 400    | —         |
| Base       | 14px  | 400    | —         |
| Brand      | 15px  | 600    | -0.01em   |
| Heading    | 20px  | 600    | -0.02em   |

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

Borders-only for static elements. Single `--shadow-float` token for floating UI (menus, popovers, tooltips).

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

### Card

```css
border: 1px solid var(--border);
border-radius: var(--radius-md);
padding: 12px;
background: var(--surface);
```

Used for: comments, versions, summary items, editor section (16px pad).

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
padding: 6px 8px;
font-size: 13px;
color: var(--text-2);
```

States: `:hover` (--accent-soft), `.active` (--accent-medium, --accent color, weight 500)
Features: drag-and-drop, inline rename (double-click), delete on hover, collapsible folders.

### Floating Panel (Popover / Menu)

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-float);
padding: 8-12px;
```

### Section Header (Eyebrow)

```css
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.08em;
color: var(--text-4);
```

### Panel Header (Sidebar)

```css
font-size: 11px;
font-weight: 600;
letter-spacing: 0.06em;
text-transform: uppercase;
color: var(--text-4);
```

## Layout

- Topbar: 52px height, fixed
- Sidebar: 260px, scrollable, border-right
- Main: fluid, 24px 32px padding
- Slide-over: 340px, right-anchored
- Settings panel: 360px, right-anchored

## Rules

1. All colors via CSS variables — no hardcoded values
2. All shadows via `--shadow-float` — no inline shadow definitions
3. All transitions use `--duration-fast` or `--duration-normal` with `--ease`
4. All radius via tokens — no arbitrary pixel values
5. Spacing on 4px grid (4, 8, 12, 16, 24, 32)
6. Every interactive element needs `:hover`, `:focus-visible`, and `:disabled` (where applicable)
7. Borders-only depth for static elements — shadows reserved for floating UI
