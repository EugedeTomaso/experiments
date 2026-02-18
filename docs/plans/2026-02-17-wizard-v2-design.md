# Wizard v2 — Typeform-style with AI Autocomplete

## Summary

Redesign the ProjectWizard from a multi-step form into a Typeform-style experience with 2-4 screens max. Add inline ghost text autocomplete (TAB to accept) powered by a fast AI model via OpenRouter.

## Goals

- Reduce wizard to 2-4 screens (from 5-6)
- One question per screen with slide vertical transitions
- AI inline autocomplete on all textareas
- AI-generated follow-up questions only when needed
- Structure generated in background, no preview step

## Flow

```
Screen 1: "What are you creating?"
    - Textarea with ghost text autocomplete
    - Template pills below divider (Novel, Screenplay, etc.)
    - "Start with an empty project" link
    - [Continue] button (Cmd+Enter shortcut)

    Template click → pre-fills textarea with "A novel about " (cursor at end)
    Empty project → jumps to name screen, creates empty project

Screen 2+ (conditional, 0-2 screens):
    - AI evaluates description → decides if follow-ups needed
    - Each follow-up is a separate screen (Typeform-style)
    - Choice questions: buttons, auto-advance on click
    - Open questions: textarea with autocomplete

Screen final: "Name your project"
    - Input with AI-suggested ghost text name
    - TAB accepts suggestion
    - [Create project] button (Enter shortcut)
    - Structure generates in background while user is here
```

## Ghost Text Autocomplete

### UX
- User types in any textarea
- After 300ms debounce, send text to fast AI model
- Ghost text appears inline (var(--text-4), italic) continuing from cursor
- TAB accepts full suggestion
- Esc or continuing to type dismisses
- Only complete current sentence/phrase, not paragraphs

### Visual
```
[A sci-fi novel about time travel, set in] 2145, where a physicist discovers...
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           ghost text (gray, italic)
```

### Model
- GPT-4.1 Nano via OpenRouter (`openai/gpt-4.1-nano`)
- ~$0.10/M input tokens, sub-200ms latency
- Hardcoded in backend, not user-configurable

### Endpoint
- `POST /api/ai/autocomplete`
- Body: `{ "text": "...", "context": "project_description" }`
- Response: plain text completion (not streaming)
- System prompt: "Complete the user's sentence about their writing project. Output ONLY the completion text. Keep it short."

## Follow-up Evaluation

### Prompt
AI evaluates description and responds with:
- `{"needsFollowUp": false}` → skip to name screen
- `{"needsFollowUp": true, "questions": [...]}` → show follow-up screens

### Model
Uses the user's default agent (needs reasoning capability).

### Questions Format
```json
[
  {
    "question": "What's the scope?",
    "type": "choice",
    "options": ["Novella", "Standard Novel", "Saga"]
  },
  {
    "question": "What genre?",
    "type": "text",
    "placeholder": "E.g., sci-fi, fantasy, literary..."
  }
]
```

Max 2 questions. Prefer choice type with 2-4 options.

## Name Suggestion

- When name screen appears, call nano model with description
- Ghost text appears in name input
- TAB accepts, or user types their own

## Structure Generation

- Starts in background when user reaches name screen
- Uses user's default agent (same prompt logic as current wizard)
- If structure ready when user clicks "Create" → instant creation
- If still generating → show success animation + "Creating project..."
- No preview/edit step — user sees structure after project creation

## Transitions

- Slide vertical: current screen slides up + fades, new screen enters from below
- Same animation for forward and reverse (inverted for back)
- Duration: ~250ms ease-out

## Layout

- Full screen, canvas background
- Content centered vertically, max-width ~520px
- No progress dots (flow too short to need them)
- Close (X) button top-right
- Back button appears from screen 2 onward
- Keyboard: Enter/Cmd+Enter advances, Esc goes back/closes

## Technical Changes

| Component | Change |
|---|---|
| Backend | New `POST /api/ai/autocomplete` endpoint — nano model, plain text response |
| Backend | New follow-up evaluation prompt in structure generation flow |
| Frontend | `useAutoComplete` hook — debounce, API call, ghost text render, TAB handling |
| Frontend | Rewrite `ProjectWizard.jsx` — typeform flow, slide transitions, conditional follow-ups |
| Frontend | New CSS animations (slide up/down), ghost text styling |
| OpenRouter | Already integrated — use `openai/gpt-4.1-nano` for autocomplete |

## Templates

Kept as quick shortcuts. Pre-fill the description textarea:
- Novel → "A novel about "
- Short Story → "A short story about "
- Screenplay → "A screenplay about "
- TV Series → "A TV series about "
- YouTube/Video → "A video about "
- Article/Essay → "An article about "
- Academic → "A research paper on "
- Product/Work → "A product brief for "
