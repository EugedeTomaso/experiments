# Global Critique Review — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Critique" mode alongside the existing line-level review that evaluates a document holistically with dynamic scored sections and per-section conversation threads.

**Architecture:** New `Critique`, `CritiqueThread`, `CritiqueMessage` models. Non-streaming AI generation returns structured JSON. Frontend adds a sub-toggle inside the Review tab to switch between "Suggestions" and "Critique" views. CritiqueTab renders scored section cards with expandable discussion threads.

**Tech Stack:** Django 5.2 + DRF (backend), React 18.2 + Vite (frontend), existing LLM abstraction in `llm.py`

**Docker mount note:** Backend files must be copied to `/Users/eugeniodetomaso/Projects/experiments/backend/` after editing for Docker to pick them up. Run migrations via `docker exec -it experiments-backend-1 python manage.py makemigrations && docker exec -it experiments-backend-1 python manage.py migrate`.

---

### Task 1: Create backend models

**Files:**
- Modify: `backend/core/models.py` (add after the last model ~line 401)

**Step 1: Add the three new models at the end of `models.py`**

Add after the `YjsState` model (around line 401):

```python
class Critique(models.Model):
    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="critiques")
    sections = models.JSONField(default=list)
    overall_score = models.IntegerField()
    summary = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Critique {self.id} for Node {self.node_id} ({self.overall_score}/10)"


class CritiqueThread(models.Model):
    critique = models.ForeignKey(Critique, on_delete=models.CASCADE, related_name="threads")
    section_id = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("critique", "section_id")

    def __str__(self):
        return f"Thread for {self.critique_id} section {self.section_id}"


class CritiqueMessage(models.Model):
    thread = models.ForeignKey(CritiqueThread, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=[("user", "User"), ("assistant", "Assistant")])
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role} message in thread {self.thread_id}"
```

**Step 2: Copy to Docker mount and run migrations**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
docker exec -it experiments-backend-1 python manage.py makemigrations
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 3: Commit**

```bash
git add backend/core/models.py
git commit -m "feat(critique): add Critique, CritiqueThread, CritiqueMessage models"
```

---

### Task 2: Create serializers

**Files:**
- Modify: `backend/core/serializers.py` (add after CommentSerializer, around line 159)

**Step 1: Add serializers**

Add these after the existing `CommentReplySerializer`:

```python
class CritiqueMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CritiqueMessage
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = ["created_at"]


class CritiqueThreadSerializer(serializers.ModelSerializer):
    messages = CritiqueMessageSerializer(many=True, read_only=True)

    class Meta:
        model = CritiqueThread
        fields = ["id", "critique", "section_id", "messages", "created_at"]
        read_only_fields = ["created_at"]


class CritiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Critique
        fields = ["id", "node", "sections", "overall_score", "summary", "created_at"]
        read_only_fields = ["created_at"]
```

**Step 2: Add imports at the top of the file**

Add `Critique, CritiqueThread, CritiqueMessage` to the model imports from `core.models`.

**Step 3: Copy to Docker mount**

```bash
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
```

**Step 4: Commit**

```bash
git add backend/core/serializers.py
git commit -m "feat(critique): add Critique serializers"
```

---

### Task 3: Add `generate_critique_sync` to llm.py

**Files:**
- Modify: `backend/core/llm.py` (add after `generate_review_sync` function, around line 195)

**Step 1: Add the critique system prompt constant**

Add after `FOCUS_DESCRIPTIONS` (around line 158):

```python
CRITIQUE_SYSTEM_PROMPT = (
    "You are a professional writing critic. Analyze the following document "
    "and provide a comprehensive critique.\n\n"
    "For each aspect you evaluate, return a JSON object with:\n"
    '- "title": the aspect name (e.g., "Structure", "Clarity", "Tone", "Argument")\n'
    '- "score": a rating from 1 to 10\n'
    '- "body": your detailed evaluation (2-4 sentences)\n\n'
    "Choose the aspects that are most relevant to THIS specific document. "
    "Typically 4-7 aspects.\n\n"
    "Also provide:\n"
    '- "overall_score": a single 1-10 rating for the document\n'
    '- "summary": a 1-2 sentence executive summary\n\n'
    "Return ONLY valid JSON in this format:\n"
    '{"overall_score": 7, "summary": "...", "sections": [{"title": "...", "score": 7, "body": "..."}, ...]}'
)
```

**Step 2: Add the `generate_critique_sync` function**

Add after `generate_review_sync` (around line 195):

```python
def generate_critique_sync(
    provider: str, api_key: str, model: str, content_md: str
) -> dict:
    """Generate a holistic document critique. Returns dict with overall_score, summary, sections."""
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": CRITIQUE_SYSTEM_PROMPT},
        {"role": "user", "content": content_md[:12000]},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict) and "sections" in result:
            return result
    except json.JSONDecodeError:
        pass

    # Try extracting JSON object from markdown fences
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            result = json.loads(raw[start : end + 1])
            if isinstance(result, dict) and "sections" in result:
                return result
        except json.JSONDecodeError:
            pass

    return {"overall_score": 0, "summary": "Failed to generate critique.", "sections": []}
```

**Step 3: Copy to Docker mount**

```bash
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
```

**Step 4: Commit**

```bash
git add backend/core/llm.py
git commit -m "feat(critique): add generate_critique_sync LLM function"
```

---

### Task 4: Create API views

**Files:**
- Modify: `backend/core/views.py` (add after AIReviewView, around line 706)

**Step 1: Add imports at top of views.py**

Add `Critique, CritiqueThread, CritiqueMessage` to model imports and `CritiqueSerializer, CritiqueThreadSerializer, CritiqueMessageSerializer` to serializer imports. Add `generate_critique_sync` to the llm import.

**Step 2: Add CritiqueViewSet (read-only + list)**

```python
class CritiqueViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CritiqueSerializer

    def get_queryset(self):
        qs = Critique.objects.all()
        node_id = self.request.query_params.get("node_id")
        if node_id:
            qs = qs.filter(node_id=node_id)
        return qs.order_by("-created_at")
```

**Step 3: Add AICritiqueView**

```python
class AICritiqueView(APIView):
    def post(self, request):
        node_id = request.data.get("node_id")
        provider = request.data.get("provider", "deepseek")
        model = request.data.get("model", "deepseek-chat")

        if not node_id:
            return Response({"error": "node_id is required"}, status=400)

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response({"error": "Node not found"}, status=404)

        content = node.content or ""
        if not content.strip():
            return Response({"error": "Document is empty"}, status=400)

        # Get API key
        try:
            pk = ProviderKey.objects.get(provider=provider)
            api_key = pk.get_api_key()
        except ProviderKey.DoesNotExist:
            return Response({"error": f"No API key for {provider}"}, status=400)

        try:
            result = generate_critique_sync(provider, api_key, model, content)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

        # Assign section IDs
        for i, section in enumerate(result.get("sections", [])):
            section["id"] = f"sec_{i + 1}"

        critique = Critique.objects.create(
            node=node,
            sections=result.get("sections", []),
            overall_score=result.get("overall_score", 0),
            summary=result.get("summary", ""),
        )

        return Response(CritiqueSerializer(critique).data, status=201)
```

**Step 4: Add AICritiqueDiscussView**

This view handles per-section conversation. It creates a thread if needed, saves the user message, builds context from the critique + section + history, and streams the AI response.

```python
class AICritiqueDiscussView(APIView):
    def post(self, request):
        critique_id = request.data.get("critique_id")
        section_id = request.data.get("section_id")
        message = request.data.get("message", "").strip()

        if not all([critique_id, section_id, message]):
            return Response({"error": "critique_id, section_id, and message are required"}, status=400)

        try:
            critique = Critique.objects.get(id=critique_id)
        except Critique.DoesNotExist:
            return Response({"error": "Critique not found"}, status=404)

        # Find the section
        section = None
        for s in critique.sections:
            if s.get("id") == section_id:
                section = s
                break
        if not section:
            return Response({"error": "Section not found"}, status=404)

        # Get or create thread
        thread, _ = CritiqueThread.objects.get_or_create(
            critique=critique, section_id=section_id
        )

        # Save user message
        CritiqueMessage.objects.create(thread=thread, role="user", content=message)

        # Build conversation history
        history = list(thread.messages.order_by("created_at").values("role", "content"))

        # Get provider settings
        provider = request.data.get("provider", "deepseek")
        model = request.data.get("model", "deepseek-chat")

        try:
            pk = ProviderKey.objects.get(provider=provider)
            api_key = pk.get_api_key()
        except ProviderKey.DoesNotExist:
            return Response({"error": f"No API key for {provider}"}, status=400)

        # Build messages for LLM
        system_content = (
            f"You are a professional writing critic discussing your evaluation of a document.\n\n"
            f"Your critique of the section \"{section['title']}\" (score: {section['score']}/10):\n"
            f"{section['body']}\n\n"
            f"The user wants to discuss this section further. Be specific and helpful. "
            f"Reference the document content when relevant."
        )

        # Get document content for context
        doc_content = critique.node.content or ""

        llm_messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": f"Document being discussed:\n\n{doc_content[:8000]}"},
        ]
        for msg in history:
            llm_messages.append({"role": msg["role"], "content": msg["content"]})

        config = PROVIDERS.get(provider)
        if not config:
            return Response({"error": f"Unsupported provider: {provider}"}, status=400)

        # Stream response
        def stream_response():
            try:
                if config["type"] == "anthropic":
                    full_text = _sync_anthropic_review(api_key, config["base_url"], model, llm_messages)
                else:
                    full_text = _sync_openai_compatible_review(api_key, config["base_url"], model, llm_messages)

                # Save assistant message
                CritiqueMessage.objects.create(thread=thread, role="assistant", content=full_text)

                yield full_text
            except Exception as e:
                yield f"Error: {str(e)}"

        # For simplicity, non-streaming response (same pattern as review)
        try:
            if config["type"] == "anthropic":
                full_text = _sync_anthropic_review(api_key, config["base_url"], model, llm_messages)
            else:
                full_text = _sync_openai_compatible_review(api_key, config["base_url"], model, llm_messages)

            assistant_msg = CritiqueMessage.objects.create(
                thread=thread, role="assistant", content=full_text
            )

            return Response({
                "message": CritiqueMessageSerializer(assistant_msg).data,
                "thread_id": thread.id,
            }, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
```

**Step 5: Copy to Docker mount**

```bash
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
```

**Step 6: Commit**

```bash
git add backend/core/views.py
git commit -m "feat(critique): add AICritiqueView, AICritiqueDiscussView, CritiqueViewSet"
```

---

### Task 5: Add URL routes

**Files:**
- Modify: `backend/core/urls.py`

**Step 1: Register the viewset with the router**

Add after `router.register(r"comments", ...)` (around line 65):

```python
router.register(r"critiques", CritiqueViewSet, basename="critique")
```

**Step 2: Add AI endpoint paths**

Add after the `ai/comment-reply` path (around line 86):

```python
path("api/ai/critique", AICritiqueView.as_view(), name="ai-critique"),
path("api/ai/critique-discuss", AICritiqueDiscussView.as_view(), name="ai-critique-discuss"),
```

**Step 3: Add imports for the new views**

Add `AICritiqueView, AICritiqueDiscussView, CritiqueViewSet` to the imports from `core.views`.

**Step 4: Copy to Docker mount**

```bash
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
```

**Step 5: Commit**

```bash
git add backend/core/urls.py
git commit -m "feat(critique): add critique API routes"
```

---

### Task 6: Add frontend API functions

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Add critique API methods**

Add after the `requestReview` method (around line 169):

```javascript
  requestCritique(payload) {
    return request("/api/ai/critique", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listCritiques(nodeId) {
    return request(`/api/critiques/?node_id=${nodeId}`);
  },

  getCritique(id) {
    return request(`/api/critiques/${id}/`);
  },

  discussCritiqueSection(payload) {
    return request("/api/ai/critique-discuss", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat(critique): add frontend API methods for critique"
```

---

### Task 7: Create CritiqueSectionCard component

**Files:**
- Create: `frontend/src/components/CritiqueSectionCard.jsx`

**Step 1: Create the component**

```jsx
import { useState, useRef, useEffect } from "react";

function scoreColor(score) {
  if (score >= 8) return "var(--green-text, #2d7d46)";
  if (score >= 5) return "var(--amber-text, #9a6700)";
  return "var(--red-text, #c4432b)";
}

function scoreBg(score) {
  if (score >= 8) return "var(--green-bg, #dafbe1)";
  if (score >= 5) return "var(--amber-bg, #fff8c5)";
  return "var(--red-bg, #ffebe9)";
}

export default function CritiqueSectionCard({
  section,
  messages,
  onDiscuss,
  isDiscussing,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    onDiscuss(section.id, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="critique-section-card">
      <div className="critique-section-header">
        <span className="critique-section-title">{section.title}</span>
        <span
          className="critique-section-score"
          style={{ color: scoreColor(section.score), backgroundColor: scoreBg(section.score) }}
        >
          {section.score}/10
        </span>
      </div>
      <p className="critique-section-body">{section.body}</p>
      <div className="critique-section-actions">
        <button
          className="critique-section-discuss-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "Close" : "Discuss"}
        </button>
      </div>
      {isOpen && (
        <div className="critique-section-thread">
          {messages.map((msg) => (
            <div key={msg.id} className={`critique-msg critique-msg--${msg.role}`}>
              <span className="critique-msg-role">
                {msg.role === "user" ? "You" : "Critic"}
              </span>
              <p className="critique-msg-content">{msg.content}</p>
            </div>
          ))}
          {isDiscussing && (
            <div className="critique-msg-thinking">
              <span className="critique-thinking-spinner" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
          <div className="critique-section-composer">
            <textarea
              className="critique-section-input"
              rows={2}
              placeholder="Ask about this section…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="critique-section-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isDiscussing}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/CritiqueSectionCard.jsx
git commit -m "feat(critique): add CritiqueSectionCard component"
```

---

### Task 8: Create CritiqueTab component

**Files:**
- Create: `frontend/src/components/CritiqueTab.jsx`

**Step 1: Create the component**

```jsx
import { useState } from "react";
import CritiqueSectionCard from "./CritiqueSectionCard";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(score) {
  if (score >= 8) return "var(--green-text, #2d7d46)";
  if (score >= 5) return "var(--amber-text, #9a6700)";
  return "var(--red-text, #c4432b)";
}

function scoreBg(score) {
  if (score >= 8) return "var(--green-bg, #dafbe1)";
  if (score >= 5) return "var(--amber-bg, #fff8c5)";
  return "var(--red-bg, #ffebe9)";
}

export default function CritiqueTab({
  critiques,
  isCritiquing,
  threadMessages,
  discussingSection,
  onLaunchCritique,
  onDiscussSection,
  onSelectCritique,
  activeCritiqueId,
}) {
  const [showHistory, setShowHistory] = useState(false);

  const activeCritique = critiques.find((c) => c.id === activeCritiqueId) || critiques[0];

  // Empty state
  if (!isCritiquing && critiques.length === 0) {
    return (
      <div className="critique-tab-empty">
        <p className="critique-tab-empty-title">No critiques yet.</p>
        <p className="critique-tab-empty-desc">
          Get a comprehensive evaluation of your document.
        </p>
        <button className="review-tab-launch-btn" onClick={onLaunchCritique}>
          Critique
        </button>
      </div>
    );
  }

  // Loading state
  if (isCritiquing && critiques.length === 0) {
    return (
      <div className="critique-tab-loading">
        <span className="review-card-thinking-spinner" />
        Analyzing document…
      </div>
    );
  }

  return (
    <div className="critique-tab">
      {/* Overall score header */}
      {activeCritique && (
        <>
          <div className="critique-overall">
            <span
              className="critique-overall-score"
              style={{
                color: scoreColor(activeCritique.overall_score),
                backgroundColor: scoreBg(activeCritique.overall_score),
              }}
            >
              {activeCritique.overall_score}/10
            </span>
            <p className="critique-overall-summary">{activeCritique.summary}</p>
          </div>

          {/* Section cards */}
          {activeCritique.sections.map((section) => (
            <CritiqueSectionCard
              key={section.id}
              section={section}
              messages={threadMessages[section.id] || []}
              onDiscuss={onDiscussSection}
              isDiscussing={discussingSection === section.id}
            />
          ))}

          {/* Footer */}
          <div className="critique-footer">
            <span className="critique-timestamp">
              {timeAgo(activeCritique.created_at)}
            </span>
            <div className="critique-footer-actions">
              {critiques.length > 1 && (
                <button
                  className="critique-history-btn"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  History ({critiques.length})
                </button>
              )}
              <button
                className="review-tab-launch-btn"
                onClick={onLaunchCritique}
                disabled={isCritiquing}
              >
                {isCritiquing ? "Analyzing…" : "New critique"}
              </button>
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && (
            <div className="critique-history">
              {critiques.map((c) => (
                <button
                  key={c.id}
                  className={`critique-history-item${c.id === activeCritique.id ? " critique-history-item--active" : ""}`}
                  onClick={() => {
                    onSelectCritique(c.id);
                    setShowHistory(false);
                  }}
                >
                  <span>{timeAgo(c.created_at)}</span>
                  <span
                    className="critique-history-score"
                    style={{ color: scoreColor(c.overall_score) }}
                  >
                    {c.overall_score}/10
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/CritiqueTab.jsx
git commit -m "feat(critique): add CritiqueTab component"
```

---

### Task 9: Add critique state management to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add state variables**

Near the existing review state (around `isReviewing` state declaration, ~line 278), add:

```javascript
const [isCritiquing, setIsCritiquing] = useState(false);
const [critiques, setCritiques] = useState([]);
const [activeCritiqueId, setActiveCritiqueId] = useState(null);
const [critiqueThreadMessages, setCritiqueThreadMessages] = useState({});
const [discussingSection, setDiscussingSection] = useState(null);
```

**Step 2: Add critique loader**

Add a `useEffect` that loads critiques when `activeNodeId` changes (near the existing comment loading effect):

```javascript
useEffect(() => {
  if (!activeNodeId) {
    setCritiques([]);
    setActiveCritiqueId(null);
    setCritiqueThreadMessages({});
    return;
  }
  api.listCritiques(activeNodeId).then((data) => {
    const list = Array.isArray(data) ? data : data.results || [];
    setCritiques(list);
    setActiveCritiqueId(list.length > 0 ? list[0].id : null);
  }).catch(() => {});
}, [activeNodeId]);
```

**Step 3: Add `handleRequestCritique` function**

Near `handleRequestReview` (~line 1144):

```javascript
const handleRequestCritique = async () => {
  if (!activeNode || isCritiquing) return;
  setIsCritiquing(true);
  setAssistantTab("review");
  if (!isAssistantOpen) setIsAssistantOpen(true);
  try {
    const providerSettings = JSON.parse(localStorage.getItem("mive:ai-provider") || "{}");
    const provider = providerSettings.provider || "deepseek";
    const model = providerSettings.model || "deepseek-chat";
    const newCritique = await api.requestCritique({
      node_id: activeNode.id,
      provider,
      model,
    });
    setCritiques((prev) => [newCritique, ...prev]);
    setActiveCritiqueId(newCritique.id);
    setCritiqueThreadMessages({});
  } catch (err) {
    console.error("Critique failed:", err);
  } finally {
    setIsCritiquing(false);
  }
};
```

**Step 4: Add `handleDiscussSection` function**

```javascript
const handleDiscussSection = async (sectionId, message) => {
  if (!activeCritiqueId) return;
  setDiscussingSection(sectionId);
  try {
    const providerSettings = JSON.parse(localStorage.getItem("mive:ai-provider") || "{}");
    const provider = providerSettings.provider || "deepseek";
    const model = providerSettings.model || "deepseek-chat";
    const result = await api.discussCritiqueSection({
      critique_id: activeCritiqueId,
      section_id: sectionId,
      message,
      provider,
      model,
    });
    // Add both user message and assistant response to local state
    setCritiqueThreadMessages((prev) => {
      const existing = prev[sectionId] || [];
      const userMsg = { id: `u_${Date.now()}`, role: "user", content: message };
      return { ...prev, [sectionId]: [...existing, userMsg, result.message] };
    });
  } catch (err) {
    console.error("Discuss failed:", err);
  } finally {
    setDiscussingSection(null);
  }
};
```

**Step 5: Pass critique props to AssistantPanel**

In the AssistantPanel JSX (around line 2944), add these props alongside the existing review props:

```jsx
critiques={critiques}
isCritiquing={isCritiquing}
activeCritiqueId={activeCritiqueId}
critiqueThreadMessages={critiqueThreadMessages}
discussingSection={discussingSection}
onLaunchCritique={handleRequestCritique}
onDiscussSection={handleDiscussSection}
onSelectCritique={setActiveCritiqueId}
```

**Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(critique): add critique state management and handlers to App"
```

---

### Task 10: Integrate CritiqueTab into AssistantPanel

**Files:**
- Modify: `frontend/src/components/AssistantPanel.jsx`

**Step 1: Add import**

At the top imports:

```javascript
import CritiqueTab from "./CritiqueTab";
```

**Step 2: Add props to the component signature**

Add the new critique props to the AssistantPanel function parameters:

```javascript
critiques, isCritiquing, activeCritiqueId, critiqueThreadMessages,
discussingSection, onLaunchCritique, onDiscussSection, onSelectCritique,
```

**Step 3: Add sub-toggle state**

Inside the component, add:

```javascript
const [reviewSubTab, setReviewSubTab] = useState("suggestions");
```

**Step 4: Replace the review tab body**

Find where `activeTab === "review"` renders `ReviewTab` (around line 925). Replace the body with a sub-toggle + conditional render:

```jsx
{activeTab === "review" && (
  <div className="agent-pane-body">
    <div className="review-sub-toggle">
      <button
        className={`review-sub-btn${reviewSubTab === "suggestions" ? " review-sub-btn--active" : ""}`}
        onClick={() => setReviewSubTab("suggestions")}
      >
        Suggestions
      </button>
      <button
        className={`review-sub-btn${reviewSubTab === "critique" ? " review-sub-btn--active" : ""}`}
        onClick={() => setReviewSubTab("critique")}
      >
        Critique
      </button>
    </div>
    {reviewSubTab === "suggestions" ? (
      <ReviewTab
        comments={reviewTabComments}
        pendingCount={reviewPendingCount}
        acceptedCount={reviewAcceptedCount}
        dismissedCount={reviewDismissedCount}
        focusedCommentId={focusedCommentId}
        aiThinkingId={aiThinkingId}
        getReplies={getReplies}
        onClickComment={onClickComment}
        onApprove={onApproveComment}
        onApproveReply={onApproveReplyComment}
        onDismiss={onDismissComment}
        onResolve={onResolveComment}
        onDelete={onDeleteComment}
        onReply={onReplyComment}
        onAskAI={onAskAIComment}
        onLaunchReview={onLaunchReview}
        isReviewing={isReviewing}
      />
    ) : (
      <CritiqueTab
        critiques={critiques}
        isCritiquing={isCritiquing}
        threadMessages={critiqueThreadMessages}
        discussingSection={discussingSection}
        onLaunchCritique={onLaunchCritique}
        onDiscussSection={onDiscussSection}
        onSelectCritique={onSelectCritique}
        activeCritiqueId={activeCritiqueId}
      />
    )}
  </div>
)}
```

**Step 5: Commit**

```bash
git add frontend/src/components/AssistantPanel.jsx
git commit -m "feat(critique): integrate CritiqueTab with sub-toggle into AssistantPanel"
```

---

### Task 11: Add CSS styles

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Add critique styles**

Add at the end of App.css (after the existing review styles):

```css
/* ── Review sub-toggle ── */
.review-sub-toggle {
  display: flex;
  gap: 2px;
  padding: 4px;
  margin-bottom: 8px;
  background: var(--surface-inset);
  border-radius: 8px;
}
.review-sub-btn {
  all: unset;
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 0;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-3);
  transition: all 0.15s;
}
.review-sub-btn:hover {
  color: var(--text-1);
}
.review-sub-btn--active {
  background: var(--surface);
  color: var(--text-1);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

/* ── Critique tab ── */
.critique-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.critique-tab-empty,
.critique-tab-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.critique-tab-empty-title {
  font-weight: 500;
  color: var(--text-2);
  margin: 0;
}
.critique-tab-empty-desc {
  margin: 0;
}

/* ── Overall score ── */
.critique-overall {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface);
}
.critique-overall-score {
  font-size: 16px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.critique-overall-summary {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
  line-height: 1.5;
}

/* ── Section card ── */
.critique-section-card {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface);
  padding: 12px;
}
.critique-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.critique-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.critique-section-score {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}
.critique-section-body {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
  margin: 0 0 8px;
}
.critique-section-actions {
  display: flex;
  gap: 6px;
}
.critique-section-discuss-btn {
  all: unset;
  font-size: 11px;
  color: var(--text-3);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
}
.critique-section-discuss-btn:hover {
  background: var(--surface-inset);
  color: var(--text-2);
}

/* ── Section thread ── */
.critique-section-thread {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.critique-msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.critique-msg-role {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-3);
}
.critique-msg-content {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
  margin: 0;
}
.critique-msg--user .critique-msg-content {
  background: var(--surface-inset);
  padding: 6px 10px;
  border-radius: 8px;
}
.critique-msg-thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.critique-thinking-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--border-subtle);
  border-top-color: var(--text-3);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.critique-section-composer {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}
.critique-section-input {
  flex: 1;
  resize: none;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-1);
  outline: none;
}
.critique-section-input:focus {
  border-color: var(--text-3);
}
.critique-section-send-btn {
  all: unset;
  font-size: 11px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--text-1);
  color: var(--surface);
  cursor: pointer;
  white-space: nowrap;
}
.critique-section-send-btn:hover {
  opacity: 0.85;
}
.critique-section-send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── Footer ── */
.critique-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
}
.critique-timestamp {
  font-size: 11px;
  color: var(--text-3);
}
.critique-footer-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.critique-history-btn {
  all: unset;
  font-size: 11px;
  color: var(--text-3);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
}
.critique-history-btn:hover {
  background: var(--surface-inset);
  color: var(--text-2);
}

/* ── History dropdown ── */
.critique-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
}
.critique-history-item {
  all: unset;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-2);
  border-radius: 6px;
  cursor: pointer;
}
.critique-history-item:hover {
  background: var(--surface-inset);
}
.critique-history-item--active {
  background: var(--surface-inset);
  font-weight: 500;
}
.critique-history-score {
  font-weight: 600;
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat(critique): add CSS styles for critique UI"
```

---

### Task 12: Verify end-to-end

**Step 1: Copy all backend files to Docker mount**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
```

**Step 2: Run migrations**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 3: Start frontend dev server and verify**

```bash
cd frontend && npm run dev
```

Open http://localhost:5174, navigate to a document with content, open the assistant panel, switch to Review tab, click "Critique" sub-tab, and click the "Critique" button. Verify:
- Loading spinner appears
- Critique returns with overall score + sections
- Section cards display with scores and colored badges
- "Discuss" button opens thread
- Sending a message gets AI response
- History dropdown works when running a second critique
- "Suggestions" sub-tab still works as before
