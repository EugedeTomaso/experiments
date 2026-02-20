# Comment Conversations & Agent @Mentions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix reply persistence display, make ReviewCards expandable with full threads, and add @agent mention picker in comment reply composers with auto-invocation.

**Architecture:** Evolve the existing Comment model by adding an `agent` FK. Extend the `/api/ai/comment-reply` endpoint to accept `agent_id` and use the agent's own config. On the frontend, fix the reply hydration bug, make ReviewCard expandable inline, and add an AgentMentionPicker component triggered by `@` in reply textareas.

**Tech Stack:** Django 5.2, DRF, React 18.2, Milkdown/ProseMirror

---

### Task 1: Backend — Add `agent` FK to Comment model

**Files:**
- Modify: `backend/core/models.py:127-172` (Comment class)

**Step 1: Add agent field to Comment model**

In `backend/core/models.py`, after line 171 (`sources = models.JSONField(...)`) and before line 172 (end of class), add:

```python
agent = models.ForeignKey(
    "Agent", null=True, blank=True, on_delete=models.SET_NULL, related_name="comments"
)
```

**Step 2: Create and run migration**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

Expected: Migration creates nullable FK column. No data migration needed.

**Step 3: Commit**

```bash
git add backend/core/models.py
git commit -m "feat: add agent FK to Comment model"
```

---

### Task 2: Backend — Update serializers to include agent info

**Files:**
- Modify: `backend/core/serializers.py:109-151` (CommentReplySerializer + CommentSerializer)

**Step 1: Add agent fields to CommentReplySerializer**

In `backend/core/serializers.py`, add two fields to `CommentReplySerializer` and include them in `fields`:

```python
class CommentReplySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True, default=None)
    agent_id = serializers.IntegerField(source="agent.id", read_only=True, default=None)

    class Meta:
        model = Comment
        fields = [
            "id", "parent", "body", "author_label", "author_type",
            "quoted_text", "suggested_text", "created_at",
            "agent_name", "agent_id",
        ]
        read_only_fields = ["created_at"]
```

**Step 2: Add agent fields to CommentSerializer**

Same pattern — add the two field declarations and include in `fields` list:

```python
class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()
    reply_count = serializers.IntegerField(read_only=True, default=0)
    agent_name = serializers.CharField(source="agent.name", read_only=True, default=None)
    agent_id = serializers.IntegerField(source="agent.id", read_only=True, default=None)

    class Meta:
        model = Comment
        fields = [
            "id", "node", "parent", "body", "author_label", "author_type",
            "status", "suggested_text", "created_at", "quoted_text",
            "position_from", "position_to", "comment_type", "verdict", "sources",
            "replies", "reply_count",
            "agent_name", "agent_id",
        ]
        read_only_fields = ["created_at"]
```

**Step 3: Copy to Docker mount and verify**

```bash
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
```

Test: `curl http://localhost:8000/api/comments/?node=<id>` — verify `agent_name` and `agent_id` appear in response (both `null` for existing comments).

**Step 4: Commit**

```bash
git add backend/core/serializers.py
git commit -m "feat: include agent_name and agent_id in comment serializers"
```

---

### Task 3: Backend — Extend `/api/ai/comment-reply` for agent routing

**Files:**
- Modify: `backend/core/views.py:828-953` (AICommentReplyView)

**Step 1: Modify the post method to accept optional `agent_id`**

In `AICommentReplyView.post()`, change the validation and provider resolution logic:

1. After line 833 (`model = request.data.get("model")`), add:
```python
agent_id = request.data.get("agent_id")
```

2. Replace the validation at lines 835-839. When `agent_id` is provided, `provider` and `model` are NOT required (they come from agent config):
```python
if not comment_id or not user_message:
    return Response(
        {"detail": "comment_id and user_message are required"},
        status=status.HTTP_400_BAD_REQUEST,
    )

# Resolve agent config or use explicit provider/model
agent = None
if agent_id:
    from .models import Agent
    agent = Agent.objects.filter(id=agent_id).first()
    if not agent:
        return Response({"detail": "Agent not found"}, status=404)
    agent_config = agent.config or {}
    provider = agent_config.get("provider", provider)
    model = agent_config.get("model", model)

if not provider or not model:
    return Response(
        {"detail": "provider and model are required (or provide agent_id)"},
        status=status.HTTP_400_BAD_REQUEST,
    )
```

3. When agent exists, prepend the agent's system_prompt to the existing system prompt (line 864-878):
```python
agent_system_prompt = ""
if agent and agent.config and agent.config.get("system_prompt"):
    agent_system_prompt = agent.config["system_prompt"] + "\n\n"

system_prompt = agent_system_prompt + (
    "You are a writing reviewer. A comment was made about this text:\n\n"
    # ... rest unchanged
)
```

4. When creating the AI reply (line 938-946), include the agent:
```python
ai_reply = Comment.objects.create(
    node=root_comment.node,
    parent=root_comment,
    body=ai_body,
    author_type=Comment.AuthorType.ASSISTANT,
    author_label=agent.name if agent else "Assistant",
    quoted_text=root_comment.quoted_text if new_suggestion else "",
    suggested_text=new_suggestion or "",
    agent=agent,
)
```

**Step 2: Copy to Docker mount and verify**

```bash
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
```

**Step 3: Commit**

```bash
git add backend/core/views.py
git commit -m "feat: extend comment-reply endpoint to support agent_id routing"
```

---

### Task 4: Frontend — Fix reply hydration bug

**Files:**
- Modify: `frontend/src/hooks/useComments.js:102-117` (load function)

**The Bug:** `load()` calls `api.listComments(nodeId)` which returns root comments with nested `replies` arrays. But only root comments are stored in the flat `comments` state. `getReplies(parentId)` at line 86-88 filters this flat array by `c.parent === parentId`, finding nothing because child comments were never flattened into state.

**Step 1: Flatten replies in the load function**

Change the `load` callback (lines 102-117) to flatten nested replies:

```javascript
const load = useCallback(
  async (nId) => {
    const seq = ++loadSeqRef.current;
    if (!nId) {
      setComments([]);
      return;
    }
    try {
      const list = await api.listComments(nId);
      if (seq === loadSeqRef.current) {
        // Flatten: root comments + their nested replies into one array
        const flat = [];
        for (const c of list) {
          const { replies, ...root } = c;
          flat.push(root);
          if (replies && replies.length) {
            flat.push(...replies);
          }
        }
        setComments(flat);
      }
    } catch {
      if (seq === loadSeqRef.current) setComments([]);
    }
  },
  []
);
```

**Step 2: Verify CommentThread also uses flat state**

In `CommentThread.jsx` line 98, `const replies = comment.replies || []` reads from the nested property. After flattening, root comments in state no longer have a `replies` property. But CommentThread receives its `comment` from `activeThread.comment` which is set by `navigateTo`/`openThread`. Check that these functions use the flat comment (without nested replies). If so, `comment.replies` will be `undefined` and fall back to `[]`.

CommentThread also receives an `onReply` and `onAskAI` prop — after those fire, replies get added to the flat array and `getReplies` will find them. But for existing replies on first open, CommentThread needs to receive replies from the flat state too.

**Fix: Pass replies to CommentThread from getReplies instead of relying on comment.replies.** In `App.jsx`, wherever `CommentThread` is rendered, ensure `replies` is passed. Check the current props — if `CommentThread` already gets replies via a separate mechanism, this is fine. If it reads `comment.replies`, we need to pass a `replies` prop from `getReplies(comment.id)`.

Look at App.jsx for how CommentThread is rendered and adjust accordingly. The CommentThread component already reads `const replies = comment.replies || []` at line 98 — change this to accept a `replies` prop:

```javascript
// In CommentThread.jsx, add `replies` to destructured props (around line 30-51)
// Replace line 98:
const replies = propReplies || comment.replies || [];
// where propReplies comes from a new `replies` prop
```

Then in App.jsx, pass `replies={commentState.getReplies(activeThread.comment.id)}` to CommentThread.

**Step 3: Verify by testing**

1. Create a comment, add a reply, refresh the page
2. Open the comment thread — replies should appear
3. Check ReviewCard sidebar — reply count badge should show correct number

**Step 4: Commit**

```bash
git add frontend/src/hooks/useComments.js frontend/src/components/CommentThread.jsx frontend/src/App.jsx
git commit -m "fix: flatten nested replies in comment state so they persist on reopen"
```

---

### Task 5: Frontend — Make ReviewCard expandable

**Files:**
- Modify: `frontend/src/components/ReviewCard.jsx:1-180`
- Modify: `frontend/src/App.css` (add styles for expanded state)

**Step 1: Add expandable thread state and reply count badge**

The ReviewCard already has `isThreadOpen` state (line 18) and a thread section (lines 124-177). The current behavior opens the thread via a "Reply" button in the actions. We need to:

1. Always show a reply count indicator (clickable to expand)
2. Make the entire card body area clickable to expand (not just the Reply button)
3. Add a chevron indicator for expand/collapse state
4. Show the thread inline when expanded (already works via `isThreadOpen`)

In `ReviewCard.jsx`, add a reply count section between the card body and actions:

```jsx
{/* Reply count indicator — always visible when there are replies */}
{replies.length > 0 && (
  <button
    className="review-card-reply-count"
    onClick={(e) => { e.stopPropagation(); setIsThreadOpen(!isThreadOpen); }}
  >
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: isThreadOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
  </button>
)}
```

Place this after the `.review-card-body` div (line 88) and before the suggestion diff (line 90).

**Step 2: Add CSS for reply count and expanded state**

In `App.css`, add styles:

```css
.review-card-reply-count {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 12px;
  cursor: pointer;
}
.review-card-reply-count:hover {
  color: var(--text-2);
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ReviewCard.jsx frontend/src/App.css
git commit -m "feat: add expandable reply count to ReviewCard"
```

---

### Task 6: Frontend — Create AgentMentionPicker component

**Files:**
- Create: `frontend/src/components/AgentMentionPicker.jsx`

**Step 1: Create the component**

Model after the existing `MentionPicker.jsx` pattern. The component receives:
- `agents[]` — list of agent objects from project
- `selectedIndex` — keyboard nav index
- `onSelect(agent)` — callback when agent is selected
- `onHoverIndex(i)` — callback for mouse hover

```jsx
import { useEffect, useRef } from "react";

const AgentIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
      fill="currentColor"
    />
  </svg>
);

export function AgentMentionPicker({ agents, selectedIndex, onSelect, onHoverIndex }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!agents.length) return null;

  return (
    <div className="mention-picker agent-mention-picker">
      <div className="mention-picker-hint">Agents</div>
      <div className="mention-picker-list" ref={listRef}>
        {agents.map((agent, i) => (
          <div
            key={agent.id}
            className={`mention-picker-item${i === selectedIndex ? " selected" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(agent);
            }}
            onMouseEnter={() => onHoverIndex(i)}
          >
            <AgentIcon />
            <span className="mention-picker-item-title">{agent.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/AgentMentionPicker.jsx
git commit -m "feat: add AgentMentionPicker component for @mentions in comment replies"
```

---

### Task 7: Frontend — Integrate @mention in CommentThread reply composer

**Files:**
- Modify: `frontend/src/components/CommentThread.jsx:309-329` (reply composer section)

**Step 1: Add @mention state and handlers**

Add to the top of the CommentThread component (after existing state declarations ~line 54-56):

```javascript
const [mentionQuery, setMentionQuery] = useState(null); // null = picker hidden, string = filter
const [mentionIndex, setMentionIndex] = useState(0);
```

Add a prop for `agents` in the destructured props (around line 30-51).

Compute filtered agents:
```javascript
const filteredAgents = useMemo(() => {
  if (mentionQuery === null) return [];
  const q = mentionQuery.toLowerCase();
  return agents.filter((a) => a.name.toLowerCase().startsWith(q));
}, [agents, mentionQuery]);
```

**Step 2: Modify the textarea onChange to detect @**

Replace the simple `onChange` on the textarea (line 317):

```javascript
const handleReplyChange = (e) => {
  const val = e.target.value;
  setReplyText(val);

  // Detect @ trigger
  const cursorPos = e.target.selectionStart;
  const textBeforeCursor = val.slice(0, cursorPos);
  const atMatch = textBeforeCursor.match(/@(\w*)$/);
  if (atMatch) {
    setMentionQuery(atMatch[1]);
    setMentionIndex(0);
  } else {
    setMentionQuery(null);
  }
};
```

**Step 3: Modify handleKeyDown to support picker navigation**

Extend the existing `handleKeyDown` (lines 84-93) to intercept arrow keys and enter when the picker is visible:

```javascript
const handleKeyDown = (e) => {
  if (mentionQuery !== null && filteredAgents.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredAgents.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSelectAgent(filteredAgents[mentionIndex]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery(null);
      return;
    }
  }
  // Original logic
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSubmitReply();
  }
  if (e.key === "Escape") {
    setShowComposer(false);
    setReplyText("");
  }
};
```

**Step 4: Add agent selection handler**

```javascript
const handleSelectAgent = (agent) => {
  // Replace @query with @AgentName
  const cursorPos = textareaRef.current?.selectionStart || replyText.length;
  const textBeforeCursor = replyText.slice(0, cursorPos);
  const textAfterCursor = replyText.slice(cursorPos);
  const newBefore = textBeforeCursor.replace(/@\w*$/, `@${agent.name} `);
  setReplyText(newBefore + textAfterCursor);
  setMentionQuery(null);
};
```

**Step 5: Render AgentMentionPicker above the textarea**

Inside the composer div (lines 313-329), add before the textarea:

```jsx
{mentionQuery !== null && filteredAgents.length > 0 && (
  <div style={{ position: "relative" }}>
    <div style={{ position: "absolute", bottom: "100%", left: 0, zIndex: 10, width: "100%" }}>
      <AgentMentionPicker
        agents={filteredAgents}
        selectedIndex={mentionIndex}
        onSelect={handleSelectAgent}
        onHoverIndex={setMentionIndex}
      />
    </div>
  </div>
)}
```

**Step 6: Modify handleSubmitReply to detect @mention and auto-invoke agent**

```javascript
const handleSubmitReply = () => {
  if (!replyText.trim()) return;
  const text = replyText.trim();

  // Detect @AgentName in the reply
  const mentionMatch = text.match(/@(\S+)/);
  const mentionedAgent = mentionMatch
    ? agents.find((a) => a.name.toLowerCase() === mentionMatch[1].toLowerCase())
    : null;

  onReply(comment.id, text);
  setReplyText("");
  setMentionQuery(null);

  // Auto-invoke agent if mentioned
  if (mentionedAgent) {
    onAskAI(comment.id, mentionedAgent.id);
  }
};
```

**Step 7: Update onAskAI prop to accept agentId**

The `onAskAI` callback currently takes `(commentId, replyBody)`. We need to change it to `(commentId, agentId)`. This affects `useComments.askAI` and `App.jsx` handler.

**Step 8: Commit**

```bash
git add frontend/src/components/CommentThread.jsx
git commit -m "feat: integrate @agent mention picker in CommentThread reply composer"
```

---

### Task 8: Frontend — Integrate @mention in ReviewCard reply composer

**Files:**
- Modify: `frontend/src/components/ReviewCard.jsx:159-175` (reply composer section)

**Step 1: Apply same @mention pattern as Task 7**

Add same state, handlers, and AgentMentionPicker rendering to ReviewCard's reply composer. The pattern is identical to CommentThread:

1. Add `agents` prop to ReviewCard
2. Add `mentionQuery`, `mentionIndex` state
3. Add `filteredAgents` memo, `handleReplyChange`, `handleSelectAgent`
4. Modify `handleReplyKeyDown` for picker navigation
5. Modify `handleReplySubmit` to detect @mention and auto-invoke
6. Render `AgentMentionPicker` above the textarea

**Step 2: Pass agents prop through the component chain**

In `App.jsx`, pass `agents` to the AssistantPanel which passes it through ReviewTab to ReviewCard. Trace the prop chain:
- `App.jsx` → AssistantPanel: add `agents={agents}` prop
- `AssistantPanel.jsx` → ReviewTab: pass `agents` through
- `ReviewTab.jsx` → ReviewCard: pass `agents` through

**Step 3: Commit**

```bash
git add frontend/src/components/ReviewCard.jsx frontend/src/components/ReviewTab.jsx frontend/src/components/AssistantPanel.jsx frontend/src/App.jsx
git commit -m "feat: integrate @agent mention picker in ReviewCard reply composer"
```

---

### Task 9: Frontend — Update useComments.askAI to support agent routing

**Files:**
- Modify: `frontend/src/hooks/useComments.js:345-380` (askAI function)
- Modify: `frontend/src/api.js:170-175` (requestCommentReply)

**Step 1: Modify askAI to accept optional agentId**

Change the `askAI` callback signature from `(commentId)` to `(commentId, agentId)`:

```javascript
const askAI = useCallback(
  async (commentId, agentId) => {
    if (!nodeId) return;
    setAiThinkingId(commentId);
    try {
      const lastUserReply = comments
        .filter((c) => c.parent === commentId && c.author_type === "user")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .pop();
      if (!lastUserReply) return;

      const payload = {
        comment_id: commentId,
        user_message: lastUserReply.body,
      };

      if (agentId) {
        payload.agent_id = agentId;
      } else {
        const providerSettings = JSON.parse(
          localStorage.getItem("mive:ai-provider") || "{}"
        );
        payload.provider = providerSettings.provider || "deepseek";
        payload.model = providerSettings.model || "deepseek-chat";
      }

      const result = await api.requestCommentReply(payload);
      setComments((prev) => [
        ...prev.map((c) =>
          c.id === commentId ? { ...c, ...result.root_comment } : c
        ),
        result.reply,
      ]);
    } catch (err) {
      console.error("AI reply failed:", err);
    } finally {
      setAiThinkingId(null);
    }
  },
  [nodeId, comments]
);
```

**Step 2: Update App.jsx handler**

Find `handleAskAIInThread` in App.jsx and update it to pass through the agentId parameter.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useComments.js frontend/src/App.jsx
git commit -m "feat: update askAI to route through specific agent when agent_id provided"
```

---

### Task 10: End-to-end testing & polish

**Step 1: Manual e2e test**

1. Open a document with existing comments
2. Verify replies appear when reopening a thread (bug fix)
3. In ReviewCard sidebar, verify reply count badge and expand/collapse
4. In CommentThread, type `@` in reply composer — verify agent picker appears
5. Select an agent, send the reply — verify auto-invocation
6. Verify the agent's response uses its name as author_label
7. Type a different `@Agent` in a new reply — verify multi-agent works
8. Verify "Ask Assistant" button still works (fallback, no agent_id)

**Step 2: Copy backend files to Docker mount**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
```

Run migration:
```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: comment conversations with agent @mentions"
```
