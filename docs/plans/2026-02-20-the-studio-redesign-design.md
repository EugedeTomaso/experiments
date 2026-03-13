# The Studio — Mive Product Redesign

**Date**: 2026-02-20
**Status**: Approved
**Tagline**: "Think deeper. Write better."

## Vision

Mive becomes a *writing studio* — a space where the writer enters to work, with an ambient AI presence that adapts to their rhythm. Creativity is the experience, productivity is invisible infrastructure. The product serves anyone who writes seriously, regardless of genre.

## Core Principles

1. **The writer's focus is sacred** — everything that isn't the text should earn its screen space
2. **AI is a presence, not a panel** — it lives in the flow, from ghost text to conversation
3. **Structure supports, never competes** — folders, versions, exports work silently behind the craft
4. **The space adapts to the rhythm** — the UI responds to what the writer is doing, not the other way around

---

## 1. Focus Mode (Immersive Writing)

When the writer is writing, everything else fades away.

### Behavior
- **Auto-activation**: after 3 seconds of continuous writing without interacting with sidebar or assistant, all panels fade out (250ms ease-out). The topbar reduces to a minimal transparent line (doc title + save status + AI level indicator).
- **Manual activation**: `Cmd+Shift+F` (or configurable shortcut) to toggle instantly.
- **Exit**: mouse to left edge reveals sidebar (dock-style). Mouse to right edge reveals assistant. Click or shortcut pins them back. Resume writing → 3s → immersive again.
- **Editor "breathes"**: on entering focus mode, editor max-width expands subtly (720px → ~780px), font-size increases +1px. On exit, returns. Transition is ~300ms — nearly imperceptible but *felt*.

### Technical Notes
- CSS transitions on panel width/opacity, not JS animation
- `mive:focus-mode` preference in localStorage (auto/manual/off)
- Topbar has two states: full and minimal, controlled by a CSS class

---

## 2. AI Inline (Suggestions in the Flow)

The AI can appear *inside* the document as a subtle presence, complementing the assistant panel for quick interactions.

### Ghost Text (Pause Trigger)
- Writer stops typing for ~2 seconds at end of paragraph or mid-sentence → ghost suggestion appears (gray text, Copilot-style) with a possible continuation.
- **Tab** to accept, keep writing to dismiss.
- Minimum unit is a sentence, not a word — this is idea suggestion, not autocomplete.

### Contextual Selection
- Existing selection toolbar is enriched: beyond "Ask AI", commands become contextual — "Strengthen" on weak paragraphs, "Add subtext" on dialogue, etc.
- Context-awareness based on surrounding content and document structure.

### Inline Prompt (Cmd+J)
- Opens a floating one-line text input below cursor.
- Writer types a specific instruction ("make this more concise", "add a metaphor here").
- Response appears as inline diff (green/red), accept or reject.

### Intensity Levels
Three-position control (in topbar or settings):

| Level | Behavior |
|-------|----------|
| **Silent** | AI only responds when explicitly invoked (selection toolbar, Cmd+J, or chat). Zero proactive suggestions. |
| **Active** | Ghost text on pause + contextual suggestions in selection toolbar. Presence without intrusion. |
| **Co-author** | Active suggestions — continuations, alternatives, margin notes ("This contradicts what you said in Chapter 2"). Maximum collaboration. |

Saved to `mive:ai-intensity` in localStorage.

---

## 3. Dark Mode & Visual Identity

### Dark Mode (Designed, Not Inverted)
- **Background**: warm deep gray (`~#1a1a18`), not pure black
- **Surfaces**: `~#222220`, borders `rgba(255,255,255,0.08)`
- **Typography adjustment**: font-weight reduces slightly in dark mode (light-on-dark text appears heavier), line-height increases ~0.05
- **Same CSS tokens** (`--text-1`, `--surface`, `--canvas`) swap via `prefers-color-scheme` or manual toggle
- **Toggle**: in settings + topbar. Respects system preference by default. Saved to `mive:theme`.
- **Transition**: light↔dark is a smooth 300ms transition on all CSS variables, not an instant flash.

### Typography — Giving Mive a Voice
- **Display font**: a serif or characterful sans for the brand — used in logo, landing headings, UI section titles, empty states. NOT Inter. Candidates to explore: Instrument Serif, Fraunces, Gambetta, Satoshi, General Sans.
- **Body font**: clean sans for UI stays. Editor font is writer's choice (sans, serif, mono — configurable).
- **The editor belongs to the writer**: Mive suggests a beautiful default but lets them choose.

### Transitions
- Panels enter/exit with `ease-out` 250ms
- Opening a document: title fades in first (100ms), then content (200ms, 50ms stagger) — like opening a book
- Assistant panel resize has a subtle spring feel — physical, not mechanical

---

## 4. Agents with Personality

### From Configurations to Characters
Agents go beyond name + system prompt + temperature. They have *presence* — expressed in how they write and what they prioritize, not in how they look.

### Pre-installed Agents (Opinionated)
| Agent | Role | Personality |
|-------|------|-------------|
| **The Mirror** | Reflects back what you wrote, reformulated, so you see if you said what you meant. Doesn't suggest — reflects. | Neutral, precise, Socratic |
| **The Challenger** | Questions your ideas. "Do you really believe this? What would someone who disagrees say?" | Provocative, intellectual, devil's advocate |
| **The Polisher** | Pure editing. Cuts, adjusts, tightens. Doesn't opine on content — only on craft. | Terse, surgical, economical |
| **The Explorer** | Expands. Brings references, connections, tangential ideas. "This reminds me of..." | Curious, associative, expansive |

### Custom Agents
Users can still create their own with system prompt, temperature, provider selection. Pre-installed agents are a starting point with character.

### Visual Indicator
When switching agents, a subtle change in the assistant panel — perhaps the composer border color or an accent color associated with the active agent. Nothing loud — a detail.

---

## 5. Repositioning & Copy

### Narrative Shift
From "tool with features" to "space for thinking."

- **Tagline**: "Think deeper. Write better."
- **Language**: eliminate productivity jargon ("command center", "boost your workflow"). Use craft and space language: "your studio", "your process", "your ideas", "writing session".
- **Empty states**: "Your studio is ready. What are you working on?" not "No documents yet. Create one!"
- **Onboarding**: not a feature tour. A question: "What are you working on?" → project creates around the answer.

### Landing Page
- **Hero**: the editor in immersive mode (dark mode), with a ghost text line from AI appearing. Feels like watching someone write in their studio.
- **Not a feature checklist**: show 2-3 real moments — "writing", "getting AI feedback", "publishing". Narrative, not bullet points.
- **Social proof**: oriented toward writers, not "teams" or "productivity".

---

## 6. Layout & Flow Changes

### Default State (Changed)
| Zone | Before | After |
|------|--------|-------|
| **Left sidebar** (outline/folders) | Open, 220px | **Collapsed** — icon rail only. Hover/click expands. |
| **Editor** (center) | 720px centered | Same, but shifts left when assistant is open. Expands in focus mode. |
| **Assistant panel** (AI, right) | Open by default | **Open by default** (stays — AI is a companion, not optional) |

### Focus Mode State
- Both sidebar and assistant fade out
- Topbar becomes minimal transparent line
- Only the text remains

### Typical Writer Flow
```
Opens Mive → sees project (sidebar icon rail) + assistant open
  → clicks document → sidebar stays collapsed, editor centered with assistant
    → starts writing → 3s later, focus mode activates
      → pauses → ghost text appears (if AI on "active" or "co-author")
        → Tab to accept, or keeps writing
      → selects text → contextual toolbar
        → Cmd+J → inline prompt → response as diff
      → moves mouse to right edge → assistant reappears
        → chats with active agent about the text
      → back to writing → 3s → immersive again
```

### What Disappears
- The feeling of "3 open panels competing for attention"
- The heavy topbar as permanent element
- The need to click toggles to "clean up" the interface

---

## Summary of Changes by Area

| Area | Change Type | Complexity |
|------|------------|------------|
| Focus Mode | New feature | Medium — CSS transitions + state management |
| AI Ghost Text | New feature | High — ProseMirror decorations + streaming |
| AI Inline Prompt (Cmd+J) | New feature | High — floating input + diff rendering |
| AI Intensity Levels | New feature | Medium — settings + conditional behavior |
| Dark Mode | New feature | Medium — CSS variable theming |
| Display Typography | Visual change | Low — font selection + CSS |
| Transitions/Animations | Visual change | Low-Medium — CSS transitions |
| Agent Personalities | Content + UI | Low-Medium — system prompts + subtle UI |
| Copy/Positioning | Content change | Low — text changes |
| Layout Defaults | Config change | Low — default state changes |
| Landing Page | Redesign | Medium — new hero + narrative |
