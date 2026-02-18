# Auto Agent Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Auto" agent mode that routes each user message to the most appropriate project agent via a lightweight LLM call.

**Architecture:** New backend endpoint `POST /api/ai/route-agent` that takes a query + project ID, fetches project agents, and uses a fast sync LLM call to pick the best one. Frontend adds "Auto" as default agent option in the dropdown and shows a `via Agent Name` badge on routed messages.

**Tech Stack:** Django REST Framework (backend view + migration), React (frontend state + UI), existing `_sync_openai_compatible` / `_sync_anthropic` LLM helpers.

**Design doc:** `docs/plans/2026-02-18-auto-agent-routing-design.md`

---

### Task 1: Add `agent_mode` field to Conversation model

**Files:**
- Modify: `backend/core/models.py:225-235`
- Create: `backend/core/migrations/0012_auto_agent_routing.py` (auto-generated)

**Step 1: Add field to Conversation model**

In `backend/core/models.py`, add an `agent_mode` field to the `Conversation` model (after the `title` field at line 227):

```python
class Conversation(models.Model):
    class AgentMode(models.TextChoices):
        AUTO = "auto", "Auto"
        FIXED = "fixed", "Fixed"

    node = models.ForeignKey(Node, related_name="conversations", on_delete=models.CASCADE)
    title = models.CharField(max_length=200, blank=True, default="")
    agent_mode = models.CharField(
        max_length=10, choices=AgentMode.choices, default=AgentMode.AUTO
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Step 2: Add `routed_agent` field to Message model**

In the same file, add a nullable FK to `Message` (after the `content` field at line 247):

```python
class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    routed_agent = models.ForeignKey(
        Agent, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="routed_messages",
    )
    created_at = models.DateTimeField(auto_now_add=True)
```

**Step 3: Generate and run migration**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

Expected: Migration `0012_*.py` created and applied successfully.

**Step 4: Update serializers**

In `backend/core/serializers.py`, update `ConversationSerializer` (line 192) to expose `agent_mode`:

```python
class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True, default=0)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "node",
            "title",
            "agent_mode",
            "message_count",
            "preview",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
```

Update `MessageSerializer` (line 217) to expose `routed_agent` (read-only, with agent name):

```python
class MessageSerializer(serializers.ModelSerializer):
    routed_agent_name = serializers.CharField(
        source="routed_agent.name", read_only=True, default=None
    )

    class Meta:
        model = Message
        fields = ["id", "conversation", "role", "content", "routed_agent", "routed_agent_name", "created_at"]
        read_only_fields = ["created_at", "routed_agent_name"]
```

**Step 5: Copy backend changes to Docker mount and restart**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
```

Then run makemigrations + migrate again from Docker, and copy the generated migration file back:

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

Copy the migration back to workspace:
```bash
cp /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/0012_*.py backend/core/migrations/
```

**Step 6: Commit**

```bash
git add backend/core/models.py backend/core/serializers.py backend/core/migrations/0012_*.py
git commit -m "feat: add agent_mode to Conversation and routed_agent to Message"
```

---

### Task 2: Create the route-agent backend endpoint

**Files:**
- Modify: `backend/core/views.py` (add new view class after `AIStreamView` at ~line 342)
- Modify: `backend/core/urls.py:85` (add URL)
- Modify: `backend/core/llm.py` (add routing helper function)

**Step 1: Add the routing helper to llm.py**

Add this after the `generate_summary_sync` function (after line 36) in `backend/core/llm.py`:

```python
ROUTE_AGENT_SYSTEM_PROMPT = (
    "You are a routing assistant. Given a user's message and a list of available AI assistants, "
    "pick the one that best fits. Respond with ONLY the number (e.g. '1'). "
    "If none is clearly the best fit, respond with '0'."
)


def route_agent_sync(provider: str, api_key: str, model: str, query: str, agents_desc: str) -> str:
    """Pick the best agent for a query. Returns the raw LLM response (a number string)."""
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    messages = [
        {"role": "system", "content": ROUTE_AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Available assistants:\n{agents_desc}\n\nUser message: \"{query}\""},
    ]

    if config["type"] == "anthropic":
        return _sync_anthropic(api_key, config["base_url"], model, messages)
    else:
        return _sync_openai_compatible(api_key, config["base_url"], model, messages)
```

Note: The existing `_sync_openai_compatible` and `_sync_anthropic` functions already use `max_tokens: 256` and `temperature: 0.3`, which is fine for routing. The response will be a single digit.

**Step 2: Add the view to views.py**

Add this class after `AIStreamView` (after line 342) in `backend/core/views.py`. You'll need to import `route_agent_sync` from `llm.py` and `Agent` from models (both should already be imported — verify).

```python
class AIRouteAgentView(APIView):
    def post(self, request):
        project_id = request.data.get("project_id")
        query = request.data.get("query", "").strip()

        if not project_id or not query:
            return Response(
                {"detail": "project_id and query are required"}, status=400
            )

        agents = list(Agent.objects.filter(project_id=project_id).order_by("id"))

        # 0 agents → return empty (use default)
        if not agents:
            return Response({"agent_id": None, "agent_name": None, "config": {}})

        # 1 agent → return it directly, skip LLM call
        if len(agents) == 1:
            agent = agents[0]
            return Response({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "config": agent.config,
            })

        # 2+ agents → route via LLM
        # Build agents description
        agents_desc_lines = []
        for i, agent in enumerate(agents, 1):
            prompt_preview = (agent.config.get("system_prompt") or "")[:200]
            agents_desc_lines.append(f"{i}. \"{agent.name}\" — {prompt_preview}")
        agents_desc = "\n".join(agents_desc_lines)

        # Use the first agent's provider/model for routing (or project default)
        # Pick the first available provider key
        router_provider = agents[0].config.get("provider", "deepseek")
        router_model = agents[0].config.get("model", "deepseek-chat")

        provider_key = ProviderKey.objects.filter(provider=router_provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(router_provider)
        if not api_key:
            # Can't route without API key — return first agent as fallback
            agent = agents[0]
            return Response({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "config": agent.config,
            })

        try:
            result = route_agent_sync(
                router_provider, api_key, router_model, query, agents_desc
            )
            # Parse the number from the response
            choice = int(result.strip().split()[0])
        except (ValueError, IndexError):
            choice = 0

        if 1 <= choice <= len(agents):
            agent = agents[choice - 1]
        else:
            # Ambiguous or error — return None (frontend uses default)
            return Response({"agent_id": None, "agent_name": None, "config": {}})

        return Response({
            "agent_id": agent.id,
            "agent_name": agent.name,
            "config": agent.config,
        })
```

**Step 3: Add URL to urls.py**

In `backend/core/urls.py`, add after line 85 (after the `ai-autocomplete` path):

```python
    path("api/ai/route-agent", AIRouteAgentView.as_view(), name="ai-route-agent"),
```

And add `AIRouteAgentView` to the imports at the top of the file (wherever `AIStreamView` is imported from `.views`).

**Step 4: Copy to Docker mount and verify**

```bash
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
cp backend/core/llm.py /Users/eugeniodetomaso/Projects/experiments/backend/core/llm.py
```

Restart the backend container to pick up changes:
```bash
docker compose restart backend
```

Test the endpoint manually (should return empty config if no agents):
```bash
curl -X POST http://localhost:8000/api/ai/route-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"project_id": 1, "query": "help me write a poem"}'
```

**Step 5: Commit**

```bash
git add backend/core/llm.py backend/core/views.py backend/core/urls.py
git commit -m "feat: add POST /api/ai/route-agent endpoint for auto agent selection"
```

---

### Task 3: Add `routeAgent` API function to frontend

**Files:**
- Modify: `frontend/src/api.js:201` (add new function after `resolveAgentConfig`)

**Step 1: Add the API function**

In `frontend/src/api.js`, add after the `resolveAgentConfig` function (around line 201):

```javascript
  routeAgent(payload) {
    return request("/api/ai/route-agent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add routeAgent API function"
```

---

### Task 4: Add Auto mode state to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add `agentMode` state**

Near the existing agent-related state (around line 234 where `resolvedAgent` is declared), add:

```javascript
const [agentMode, setAgentMode] = useState("auto"); // "auto" | "fixed"
```

**Step 2: Reset agentMode when conversation changes**

In the effect that runs when `activeConversationId` changes, reset agentMode based on the conversation's `agent_mode` field. Find the effect that loads conversation messages (search for `activeConversationId` in useEffect dependencies) and add:

When a conversation is loaded and it has `agent_mode`, set it:
```javascript
setAgentMode(conversation.agent_mode || "auto");
```

When creating a new conversation (no activeConversationId), default to "auto":
```javascript
setAgentMode("auto");
```

**Step 3: Wire routing into `handleSendMessageDirect`**

In `handleSendMessageDirect` (line 1352), between the conversation persistence block (lines 1404-1421) and the agent resolution block (lines 1423-1437), add the routing logic:

Replace the agent resolution section (lines 1423-1437):

```javascript
    try {
      let config;
      let routedAgentId = null;
      let routedAgentName = null;

      if (agentMode === "auto" && agents.length >= 2) {
        // Auto mode: ask backend to route
        try {
          const routed = await api.routeAgent({
            project_id: activeProjectId,
            query: userMsg,
          });
          if (routed.agent_id) {
            routedAgentId = routed.agent_id;
            routedAgentName = routed.agent_name;
            config = { ...defaultAgent, ...routed.config };
          }
        } catch (_) {
          // Routing failed — fall through to default resolution
        }
      }

      // If not routed (fixed mode, <2 agents, or routing failed), use existing resolution
      if (!config) {
        let resolved;
        try {
          resolved = await api.resolveAgentConfig(
            activeNode ? { node: activeNode.id } : { project: activeProjectId }
          );
        } catch (_) {
          if (activeNode && activeProjectId) {
            try {
              resolved = await api.resolveAgentConfig({ project: activeProjectId });
            } catch (_) {}
          }
        }
        config = { ...defaultAgent, ...(resolved?.config || {}) };

        // In auto mode with 1 agent, show that agent's name
        if (agentMode === "auto" && agents.length === 1) {
          routedAgentId = agents[0].id;
          routedAgentName = agents[0].name;
        }
      }
```

Then, after the streaming completes (where the assistant message is added to `chatMessages`), include the routing info. Find where `setChatMessages` adds the assistant message and add `routedAgentId` and `routedAgentName`:

Search for the code that pushes the final assistant message. It should look something like:
```javascript
setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
```

Change it to:
```javascript
setChatMessages((prev) => [...prev, {
  role: "assistant",
  content: fullContent,
  routedAgentId,
  routedAgentName,
}]);
```

Also, persist the `routed_agent` when saving the assistant message to the backend:
```javascript
api.createMessage({
  conversation: convId,
  role: "assistant",
  content: fullContent,
  routed_agent: routedAgentId,
}).catch(() => {});
```

**Step 4: Pass agentMode and handler to AssistantPanel**

In the `<AssistantPanel>` render (around line 2826), add two new props:

```jsx
agentMode={agentMode}
onAgentModeChange={setAgentMode}
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add auto agent routing to message send flow"
```

---

### Task 5: Update AssistantPanel UI with Auto option and badge

**Files:**
- Modify: `frontend/src/components/AssistantPanel.jsx`
- Modify: `frontend/src/App.css`

**Step 1: Accept new props**

At the top of the AssistantPanel component, destructure the new props alongside existing ones:

```javascript
agentMode,
onAgentModeChange,
```

**Step 2: Update the agentName logic**

Replace the `agentName` computation (around line 301-305):

```javascript
const agentName = agentMode === "auto"
  ? "Auto"
  : nodeDirectConfig?.agent
    ? agents.find((a) => a.id === nodeDirectConfig.agent)?.name || "Assistant"
    : resolvedAgent?.inherited && resolvedAgent?.agent_name
      ? resolvedAgent.agent_name
      : "Assistant";
```

**Step 3: Add "Auto" option to the dropdown**

In the agent dropdown (around line 391), add an "Auto" button as the first option, before the "Default" button:

```jsx
{isAgentDropdownOpen && (
  <div className="assistant-agent-dropdown">
    <div className="assistant-agent-dropdown-label">Agent</div>
    {/* Auto option */}
    <button
      className={`assistant-agent-option${agentMode === "auto" ? " active" : ""}`}
      onClick={() => {
        onAgentModeChange("auto");
        onAgentChange(null);
        setIsAgentDropdownOpen(false);
      }}
    >
      <span className="assistant-agent-option-info">
        <span className="assistant-agent-option-name">
          <svg className="auto-agent-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" />
            <path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity="0.6" />
          </svg>
          Auto
        </span>
        <span className="assistant-agent-option-meta">picks the best agent per message</span>
      </span>
      {agentMode === "auto" && (
        <svg className="assistant-agent-option-check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
    <div className="assistant-agent-dropdown-divider" />
    {/* Existing Default option — update to set mode to "fixed" */}
    <button
      className={`assistant-agent-option${agentMode !== "auto" && !nodeDirectConfig?.agent ? " active" : ""}`}
      onClick={() => {
        onAgentModeChange("fixed");
        onAgentChange(null);
        setIsAgentDropdownOpen(false);
      }}
    >
      {/* ...existing Default option content unchanged... */}
    </button>
    {/* ...existing agent list, but each onClick also sets onAgentModeChange("fixed")... */}
```

For each individual agent option's `onClick`, add `onAgentModeChange("fixed")`:

```javascript
onClick={() => {
  onAgentModeChange("fixed");
  onAgentChange(a.id);
  setIsAgentDropdownOpen(false);
}}
```

**Step 4: Add the "via Agent" badge to assistant messages**

In the message rendering loop (around line 587-615), add a badge after the message content for assistant messages that have routing info:

```jsx
{messages.map((msg, i) => (
  <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
    {/* ...existing user message mentions/context... */}
    <div className={`agent-msg-content${msg.role === "assistant" ? " chat-content-md" : ""}`}>
      {msg.role === "assistant" ? (
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      ) : (
        msg.content
      )}
    </div>
    {msg.role === "assistant" && msg.routedAgentName && (
      <button
        className="agent-msg-routed-badge"
        onClick={() => {
          onAgentModeChange("fixed");
          onAgentChange(msg.routedAgentId);
        }}
        title={`Switch to ${msg.routedAgentName}`}
      >
        via {msg.routedAgentName}
      </button>
    )}
  </div>
))}
```

**Step 5: Add CSS for the badge and Auto icon**

In `frontend/src/App.css`, add after the assistant message styles (around line 2706):

```css
/* Auto agent badge on routed messages */
.agent-msg-routed-badge {
  display: inline-block;
  font-size: 11px;
  color: var(--text-3);
  background: none;
  border: none;
  padding: 0;
  margin-top: 2px;
  cursor: pointer;
  font-family: inherit;
  transition: color var(--duration-fast) var(--ease);
}

.agent-msg-routed-badge:hover {
  color: var(--text-2);
  text-decoration: underline;
}

/* Auto agent icon in dropdown */
.auto-agent-icon {
  vertical-align: -1px;
  margin-right: 2px;
}
```

**Step 6: Update the inherited badge in the pill**

Update the header pill to show a sparkle icon when in Auto mode. In the pill button (around line 377-388), conditionally render the sparkle:

```jsx
<button
  className="agent-selector-pill"
  onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
  aria-label="Select agent"
>
  {agentMode === "auto" && (
    <svg className="auto-agent-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" />
      <path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity="0.6" />
    </svg>
  )}
  <span className="agent-selector-pill-name">{agentName}</span>
  {/* ...rest unchanged... */}
```

**Step 7: Commit**

```bash
git add frontend/src/components/AssistantPanel.jsx frontend/src/App.css
git commit -m "feat: add Auto option to agent selector and via-agent badge on messages"
```

---

### Task 6: Persist agent_mode on conversation create/load

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Pass agent_mode when creating conversations**

In `handleSendMessageDirect`, where the conversation is created (around line 1411):

```javascript
const conv = await api.createConversation({
  node: Number(targetNodeId),
  title,
  agent_mode: agentMode,
});
```

**Step 2: Load agent_mode when selecting a conversation**

Find `handleSelectConversation` and add agentMode sync. When a conversation is loaded:

```javascript
setAgentMode(conversation.agent_mode || "auto");
```

**Step 3: When going back to list (new conversation), reset to auto**

In `handleBackToList`:

```javascript
setAgentMode("auto");
```

**Step 4: When switching from auto to fixed, update the conversation**

Add an effect or inline handler: when `agentMode` changes and there's an active conversation, update it:

```javascript
useEffect(() => {
  if (activeConversationId && agentMode) {
    api.updateConversation(activeConversationId, { agent_mode: agentMode }).catch(() => {});
  }
}, [activeConversationId, agentMode]);
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: persist agent_mode on conversation create and load"
```

---

### Task 7: Load routed_agent_name from persisted messages

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Map routed_agent fields when loading conversation messages**

Find where messages are loaded from the API for an existing conversation (search for `api.listMessages`). When mapping the response to `chatMessages`, include routing info:

```javascript
const loadedMessages = response.map((m) => ({
  role: m.role,
  content: m.content,
  routedAgentId: m.routed_agent || null,
  routedAgentName: m.routed_agent_name || null,
}));
setChatMessages(loadedMessages);
```

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: load routed agent info from persisted messages"
```

---

### Task 8: Manual testing and edge cases

**Files:** None (testing only)

**Step 1: Test with 0 agents**

1. Open a project with no agents
2. Verify "Auto" is shown in dropdown and is default
3. Send a message — should work normally (no routing call, uses default config)
4. No "via" badge should appear

**Step 2: Test with 1 agent**

1. Create one agent in a project
2. With Auto mode, send a message
3. Should skip LLM routing and use the only agent
4. Badge should show "via AgentName"

**Step 3: Test with 2+ agents**

1. Create 2+ agents with distinct system prompts (e.g. "Story Partner" and "Editor")
2. With Auto mode, send a message like "fix the grammar in paragraph 2"
3. Should route to the Editor agent
4. Badge shows "via Editor"
5. Send another message like "help me brainstorm chapter ideas"
6. Should route to Story Partner
7. Badge shows "via Story Partner"

**Step 4: Test switching modes**

1. Start in Auto mode, send a message (badge appears)
2. Click the badge — should switch to fixed mode with that agent
3. Send another message — no badge, uses the fixed agent
4. Switch back to Auto from dropdown
5. Send message — routing resumes

**Step 5: Test conversation persistence**

1. Send messages in Auto mode
2. Navigate away and back to the conversation
3. Verify badges still show on previously routed messages
4. Verify the conversation remembers it's in Auto mode

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: edge cases in auto agent routing"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB migration: `agent_mode`, `routed_agent` | models.py, serializers.py, migration |
| 2 | Backend `/api/ai/route-agent` endpoint | views.py, urls.py, llm.py |
| 3 | Frontend `routeAgent` API function | api.js |
| 4 | Auto mode state + routing in send flow | App.jsx |
| 5 | UI: Auto dropdown option + via badge | AssistantPanel.jsx, App.css |
| 6 | Persist agent_mode on conversations | App.jsx |
| 7 | Load routed_agent from saved messages | App.jsx |
| 8 | Manual testing + edge case fixes | — |
