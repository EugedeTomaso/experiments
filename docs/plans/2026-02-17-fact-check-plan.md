# Fact-Check Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline fact-checking that verifies document claims against web sources via Exa, displaying results as streaming inline comments with verdicts, sources, and corrections.

**Architecture:** Two-step backend pipeline (LLM claim extraction → Exa search + LLM verdict per claim) streamed via SSE. Extends existing Comment model with `comment_type`, `verdict`, `sources` fields. Frontend reuses comment decoration system with verdict-colored highlights.

**Tech Stack:** Django/DRF (backend), Exa Search API (web search), httpx (HTTP client), React (frontend), ProseMirror decorations (highlights), SSE/EventSource (streaming)

---

### Task 1: Extend Comment Model

**Files:**
- Modify: `backend/core/models.py` (Comment class, ~line 125)
- Create: `backend/core/migrations/0012_comment_fact_check_fields.py` (auto-generated)

**Step 1: Add fields to Comment model**

In `backend/core/models.py`, add these fields to the `Comment` class after `position_to` (line ~152):

```python
class CommentType(models.TextChoices):
    COMMENT = "comment", "Comment"
    REVIEW = "review", "Review"
    FACT_CHECK = "fact_check", "Fact Check"

class Verdict(models.TextChoices):
    VERIFIED = "verified", "Verified"
    DUBIOUS = "dubious", "Dubious"
    FALSE = "false", "False"

comment_type = models.CharField(
    max_length=20, choices=CommentType.choices, default=CommentType.COMMENT
)
verdict = models.CharField(
    max_length=20, choices=Verdict.choices, null=True, blank=True
)
sources = models.JSONField(null=True, blank=True)
```

**Step 2: Generate and run migration**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

Expected: Migration `0012_comment_fact_check_fields.py` created and applied.

**Step 3: Update CommentSerializer**

In `backend/core/serializers.py`, add the new fields to `CommentSerializer.Meta.fields` (line ~130):

Add `"comment_type"`, `"verdict"`, `"sources"` to the fields list.

**Step 4: Copy files to Docker mount and re-run migration**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/migrations/0012_*.py /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 5: Commit**

```bash
git add backend/core/models.py backend/core/serializers.py backend/core/migrations/0012_*
git commit -m "feat: add comment_type, verdict, sources fields to Comment model"
```

---

### Task 2: Add Exa Search Integration

**Files:**
- Create: `backend/core/exa.py`
- Modify: `backend/core/models.py` (ProviderKey.Provider choices, add "exa")

**Step 1: Add "exa" to ProviderKey.Provider choices**

In `backend/core/models.py`, add to the `Provider` TextChoices in `ProviderKey` class (~line 242):

```python
EXA = "exa", "Exa"
```

**Step 2: Create Exa search module**

Create `backend/core/exa.py`:

```python
import httpx

from .models import ProviderKey


def get_exa_api_key() -> str:
    provider_key = ProviderKey.objects.filter(provider="exa").first()
    if provider_key:
        key = provider_key.get_api_key()
        if key:
            return key
    return ""


def search_exa(query: str, num_results: int = 5) -> list[dict]:
    """Search Exa for content relevant to a claim.

    Returns list of {url, title, text} dicts.
    """
    api_key = get_exa_api_key()
    if not api_key:
        return []

    response = httpx.post(
        "https://api.exa.ai/search",
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "useAutoprompt": True,
            "numResults": num_results,
            "contents": {
                "text": {"maxCharacters": 1000},
            },
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    results = []
    for r in data.get("results", []):
        results.append({
            "url": r.get("url", ""),
            "title": r.get("title", ""),
            "text": r.get("text", ""),
        })
    return results
```

**Step 3: Generate migration for new Provider choice and copy to Docker**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/exa.py /Users/eugeniodetomaso/Projects/experiments/backend/core/exa.py
cp backend/core/migrations/0013_*.py /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 4: Commit**

```bash
git add backend/core/exa.py backend/core/models.py backend/core/migrations/0013_*
git commit -m "feat: add Exa search integration and exa provider key support"
```

---

### Task 3: Add Fact-Check LLM Functions

**Files:**
- Modify: `backend/core/llm.py`

**Step 1: Add claim extraction prompt and function**

Add after `generate_review_sync` function (after ~line 171) in `backend/core/llm.py`:

```python
CLAIM_EXTRACTION_PROMPT = (
    "You are a fact-checker. Extract all verifiable factual claims from the text below.\n\n"
    "A verifiable claim is a statement that can be checked against external sources — "
    "dates, statistics, named events, scientific facts, historical assertions, attributions, etc.\n\n"
    "Do NOT extract opinions, subjective judgments, or hypotheticals.\n\n"
    "For each claim, return a JSON object with:\n"
    '- "claim": the factual assertion in a clear, searchable form\n'
    '- "quoted_text": the exact substring from the document (must match character-for-character)\n\n'
    "Return ONLY a JSON array. No markdown, no code fences.\n\n"
    "Example:\n"
    '[{"claim": "The Eiffel Tower was built in 1889", '
    '"quoted_text": "built in 1889"}]'
)


def extract_claims_sync(
    provider: str, api_key: str, model: str, content_md: str
) -> list:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": CLAIM_EXTRACTION_PROMPT},
        {"role": "user", "content": content_md[:8000]},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return []


VERDICT_PROMPT = (
    "You are a fact-checker. Given a claim and search results from the web, "
    "determine whether the claim is accurate.\n\n"
    "Respond with a JSON object with exactly these keys:\n"
    '- "verdict": one of "verified", "dubious", or "false"\n'
    '  - "verified": the claim is confirmed by reliable sources\n'
    '  - "dubious": sources are contradictory, insufficient, or the claim is misleading\n'
    '  - "false": the claim is clearly incorrect according to sources\n'
    '- "explanation": a brief explanation (1-3 sentences) of why you reached this verdict, citing specific sources\n'
    '- "suggested_text": if the verdict is "false", provide a corrected version of the quoted text. '
    'If "verified" or "dubious", set to empty string.\n\n'
    "Return ONLY the JSON object. No markdown, no code fences."
)


def verify_claim_sync(
    provider: str, api_key: str, model: str, claim: str, quoted_text: str, sources: list
) -> dict:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    sources_text = "\n\n".join(
        f"Source: {s.get('title', 'Untitled')} ({s.get('url', '')})\n{s.get('text', '')}"
        for s in sources
    )

    user_content = (
        f"Claim: {claim}\n\n"
        f"Original text: \"{quoted_text}\"\n\n"
        f"Search results:\n{sources_text}"
    )

    messages = [
        {"role": "system", "content": VERDICT_PROMPT},
        {"role": "user", "content": user_content},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            return result
        return {"verdict": "dubious", "explanation": "Could not parse verdict.", "suggested_text": ""}
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return {"verdict": "dubious", "explanation": "Could not parse verdict.", "suggested_text": ""}
```

**Step 2: Copy to Docker mount**

```bash
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
```

**Step 3: Commit**

```bash
git add backend/core/llm.py
git commit -m "feat: add claim extraction and verdict verification LLM functions"
```

---

### Task 4: Add Fact-Check SSE Endpoint

**Files:**
- Modify: `backend/core/views.py` (add `AIFactCheckView`)
- Modify: `backend/core/urls.py` (add route)

**Step 1: Add AIFactCheckView to views.py**

Add after `AIReviewView` (~line 581) in `backend/core/views.py`:

```python
class AIFactCheckView(APIView):
    def post(self, request):
        node_id = request.data.get("node_id")
        provider = request.data.get("provider")
        model = request.data.get("model")
        selection_from = request.data.get("selection_from")
        selection_to = request.data.get("selection_to")

        if not node_id or not provider or not model:
            return Response(
                {"detail": "node_id, provider, and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        node = Node.objects.filter(id=node_id, type=Node.NodeType.FILE).first()
        if not node:
            return Response({"detail": "File node not found"}, status=404)

        content = node.content_md or ""
        if not content.strip():
            return Response({"detail": "No content to fact-check"}, status=400)

        offset = 0
        if selection_from is not None and selection_to is not None:
            offset = int(selection_from)
            content = content[offset:int(selection_to)]

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response({"detail": "Provider key missing"}, status=400)

        def generate():
            from .llm import extract_claims_sync, verify_claim_sync
            from .exa import search_exa
            from .serializers import CommentSerializer

            # Step 1: Extract claims
            try:
                claims = extract_claims_sync(provider, api_key, model, content)
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
                yield "event: done\ndata: [DONE]\n\n"
                return

            yield f"data: {json.dumps({'type': 'claims_extracted', 'count': len(claims)})}\n\n"

            if not claims:
                yield "event: done\ndata: [DONE]\n\n"
                return

            # Step 2: Verify each claim
            for claim_data in claims:
                claim_text = claim_data.get("claim", "")
                quoted_text = claim_data.get("quoted_text", "")

                if not claim_text or not quoted_text:
                    continue

                # Find position in content
                pos_from = None
                pos_to = None
                idx = content.find(quoted_text)
                if idx >= 0:
                    pos_from = idx + offset
                    pos_to = idx + len(quoted_text) + offset

                # Search Exa
                try:
                    exa_results = search_exa(claim_text, num_results=5)
                except Exception:
                    exa_results = []

                # Build source list (without full text for storage)
                sources = [
                    {"url": r["url"], "title": r["title"], "snippet": r["text"][:200]}
                    for r in exa_results
                ]

                # Verify with LLM
                try:
                    verdict_data = verify_claim_sync(
                        provider, api_key, model, claim_text, quoted_text, exa_results
                    )
                except Exception:
                    verdict_data = {
                        "verdict": "dubious",
                        "explanation": "Verification failed.",
                        "suggested_text": "",
                    }

                # Create comment
                comment = Comment.objects.create(
                    node=node,
                    body=verdict_data.get("explanation", ""),
                    author_type=Comment.AuthorType.ASSISTANT,
                    author_label="Fact-Checker",
                    status=Comment.Status.OPEN,
                    quoted_text=quoted_text,
                    suggested_text=verdict_data.get("suggested_text", ""),
                    position_from=pos_from,
                    position_to=pos_to,
                    comment_type="fact_check",
                    verdict=verdict_data.get("verdict", "dubious"),
                    sources=sources,
                )

                serialized = CommentSerializer(comment).data
                yield f"data: {json.dumps({'type': 'fact_check_result', 'comment': serialized})}\n\n"

            yield "event: done\ndata: [DONE]\n\n"

        response = StreamingHttpResponse(generate(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        return response
```

Add required imports at top of views.py:
```python
import json
```
(Check if `json` is already imported — it likely is from existing code.)

**Step 2: Add URL route**

In `backend/core/urls.py`, add after the `ai-review` path:

```python
path("api/ai/fact-check", AIFactCheckView.as_view(), name="ai-fact-check"),
```

Add `AIFactCheckView` to the import from `.views`.

**Step 3: Copy to Docker mount**

```bash
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
cp backend/core/exa.py /Users/eugeniodetomaso/Projects/experiments/backend/core/exa.py
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
```

**Step 4: Commit**

```bash
git add backend/core/views.py backend/core/urls.py
git commit -m "feat: add /api/ai/fact-check SSE endpoint with claim extraction and verification"
```

---

### Task 5: Add Frontend API Method

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Add factCheck method to api object**

In `frontend/src/api.js`, add after `requestReview` method (~line 156):

```javascript
factCheck(payload) {
  const token = localStorage.getItem("marvin:access_token");
  return fetch(`${BASE}/api/ai/fact-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
},
```

Note: This returns the raw `fetch` Response so the caller can use `response.body.getReader()` for SSE streaming (same pattern as existing code if applicable, or we use a simple line parser).

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add api.factCheck() method for SSE streaming"
```

---

### Task 6: Add Fact-Check Handler and Topbar Button

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add fact-check state variables**

Near the existing `isReviewing` state (~line 190), add:

```javascript
const [isFactChecking, setIsFactChecking] = useState(false);
const [factCheckProgress, setFactCheckProgress] = useState(null); // {total, done}
```

**Step 2: Add handleFactCheck function**

After `handleRequestReview` (~line 1052), add:

```javascript
const handleFactCheck = async (selectionFrom = null, selectionTo = null) => {
  if (!activeNode || isFactChecking) return;
  setIsFactChecking(true);
  setFactCheckProgress(null);

  try {
    const providerSettings = JSON.parse(localStorage.getItem("marvin:ai-provider") || "{}");
    const provider = providerSettings.provider || "deepseek";
    const model = providerSettings.model || "deepseek-chat";

    const response = await api.factCheck({
      node_id: activeNode.id,
      provider,
      model,
      selection_from: selectionFrom,
      selection_to: selectionTo,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "claims_extracted") {
            setFactCheckProgress({ total: parsed.count, done: 0 });
          } else if (parsed.type === "fact_check_result" && parsed.comment) {
            setComments((prev) => [...prev, parsed.comment]);
            setFactCheckProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
          } else if (parsed.type === "error") {
            console.error("Fact-check error:", parsed.detail);
          }
        } catch (_) {
          // skip unparseable lines
        }
      }
    }
  } catch (err) {
    console.error("Fact-check failed:", err);
  } finally {
    setIsFactChecking(false);
    setFactCheckProgress(null);
  }
};
```

**Step 3: Add Fact-Check button in topbar**

Find the review button section in the JSX (~line 2698, the `doc-more` div). Add a "Fact-Check" button next to it. Look for the review button group and add before or after it:

```jsx
<button
  className="review-btn"
  onClick={() => handleFactCheck()}
  disabled={isFactChecking || !draft.trim()}
  title="Fact-check document"
>
  {isFactChecking ? (
    <>
      <svg width="12" height="12" viewBox="0 0 16 16" style={{ animation: "spin 0.8s linear infinite" }}>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
      </svg>
      {factCheckProgress
        ? `${factCheckProgress.done}/${factCheckProgress.total}`
        : "Extracting…"}
    </>
  ) : (
    <>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13.5 4.5L6.5 11.5L2.5 7.5" />
      </svg>
      Fact-Check
    </>
  )}
</button>
```

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add fact-check handler with SSE streaming and topbar button"
```

---

### Task 7: Add Fact-Check to Selection Toolbar

**Files:**
- Modify: `frontend/src/components/SelectionToolbar.jsx`

**Step 1: Add fact-check button after the comment button**

The SelectionToolbar receives props from App.jsx. Add an `onFactCheck` prop and a button.

In `SelectionToolbar.jsx`, add a ref and handler for a fact-check button following the same native mousedown pattern as the comment button:

```jsx
const factCheckBtnRef = useRef(null);

// In the useEffect section (after the comment button handler):
useEffect(() => {
  const btn = factCheckBtnRef.current;
  if (!btn || loading) return;

  const handler = (e) => {
    e.preventDefault();
    const sel = savedSelection.current;
    if (!sel) return;

    editorView.dom.dispatchEvent(
      new CustomEvent("fact-check-selection-request", {
        detail: { from: sel.from, to: sel.to, text: sel.text },
        bubbles: true,
      })
    );

    suppressed.current = true;
    tooltipProvider.current?.hide();
  };

  btn.addEventListener("mousedown", handler);
  return () => btn.removeEventListener("mousedown", handler);
}, [loading, get]);
```

Add the button in the JSX after the comment button:

```jsx
<div className="fmt-separator" />
<button className="fmt-btn fmt-btn-comment" title="Fact-check selection" ref={factCheckBtnRef}>
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M13.5 4.5L6.5 11.5L2.5 7.5" />
  </svg>
  <span className="fmt-comment-label">Fact-Check</span>
</button>
```

**Step 2: Handle the event in App.jsx**

In App.jsx, add a listener for `fact-check-selection-request` near the existing `comment-selection-request` listener (~line 662):

```javascript
const handleFactCheckSelection = (e) => {
  const { from, to } = e.detail;
  handleFactCheck(from, to);
};
wrapperEl.addEventListener("fact-check-selection-request", handleFactCheckSelection);
// Add to cleanup return
```

**Step 3: Commit**

```bash
git add frontend/src/components/SelectionToolbar.jsx frontend/src/App.jsx
git commit -m "feat: add fact-check button to selection toolbar"
```

---

### Task 8: Add Verdict-Colored Highlights

**Files:**
- Modify: `frontend/src/commentDecorationPlugin.js`
- Modify: `frontend/src/App.css`

**Step 1: Add verdict classes to decoration builder**

In `commentDecorationPlugin.js`, in the `buildDecorations` function (~line 30), add verdict-based classes after the existing class logic:

```javascript
// After the existing class assignments:
if (comment.comment_type === "fact_check" && comment.verdict) {
  classes.push(`comment-highlight--${comment.verdict}`);
}
```

**Step 2: Add CSS for verdict highlights**

In `App.css`, after the existing `.comment-highlight--rejected` (~line 5779), add:

```css
/* Fact-check verdict highlights */
.comment-highlight--verified {
  background: rgba(5, 150, 105, 0.08);
  border-bottom-color: rgba(5, 150, 105, 0.4);
  border-bottom-style: solid;
}

.comment-highlight--verified:hover {
  background: rgba(5, 150, 105, 0.14);
}

.comment-highlight--dubious {
  background: rgba(217, 119, 6, 0.08);
  border-bottom-color: rgba(217, 119, 6, 0.4);
  border-bottom-style: dashed;
}

.comment-highlight--dubious:hover {
  background: rgba(217, 119, 6, 0.14);
}

.comment-highlight--false {
  background: rgba(220, 38, 38, 0.08);
  border-bottom-color: rgba(220, 38, 38, 0.4);
  border-bottom-style: solid;
}

.comment-highlight--false:hover {
  background: rgba(220, 38, 38, 0.14);
}
```

**Step 3: Commit**

```bash
git add frontend/src/commentDecorationPlugin.js frontend/src/App.css
git commit -m "feat: add verdict-colored highlights for fact-check comments"
```

---

### Task 9: Update CommentThread for Fact-Check Display

**Files:**
- Modify: `frontend/src/components/CommentThread.jsx`
- Modify: `frontend/src/App.css`

**Step 1: Add verdict badge and sources display**

In `CommentThread.jsx`, add verdict rendering after the body section (~line 148):

```jsx
{/* Verdict badge for fact-checks */}
{comment.comment_type === "fact_check" && comment.verdict && (
  <div className={`comment-thread-verdict comment-thread-verdict--${comment.verdict}`}>
    {comment.verdict === "verified" && "Verified"}
    {comment.verdict === "dubious" && "Dubious"}
    {comment.verdict === "false" && "False"}
  </div>
)}

{/* Body */}
<div className="comment-thread-body">{comment.body}</div>

{/* Sources for fact-checks */}
{comment.comment_type === "fact_check" && comment.sources?.length > 0 && (
  <div className="comment-thread-sources">
    <div className="comment-thread-sources-label">Sources</div>
    {comment.sources.map((source, i) => (
      <a
        key={i}
        className="comment-thread-source-link"
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {source.title || source.url}
      </a>
    ))}
  </div>
)}
```

**Step 2: Add CSS for verdict badge and sources**

In `App.css`, add after the comment thread styles:

```css
/* Fact-check verdict badge */
.comment-thread-verdict {
  margin: 0 12px 4px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: inline-block;
}

.comment-thread-verdict--verified {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}

.comment-thread-verdict--dubious {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.comment-thread-verdict--false {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

/* Fact-check sources */
.comment-thread-sources {
  margin: 4px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comment-thread-sources-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-4);
  margin-bottom: 2px;
}

.comment-thread-source-link {
  font-size: 12px;
  color: var(--accent);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-thread-source-link:hover {
  text-decoration: underline;
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/CommentThread.jsx frontend/src/App.css
git commit -m "feat: add verdict badge and source links to CommentThread for fact-checks"
```

---

### Task 10: Integration Test

**Files:**
- Manual testing

**Step 1: Ensure backend is running with updated code**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
cp backend/core/exa.py /Users/eugeniodetomaso/Projects/experiments/backend/core/exa.py
cp backend/core/migrations/0012_*.py /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/
cp backend/core/migrations/0013_*.py /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 2: Set Exa API key via Django shell**

```bash
docker exec -it experiments-backend-1 python manage.py shell -c "
from core.models import ProviderKey
pk, _ = ProviderKey.objects.get_or_create(provider='exa')
pk.set_api_key('YOUR_EXA_API_KEY_HERE')
pk.save()
print('Exa key saved')
"
```

**Step 3: Test the full flow**

1. Open the app at `http://localhost:5174`
2. Open a document with factual claims
3. Click "Fact-Check" in the topbar
4. Verify: progress indicator appears, comments stream in with colored highlights
5. Click a highlight — verify verdict badge, explanation, sources appear in CommentThread
6. For a false claim — verify suggested_text and "Approve" button work
7. Select text → click Fact-Check in toolbar → verify only selection is checked

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete fact-check feature with Exa integration"
```
