# Auto Agent Routing — Design Doc

**Date**: 2026-02-18
**Status**: Approved

## Problem

Users must manually select which agent to use for each conversation. When a project has multiple specialized agents (e.g. "Story Partner" for narrative, "Editor" for grammar, "Researcher" for facts), the user has to know which one fits their query. This friction reduces the value of having multiple agents.

## Solution

Add an **Auto mode** that analyzes the user's query and automatically routes it to the most appropriate agent in the project. Inspired by Cursor's auto model selection.

## Design Decisions

- **Routing mechanism**: LLM Router — a fast, non-streaming call to a cheap model that picks the best agent given the query and available agents
- **UX**: Subtle indicator — a `via Agent Name` badge on each assistant message, no confirmation required
- **Routing location**: Backend — new `/api/ai/route-agent` endpoint
- **Default behavior**: Auto is the default for new conversations; user can switch to a specific agent at any time
- **Re-evaluation**: Per message — each message in a conversation can use a different agent
- **Availability**: Always available; if 0-1 agents exist, routing is skipped (uses the only available agent or project default)

## Architecture

### New Backend Endpoint

**`POST /api/ai/route-agent`**

```
Request:
{
  "project_id": 42,
  "query": "Can you help me tighten the dialogue in chapter 3?",
  "history": [  // last 2-3 messages for context, optional
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}

Response:
{
  "agent_id": 7,
  "agent_name": "Story Partner",
  "config": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "temperature": 0.7,
    "system_prompt": "You are a creative writing partner..."
  }
}
```

**Routing logic:**
1. Fetch all agents for the project
2. If 0 agents → return project default config (no agent)
3. If 1 agent → return that agent directly (skip LLM call)
4. If 2+ agents → construct routing prompt, call LLM, parse response
5. On error/ambiguous response → fall back to project default

**Routing prompt:**
```
You are a routing assistant. Given the user's message and a list of available AI assistants, pick the one that best fits. Respond with ONLY the number.

Available assistants:
1. "Story Partner" — Helps with creative writing, narrative structure, dialogue, and storytelling
2. "Editor" — Corrects grammar, style, clarity, and conciseness
3. "Researcher" — Finds facts, verifies claims, and provides references

User message: "{query}"

If none is clearly best, respond with 0.
```

**Router model:** Uses the same provider/model as the project's default agent. This avoids requiring a separate API key. The call uses `max_tokens: 10` and `temperature: 0` for fast, deterministic responses.

### Frontend Changes

#### Agent Selector (AssistantPanel)

- Add **"Auto"** as the first option in the agent dropdown, with a sparkle/wand icon
- Auto is selected by default for new conversations
- When Auto is active, the header pill shows "Auto" instead of an agent name
- User can switch to a specific agent (exits Auto) or back to Auto at any time

#### Message Flow (Auto mode)

1. User types message
2. Frontend calls `POST /api/ai/route-agent` with `{ project_id, query, history }`
3. Backend returns `{ agent_id, agent_name, config }`
4. Frontend displays a badge on the assistant message: `via Story Partner` (muted text, `--text-3`)
5. Frontend calls `POST /api/ai/stream` with the returned config (same as today)
6. Steps 2-5 repeat for each new message (re-evaluation)

#### Badge UI

- Small pill/text below or beside the assistant message: `via Agent Name`
- Color: `--text-3` (muted)
- Only shown in Auto mode (not when user manually selected an agent)
- Clickable: clicking the badge switches to that agent permanently (exits Auto for this conversation)

### Data Model Changes

#### `Conversation` model — new field

- `agent_mode` (CharField, choices=["auto", "fixed"], default="auto")
  - `"auto"` — each message is routed independently
  - `"fixed"` — a specific agent is used for all messages (current behavior)

#### `Message` model — new field

- `routed_agent` (ForeignKey to Agent, nullable, blank)
  - When mode is Auto, stores which agent was selected for this specific message
  - NULL when mode is fixed or when no routing occurred

### Sequence Diagram

```
User types message (Auto mode active)
    │
    ▼
Frontend ──POST /api/ai/route-agent──▶ Backend
    │                                      │
    │                                      ├─ Fetch project agents
    │                                      ├─ If ≤1 agents: return default
    │                                      ├─ Build routing prompt
    │                                      ├─ Call LLM (non-streaming, max_tokens:10)
    │                                      ├─ Parse response → agent_id
    │                                      │
    │◀──── { agent_id, agent_name, config }┘
    │
    ├─ Show "via Agent Name" badge
    │
    ▼
Frontend ──POST /api/ai/stream──────▶ Backend (with routed agent's config)
    │                                      │
    │◀──── SSE stream ────────────────────┘
    │
    ▼
Display response with badge
```

## Edge Cases

- **No agents in project**: Auto mode is available but acts as passthrough — uses project default config
- **Single agent**: Skips LLM routing call, returns the only agent directly
- **Router fails (timeout, API error)**: Falls back to project default config silently
- **Ambiguous routing (model returns 0)**: Falls back to project default config
- **User switches from Auto to fixed mid-conversation**: Future messages use the fixed agent; past Auto badges remain
- **Agent deleted after being routed**: Badge shows "via (deleted agent)" or hides gracefully

## Non-Goals (for now)

- Caching routing decisions for similar queries
- Embedding-based routing
- Letting the router create new agents on the fly
- Cross-project agent routing
- Routing based on document content (not just the query)
