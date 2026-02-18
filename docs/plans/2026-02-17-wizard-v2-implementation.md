# Wizard v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the ProjectWizard as a Typeform-style flow (one question per screen, slide transitions) with inline ghost text AI autocomplete on all textareas.

**Architecture:** Backend gets a new lightweight `/api/ai/autocomplete` endpoint that calls GPT-4.1 Nano via OpenRouter (already integrated). Frontend gets a `useGhostComplete` hook for inline autocomplete, and `ProjectWizard.jsx` is rewritten with a screen-based state machine (description → conditional follow-ups → name). Structure generation happens in background with no preview step.

**Tech Stack:** Django REST Framework, React 18.2, OpenRouter API (GPT-4.1 Nano), CSS animations

---

### Task 1: Backend — Autocomplete endpoint

**Files:**
- Modify: `backend/core/llm.py` (add `generate_autocomplete_sync` function)
- Modify: `backend/core/views.py` (add `AIAutocompleteView`)
- Modify: `backend/core/urls.py` (add route)

**Step 1: Add autocomplete function to llm.py**

Add this after the `generate_summary_sync` function (around line 36) in `backend/core/llm.py`:

```python
AUTOCOMPLETE_SYSTEM_PROMPT = (
    "Complete the user's sentence about their writing project. "
    "Output ONLY the completion text — no quotes, no explanation, no markdown. "
    "Complete the current thought in 10-30 words. Do not repeat what the user already wrote."
)

AUTOCOMPLETE_MODEL = "openai/gpt-4.1-nano"
AUTOCOMPLETE_PROVIDER = "openrouter"


def generate_autocomplete_sync(api_key: str, text: str, context: str = "") -> str:
    """Call GPT-4.1 Nano via OpenRouter for fast inline autocomplete."""
    config = PROVIDERS[AUTOCOMPLETE_PROVIDER]
    user_content = text
    if context:
        user_content = f"[Context: {context}]\n\n{text}"

    messages = [
        {"role": "system", "content": AUTOCOMPLETE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return _sync_openai_compatible(api_key, config["base_url"], AUTOCOMPLETE_MODEL, messages)
```

Note: reuse the existing `_sync_openai_compatible` but it currently hardcodes `max_tokens: 256` and `temperature: 0.3` which are fine for autocomplete.

**Step 2: Add AIAutocompleteView to views.py**

Add after the `AIStreamView` class (around line 341) in `backend/core/views.py`:

```python
class AIAutocompleteView(APIView):
    def post(self, request):
        text = request.data.get("text", "").strip()
        if not text:
            return Response({"detail": "text is required"}, status=400)

        context = request.data.get("context", "")

        # Always use the hardcoded OpenRouter key for autocomplete
        from .llm import AUTOCOMPLETE_PROVIDER
        provider_key = ProviderKey.objects.filter(provider=AUTOCOMPLETE_PROVIDER).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(AUTOCOMPLETE_PROVIDER)
        if not api_key:
            return Response({"detail": "OpenRouter key missing"}, status=400)

        try:
            from .llm import generate_autocomplete_sync
            completion = generate_autocomplete_sync(api_key, text, context)
            return Response({"completion": completion})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)
```

**Step 3: Add URL route**

In `backend/core/urls.py`, add the import and route:

```python
# In the imports from .views, add AIAutocompleteView
from .views import (
    AIAutocompleteView,
    AICommentReplyView,
    # ... rest of existing imports
)

# In urlpatterns, add after the ai/comment-reply line:
path("api/ai/autocomplete", AIAutocompleteView.as_view(), name="ai-autocomplete"),
```

**Step 4: Copy to Docker mount and test**

```bash
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
```

Test with curl:
```bash
TOKEN=$(curl -s http://localhost:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","password":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

curl -s http://localhost:8000/api/ai/autocomplete \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"A sci-fi novel about time travel, set in","context":"project_description"}' | python3 -m json.tool
```

Expected: JSON with `{"completion": "..."}` containing a short sentence completion.

**Step 5: Commit**

```bash
git add backend/core/llm.py backend/core/views.py backend/core/urls.py
git commit -m "feat: add /api/ai/autocomplete endpoint for inline ghost text"
```

---

### Task 2: Frontend — `useGhostComplete` hook

**Files:**
- Create: `frontend/src/hooks/useGhostComplete.js`
- Modify: `frontend/src/api.js` (add `autocomplete` method)

**Step 1: Add autocomplete to api.js**

In `frontend/src/api.js`, add this method inside the `api` object (after `fetchLinkPreview`):

```javascript
  // AI Autocomplete
  autocomplete(text, context = "") {
    return request("/api/ai/autocomplete", {
      method: "POST",
      body: JSON.stringify({ text, context }),
    });
  },
```

**Step 2: Create the useGhostComplete hook**

Create `frontend/src/hooks/useGhostComplete.js`:

```javascript
import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "../api";

/**
 * Ghost text autocomplete hook for textareas.
 *
 * Returns:
 * - ghostText: the suggested completion (render as gray overlay)
 * - acceptGhost: call on TAB to accept the suggestion
 * - dismissGhost: call to clear the suggestion
 * - onInput: attach to textarea's onInput (triggers debounced fetch)
 *
 * Usage:
 *   const { ghostText, acceptGhost, dismissGhost, onInput } = useGhostComplete({
 *     value, setValue, context: "project_description"
 *   });
 */
export function useGhostComplete({ value, setValue, context = "", debounceMs = 300, minLength = 10 }) {
  const [ghostText, setGhostText] = useState("");
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const snapshotRef = useRef("");

  // Dismiss ghost text
  const dismissGhost = useCallback(() => {
    setGhostText("");
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Accept ghost text
  const acceptGhost = useCallback(() => {
    if (!ghostText) return false;
    setValue((prev) => prev + ghostText);
    setGhostText("");
    return true;
  }, [ghostText, setValue]);

  // Trigger autocomplete on input
  const onInput = useCallback(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissGhost();

    timerRef.current = setTimeout(async () => {
      const text = value;
      if (!text || text.length < minLength) return;

      // Don't autocomplete if text ends with a newline (user just pressed enter)
      if (text.endsWith("\n")) return;

      snapshotRef.current = text;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await api.autocomplete(text, context);
        // Only apply if value hasn't changed since we sent the request
        if (snapshotRef.current === text && !controller.signal.aborted) {
          const completion = data.completion || "";
          if (completion) {
            setGhostText(completion);
          }
        }
      } catch {
        // Silently ignore autocomplete errors
      }
    }, debounceMs);
  }, [value, context, debounceMs, minLength, dismissGhost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { ghostText, acceptGhost, dismissGhost, onInput };
}
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGhostComplete.js frontend/src/api.js
git commit -m "feat: add useGhostComplete hook and autocomplete API method"
```

---

### Task 3: Frontend — `GhostTextarea` component

**Files:**
- Create: `frontend/src/components/GhostTextarea.jsx`
- Modify: `frontend/src/App.css` (add ghost textarea styles)

**Step 1: Create the GhostTextarea component**

This wraps a textarea with a ghost text overlay. Create `frontend/src/components/GhostTextarea.jsx`:

```jsx
import { useRef, useEffect, useCallback } from "react";
import { useGhostComplete } from "../hooks/useGhostComplete";

/**
 * Textarea with inline ghost text autocomplete.
 * Shows gray completion text after the user's input.
 * TAB accepts, Esc or typing dismisses.
 */
export function GhostTextarea({ value, onChange, context, className = "", ...props }) {
  const textareaRef = useRef(null);

  const setValue = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(value) : updater;
    onChange(next);
  }, [value, onChange]);

  const { ghostText, acceptGhost, dismissGhost, onInput } = useGhostComplete({
    value,
    setValue,
    context,
  });

  // Trigger autocomplete when value changes (from user typing)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      onInput();
    }
  }, [value, onInput]);

  const handleKeyDown = (e) => {
    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      acceptGhost();
      // Move cursor to end after accepting
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.selectionStart = ta.value.length;
          ta.selectionEnd = ta.value.length;
        }
      }, 0);
    } else if (e.key === "Escape" && ghostText) {
      e.preventDefault();
      dismissGhost();
    }

    // Forward other key events
    if (props.onKeyDown) props.onKeyDown(e);
  };

  return (
    <div className="ghost-textarea-wrapper">
      <textarea
        ref={textareaRef}
        className={`ghost-textarea ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {ghostText && (
        <div className="ghost-textarea-overlay" aria-hidden="true">
          <span className="ghost-textarea-real">{value}</span>
          <span className="ghost-textarea-ghost">{ghostText}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add CSS for ghost textarea**

Add these styles to `frontend/src/App.css` (at the end, before the responsive media queries section for wizard if any — or at the end of the wizard CSS block around line 7475):

```css
/* --- Ghost Textarea --- */
.ghost-textarea-wrapper {
  position: relative;
}
.ghost-textarea-wrapper .ghost-textarea {
  position: relative;
  z-index: 1;
  background: transparent;
  caret-color: var(--text-1);
}
.ghost-textarea-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  padding: 12px;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
}
.ghost-textarea-real {
  visibility: hidden;
}
.ghost-textarea-ghost {
  color: var(--text-4);
  font-style: italic;
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/GhostTextarea.jsx frontend/src/App.css
git commit -m "feat: add GhostTextarea component with inline ghost text"
```

---

### Task 4: Frontend — Rewrite ProjectWizard (screen state machine)

**Files:**
- Modify: `frontend/src/components/ProjectWizard.jsx` (full rewrite)

This is the biggest task. The wizard becomes a state machine with these screens:
- `describe` — Description textarea + template pills
- `followup-N` — Dynamic follow-up questions (0-2 screens)
- `name` — Name input with ghost text

**Step 1: Rewrite ProjectWizard.jsx**

Replace the entire content of `frontend/src/components/ProjectWizard.jsx` with the new implementation. Key changes:

1. **State machine**: `screen` state tracks current screen (`"describe"`, `"followup-0"`, `"followup-1"`, `"name"`)
2. **Transitions**: CSS class `wizard-screen` with `slide-up` / `slide-down` animations
3. **GhostTextarea**: Used for description, follow-up text answers
4. **Follow-up evaluation**: After description submit, call AI to check if follow-ups needed
5. **Background structure generation**: Starts when entering name screen
6. **Template pills**: Pre-fill description textarea
7. **Name ghost text**: Call nano model for name suggestion

The component should keep these data constants from the old file (still needed for structure generation prompts):
- `PROJECT_TYPES` (for template labels)
- `EXTENSION_PROMPTS` (used by structure generation)
- `EXTENSION_SIZES` (used by structure generation)
- `FALLBACK_STRUCTURES` (used as fallback when AI fails)

Remove everything related to:
- Multi-step numbered flow (steps 1-6)
- Extension selection screen
- Material selection screen
- Structure preview/edit screen
- Progress dots
- `StructureItem` component

New simplified structure:

```jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { getAuthHeader } from "../api";
import { GhostTextarea } from "./GhostTextarea";

const TEMPLATE_PREFILLS = {
  novel: "A novel about ",
  "short-story": "A short story about ",
  screenplay: "A screenplay about ",
  "tv-series": "A TV series about ",
  youtube: "A video about ",
  article: "An article about ",
  academic: "A research paper on ",
  product: "A product brief for ",
};

const TEMPLATE_LABELS = [
  { id: "novel", label: "Novel" },
  { id: "short-story", label: "Short Story" },
  { id: "screenplay", label: "Screenplay" },
  { id: "tv-series", label: "TV Series" },
  { id: "youtube", label: "YouTube / Video" },
  { id: "article", label: "Article / Essay" },
  { id: "academic", label: "Academic" },
  { id: "product", label: "Product / Work" },
];

// Keep FALLBACK_STRUCTURES, EXTENSION_PROMPTS, EXTENSION_SIZES from old file
// (they're used by the structure generation prompt sent to the AI)

export function ProjectWizard({ onComplete, onCancel, defaultAgent, apiBase }) {
  const [screen, setScreen] = useState("describe"); // "describe" | "followup-0" | "followup-1" | "name"
  const [direction, setDirection] = useState("forward");
  const [description, setDescription] = useState("");
  const [followUps, setFollowUps] = useState([]); // AI-generated questions
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [projectName, setProjectName] = useState("");
  const [nameSuggestion, setNameSuggestion] = useState(""); // ghost text for name
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [structurePromise, setStructurePromise] = useState(null);
  const nameInputRef = useRef(null);

  const goForward = (s) => { setDirection("forward"); setScreen(s); };
  const goBackward = (s) => { setDirection("backward"); setScreen(s); };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (screen === "describe") onCancel();
        else if (screen === "name") goBackward(followUps.length > 0 ? `followup-${followUps.length - 1}` : "describe");
        else if (screen.startsWith("followup-")) {
          const idx = parseInt(screen.split("-")[1]);
          goBackward(idx === 0 ? "describe" : `followup-${idx - 1}`);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [screen, followUps, onCancel]);

  // Focus name input when reaching name screen
  useEffect(() => {
    if (screen === "name" && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 260);
    }
  }, [screen]);

  // --- Handlers ---

  const handleDescriptionContinue = async () => {
    if (!description.trim()) return;
    setIsEvaluating(true);
    goForward("evaluating");

    try {
      // Call AI to evaluate if follow-ups are needed
      const result = await evaluateFollowUps(description, defaultAgent, apiBase);

      if (result.needsFollowUp && result.questions?.length > 0) {
        setFollowUps(result.questions.slice(0, 2));
        setIsEvaluating(false);
        goForward("followup-0");
      } else {
        setFollowUps([]);
        setIsEvaluating(false);
        startNameScreen();
      }
    } catch {
      // On error, skip follow-ups and go to name
      setFollowUps([]);
      setIsEvaluating(false);
      startNameScreen();
    }
  };

  const handleFollowUpContinue = (idx) => {
    if (idx < followUps.length - 1) {
      goForward(`followup-${idx + 1}`);
    } else {
      startNameScreen();
    }
  };

  const startNameScreen = () => {
    // Start structure generation in background
    const promise = generateStructureInBackground();
    setStructurePromise(promise);

    // Fetch name suggestion
    fetchNameSuggestion();

    goForward("name");
  };

  const handleTemplatePick = (templateId) => {
    const prefill = TEMPLATE_PREFILLS[templateId] || "";
    setDescription(prefill);
    // Focus textarea so user can continue typing
    // (textarea ref would be needed here)
  };

  const handleEmptyProject = () => {
    setDescription("");
    setFollowUps([]);
    setProjectName("");
    setNameSuggestion("");
    goForward("name");
  };

  const handleNameTab = (e) => {
    if (e.key === "Tab" && nameSuggestion && !projectName) {
      e.preventDefault();
      setProjectName(nameSuggestion);
      setNameSuggestion("");
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setShowSuccess(true);

    let structure = [];
    if (structurePromise) {
      try {
        structure = await structurePromise;
      } catch {
        structure = [];
      }
    }

    await new Promise((r) => setTimeout(r, 600)); // success animation
    await onComplete({
      name: projectName.trim() || nameSuggestion || "Untitled",
      type: "custom",
      structure,
      description,
    });
    setIsCreating(false);
  };

  // ... AI helper functions (evaluateFollowUps, generateStructureInBackground, fetchNameSuggestion)
  // These reuse the existing streaming pattern from the old wizard

  const screenClass = `wizard-screen ${direction === "backward" ? "slide-down" : "slide-up"}`;

  return (
    <div className="wizard">
      {/* Close button */}
      {/* Screen content based on `screen` state */}
      {/* Each screen wrapped in <div className={screenClass} key={screen}> */}
    </div>
  );
}
```

The full implementation of the AI helper functions (`evaluateFollowUps`, `generateStructureInBackground`, `fetchNameSuggestion`) should reuse the SSE streaming pattern from the old `generateStructure` and `generateQuestions` functions in the current wizard, adapting the prompts per the design doc.

**Step 2: Verify it renders**

```bash
cd frontend && npm run dev
```

Open http://localhost:5174, create a new project, verify the wizard loads with the new flow.

**Step 3: Commit**

```bash
git add frontend/src/components/ProjectWizard.jsx
git commit -m "feat: rewrite ProjectWizard as typeform-style flow with AI autocomplete"
```

---

### Task 5: Frontend — CSS transitions and wizard styling

**Files:**
- Modify: `frontend/src/App.css` (replace wizard CSS section)

**Step 1: Replace wizard animation CSS**

Find the existing wizard step animations (around line 6750-6770 in App.css) and replace:

Old:
```css
@keyframes wizard-step-in { ... }
@keyframes wizard-step-in-backward { ... }
.wizard-step { ... }
.wizard-step.backward { ... }
```

New:
```css
@keyframes wizard-slide-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes wizard-slide-down {
  from { opacity: 0; transform: translateY(-24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.wizard-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wizard-screen.slide-up {
  animation: wizard-slide-up 250ms ease-out both;
}
.wizard-screen.slide-down {
  animation: wizard-slide-down 250ms ease-out both;
}
```

**Step 2: Clean up removed CSS**

Remove CSS for components that no longer exist:
- `.wizard-progress`, `.wizard-progress-dot` (no progress dots)
- `.wizard-structure-list`, `.wizard-structure-item`, `.wizard-check` (no structure preview)
- `.wizard-item-icon`, `.wizard-item-title`, `.wizard-item-rename` (no structure items)
- `@keyframes wizard-item-in` (no item animation)

Keep CSS for:
- `.wizard`, `.wizard-body`, `.wizard-close-wrapper`, `.wizard-close-btn`
- `.wizard-heading`, `.wizard-subheading`
- `.wizard-template-divider`, `.wizard-template-grid`, `.wizard-template-pill`
- `.wizard-freeform-link`
- `.wizard-back`
- `.wizard-textarea`, `.wizard-name-input`
- `.wizard-actions`
- `.wizard-success`, `.wizard-success-circle`, `.wizard-success-text`
- `.wizard-generating`, `.wizard-skeleton`
- `.wizard-question-*` classes (still used for follow-ups)

**Step 3: Add evaluating screen CSS**

```css
.wizard-evaluating {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  gap: 16px;
}
.wizard-evaluating-text {
  font-size: 14px;
  color: var(--text-3);
}
```

**Step 4: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: update wizard CSS for typeform transitions and ghost text"
```

---

### Task 6: Integration testing

**Files:**
- Modify: `frontend/tests/wizard-step1.spec.js` (update for new flow)

**Step 1: Update existing wizard tests**

The existing `wizard-step1.spec.js` tests the old multi-step flow. Update it to test:
1. Wizard opens with description textarea and template pills
2. Template click pre-fills textarea
3. Typing in textarea and clicking Continue advances
4. Name screen appears after follow-up evaluation
5. Creating project works with name input
6. Empty project shortcut works
7. Esc closes from description screen

**Step 2: Run tests**

```bash
cd frontend && npx playwright test tests/wizard-step1.spec.js
```

**Step 3: Commit**

```bash
git add frontend/tests/wizard-step1.spec.js
git commit -m "test: update wizard e2e tests for typeform flow"
```

---

### Task 7: Copy backend to Docker mount and verify end-to-end

**Step 1: Copy all backend changes**

```bash
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
```

**Step 2: Restart backend container**

```bash
docker restart experiments-backend-1
```

**Step 3: Manual end-to-end test**

1. Open http://localhost:5174
2. Click "New Project"
3. Verify description screen with template pills
4. Type a description, verify ghost text autocomplete appears after pause
5. Press TAB to accept ghost text
6. Click Continue — verify follow-up question or direct to name
7. Verify name screen with ghost text suggestion
8. Create project — verify it's created with AI-generated structure

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end wizard fixes after integration testing"
```
