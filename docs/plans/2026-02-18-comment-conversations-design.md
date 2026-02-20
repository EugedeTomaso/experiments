# Comment Conversations & Agent @Mentions Design

**Date:** 2026-02-18
**Approach:** Evolve existing Comment model (Approach A)

## Summary

Improve the comment system with: persistent reply display (bug fix), expandable ReviewCards in sidebar, and @mention-based agent invocation in comment threads.

## Requirements

1. **Bug fix**: Replies persist in DB but don't display when reopening a thread
2. **Expandable ReviewCard**: Compact preview in sidebar, expands inline to show full thread
3. **@mention picker**: When typing `@` in reply composer, show project agents
4. **Auto-reply**: Sending a reply with `@AgentName` auto-invokes that agent
5. **Agent's own config**: Each agent uses its system_prompt, provider, model
6. **Multi-agent threads**: Different agents can be mentioned in different replies within the same thread

## Backend Changes

### Comment Model

Add nullable `agent` FK:

```python
agent = models.ForeignKey('Agent', null=True, blank=True,
                          on_delete=models.SET_NULL, related_name='comments')
```

When an agent replies, the Comment gets `author_type='assistant'` + `agent=<instance>`.

### Serializers

Add `agent_name` and `agent_id` to CommentSerializer and CommentReplySerializer:

```python
agent_name = serializers.CharField(source='agent.name', read_only=True, default=None)
agent_id = serializers.IntegerField(source='agent.id', read_only=True, default=None)
```

### Endpoint: `/api/ai/comment-reply`

Extend to accept optional `agent_id` in request body:

1. If `agent_id` provided, fetch Agent and use its `config` for `system_prompt`, `provider`, `model`
2. If not provided, backward compatible (uses request's provider/model)
3. Build prompt: agent's system_prompt + thread context (quoted_text, root comment, all replies)
4. Create reply Comment with `agent=agent_instance`, `author_label=agent.name`

## Frontend Changes

### Bug Fix: Replies not showing on reopen

Investigate and fix the state hydration issue where replies from the serializer's nested `replies` field are not reflected in the local comments state when reopening a thread.

### Expandable ReviewCard

**Collapsed state (default):**
- Agent icon (if agent replied) + name
- Truncated quoted_text
- Reply count badge (e.g., "3 replies")
- Status badge (open/approved/rejected/resolved)

**Expanded state (click to toggle):**
- Full thread: root comment + all replies chronologically
- Each reply: avatar/name (user or agent name), timestamp
- Suggestion diffs inline
- Action buttons (approve/reject/resolve)
- Reply composer at bottom (with @mention)
- Chevron to collapse

Animate with `max-height` + `overflow` transition.

### AgentMentionPicker Component

Dropdown triggered by `@` in reply composer textarea:
- Lists project agents (already loaded in App.jsx)
- Each item: agent name + short description
- Keyboard navigation (up/down/enter/escape)
- Type-ahead filter: `@rev` filters to matching agents
- On select: inserts `@AgentName ` in textarea
- Floating position above textarea (similar to SlashMenu)

### Auto-reply Flow

When user submits a reply:
1. Parse text for `@AgentName` pattern
2. Resolve name against project agents list
3. Create user reply Comment via API
4. Auto-trigger `askAI(commentId, agentId)` with matched agent
5. Show spinner with agent name ("AgentName is thinking...")
6. Agent response appears as new reply in thread

### Multi-agent Context

Each reply Comment has its own `agent` FK. The `author_label` shows the agent's name. When building context for an agent call, the full thread history (including other agents' replies) is sent.

## Migration

Single migration: add `agent` FK to Comment model. No data migration needed (existing comments have `agent=null`).
