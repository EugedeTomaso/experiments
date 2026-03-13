# Landing Page + Wizard Redesign — Design

**Date**: 2026-02-21
**Status**: Approved
**Supersedes**: `2026-02-20-landing-page-design.md` (landing page section)

---

## Positioning

**Audience**: Knowledge workers — PMs, founders, consultants, researchers, writers. Not a niche writing tool.

**Narrative**: The problem is fragmentation. You use AI in a chat, copy output to a doc, edit there, feed it back to AI, get comments, repeat. You are the glue between your tools. Mive unifies structure, writing, and AI in one place with full context.

**Functional anchor**: Mive is a word processor reimagined for the AI era.

**Tone**: Intellectual and provocative. Asks questions, challenges how people work today. Not feature-listy, not salesy.

**Competitive frame**: Replaces the combination of Google Docs + ChatGPT/Claude chat + scattered notes. None of those tools see the full picture — Mive does.

---

## Landing Page

Three acts, like an argument.

### Act 1 — Hero (full viewport, copy-first)

Clean canvas background. Nothing competes with the text.

- Logo: Mive, top-left, small, no nav links
- Background: Subtle animated SVG — thin lines converging from scattered points toward a center. Fragments unifying. Very subtle, almost a living texture. Slow movement, adds depth without distracting from copy.

**Copy** (Instrument Serif, large, centered):

> *You think in fragments.*
> *You are the glue between your tools. You shouldn't have to be.*

Below, smaller, in sans-serif:

> *What if everything lived in one place — and it understood what you're writing?*

Single CTA: **"Try Mive"** — minimal button.

On scroll, hero text fades up and out.

### Act 2 — The Product (scroll reveal)

The editor appears with a smooth animation — a composed visual of the three-zone layout:

- Left sidebar with a project tree (collapsed to icons)
- Center editor with real text (not lorem ipsum — a fragment that could be a spec, an essay, or a chapter)
- Right panel with an AI conversation referencing the text

Not interactive — a well-choreographed image/composition.

Below, three functional points connected by **animated SVG connectors** that draw themselves on scroll — lines linking the three points, suggesting an integrated system:

| Point | Copy |
|-------|------|
| **Structure** | Your project isn't a single file. It's a tree of ideas, chapters, sections — all connected. |
| **Context** | The AI has read everything. It doesn't ask you to paste — it already knows. |
| **Revision** | Inline review, comments, versioning. Your thinking has a history. |

No generic icons. Pure typography, strong hierarchy.

### Act 3 — Close

Another provocative phrase:

> *Word processors were designed for printers.*
> *This one was designed for thinking.*

Final CTA: **"Start for free"**

Minimal footer: logo, legal links, changelog link.

---

## Welcome Screen (first use, replaces 7-step walkthrough)

**Animated SVG**: Abstract shapes — geometric forms reorganizing smoothly. Lines and nodes connecting, rearranging, forming different structures. Not literal (not a file tree), but a visual metaphor for adaptability. Warm grays with a subtle accent color touch. Infinite loop, organic slow movement.

**Copy**:

> *"Mive shapes itself around what you're making."*
> *"Describe your project and it builds the structure. You change anything, anytime."*

Button: **"Start a project"**

No feature tour, no slideshow. Features are discovered by using the product.

---

## Wizard (3 steps, down from 7)

### Step 1 — Shape

> *"What are you working on?"*

5 functional categories (replacing 13 literary genres):

| Shape | Short description | Who uses it |
|-------|-------------------|-------------|
| **Document** | A single text, start to finish | Essays, specs, memos, posts |
| **Project** | Multiple documents organized in a tree | Books, documentation, courses |
| **Research** | Collect, analyze, synthesize sources | Papers, investigations, analysis |
| **Script** | Structured format with scenes/acts | Screenplays, podcasts, videos |
| **Freeform** | Blank space, no predefined structure | Brainstorms, notes, journals |

5 cards with name + short description. Typography-driven, minimal or no icons.

### Step 2 — Context

> *"Give it a name and some direction."*

- Title field
- Optional textarea: "Describe what this is about — the AI will use this to help you."
- Future toggle: "I have existing material to bring in"

### Step 3 — Structure (Project and Research only)

> *"Here's a starting structure. Change anything."*

AI generates folder/document tree based on description. User can edit, reorder, remove items.

Document, Script, and Freeform skip this step — go straight to the editor.

---

## Animated SVGs Summary

| Location | Description | Motion |
|----------|-------------|--------|
| **Hero background** | Thin lines converging from scattered points to center — fragments unifying | Very subtle, ambient, slow |
| **Act 2 connectors** | Lines drawing between Structure/Context/Revision on scroll | Scroll-triggered, draws once |
| **Welcome screen** | Geometric shapes reorganizing — nodes connecting, rearranging into different structures | Infinite loop, organic, slow |

All SVGs use the warm gray palette (`--canvas`, `--text-4`, `--border-subtle`) with optional subtle accent touch. No bright colors, no generic illustrations.

---

## Aesthetic Direction

- **Typography-first**: Instrument Serif for display/hero, sans-serif (Inter) for body
- **Warm grays**: Existing design system palette (`--canvas: #f7f7f5`)
- **Generous negative space**: Let copy breathe
- **No decorative elements**: SVGs are meaningful, not ornamental
- **Subtle motion**: Fade-up on scroll, smooth step transitions in wizard
- **No generic icons**: Typography as the primary visual element
