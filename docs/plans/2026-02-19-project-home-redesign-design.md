# ProjectHome Redesign — Two-Zone Overview

**Date**: 2026-02-19
**Status**: Approved

## Problem

The current ProjectHome mixes project overview (stats, brief) with settings (behavior, memory, assistants, danger zone) in a flat single-column layout. Seven sections with identical visual weight create a monotonous scroll. Users opening "Overview" expect project status, not a settings panel.

## Design

Split ProjectHome into two visually distinct zones:

### Zone 1 — At a Glance (white surface)

Shows the writer what matters: what the project is, how it's going, and how to get back to work.

**Header**
- Title: 32px (down from 40px), 700 weight, editable contentEditable
- Metadata: type label + creation date on one line, separated by `·`, 13px `--text-3`
- Gap: 4px between title and metadata

**Brief**
- Inline editable text (not a textarea). Shows as 15px paragraph, `--text-2`, line-height 1.6
- Placeholder: "Describe what this project is about..." in `--text-4`, italic
- Click to edit (contentEditable or auto-expand textarea), subtle bottom border on focus
- Blur saves with 800ms debounce
- Margin-top: 16px from metadata

**Stats**
- Three metrics inline, no card borders: `display: flex; gap: 32px`
- Value: 24px, 600 weight, `--text-1`
- Label: 11px, 500 weight, uppercase, 0.06em tracking, `--text-4`
- Margin-top: 24px from brief

**Recent Documents** (new)
- Header: "Recent" — 12px, 500 weight, uppercase, `--text-4`, with `border-bottom: 1px solid var(--border-subtle)`
- List of 3-5 most recently edited files from `nodes`, sorted by `updated_at` desc
- Each row: flex, justify-content between, padding `10px 0`, bottom border (except last)
- Doc name: 14px, 500 weight, `--text-1`. Hover: `--accent`
- Timestamp: 12px, `--text-4`
- Click opens the document via `onSelectNode(nodeId)`

### Zone 2 — Settings (inset surface)

Groups all configuration into a visually receded area.

**Container**
- Background: `var(--surface-inset)`, border-radius `var(--radius-md)`, padding `28px 32px`
- Gap between sections: 28px
- Zone header: "Settings" — 13px, 600 weight, `--text-3`, uppercase, letter-spacing 0.05em

**Section Labels**
- Replace `── LABEL ──` dividers with simple labels: 13px, 600 weight, `--text-2`, margin-bottom 8px
- No lines, no uppercase

**Sections** (same functionality, new visual treatment):
1. Reference — ContextFilePicker, same behavior
2. Behavior — Auto-include siblings toggle + hint
3. Memory — Project memories list + add input. Input backgrounds: `--surface` for contrast against inset bg
4. Assistants — Agent list + add button

**Delete** (footer):
- `border-top: 1px solid var(--border-subtle)`, padding-top 20px
- "Delete this project" button — same ghost red style
- No "Danger Zone" label

### Layout

```
.project-home
  max-width: 720px, centered
  padding: 48px 32px 64px
  gap: 40px between zones

.project-home-overview
  (inherits white background)

.project-home-settings
  background: var(--surface-inset)
  border-radius: var(--radius-md)
  padding: 28px 32px
```

## Props Change

ProjectHome needs a new prop: `onSelectNode` — to navigate to a document from the recent docs list.

## Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Layout | Flat column, 7 equal sections | Two zones: overview (white) + settings (inset) |
| Title | 40px | 32px |
| Metadata | Two separate lines | One line with `·` separator |
| Brief | Visible textarea | Inline text, click-to-edit |
| Stats | Bordered cards | Pure typography, no borders |
| Recent docs | Did not exist | List of 3-5 recent documents |
| Section dividers | `── LABEL ──` uppercase with lines | Simple 13px semibold labels |
| Danger zone | Section with "Danger Zone" label | Settings footer with thin divider |
| Settings | Mixed with overview | Grouped in separate visual zone |
