# Fact-Check Feature Design

## Overview

Inline fact-checking that verifies claims in documents against web sources using Exa semantic search. Results appear as inline comments with verdicts, explanations, source links, and correction suggestions.

## Triggers

- **Full document**: "Fact-Check" button in topbar (next to existing Review button)
- **Selection**: Verification icon in SelectionToolbar for checking specific fragments

## Data Model

Extend existing `Comment` model with optional fields:

```python
comment_type = CharField(choices=["comment", "review", "fact_check"], default="comment")
verdict = CharField(choices=["verified", "dubious", "false"], null=True)
sources = JSONField(null=True)  # [{url, title, snippet}]
```

Existing fields reused:
- `quoted_text` — the claim from the document
- `body` — explanation of the verdict
- `suggested_text` — correction when verdict is "false"
- `position_from`, `position_to` — inline highlight positions

## Backend Pipeline

**Endpoint**: `POST /api/ai/fact-check` (SSE streaming)

**Input**:
```json
{
  "node_id": 123,
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "selection_from": null,
  "selection_to": null
}
```

**Step 1 — Claim extraction** (single LLM call):
- Prompt extracts verifiable factual claims as JSON array
- Each claim: `{claim, quoted_text, position_from, position_to}`
- Emits: `{"type": "claims_extracted", "count": N}`

**Step 2 — Verification** (per claim, sequential):
1. Call Exa Search API with claim as semantic query (`num_results: 3-5`, `contents.text.maxCharacters: 1000`)
2. Pass claim + Exa snippets to LLM for verdict determination
3. Create Comment in DB with all fields populated
4. Emit: `{"type": "fact_check_result", "comment": {serialized}}`

**SSE stream**:
```
data: {"type": "claims_extracted", "count": 3}
data: {"type": "fact_check_result", "comment": {...}}
data: {"type": "fact_check_result", "comment": {...}}
data: {"type": "fact_check_result", "comment": {...}}
data: {"type": "done"}
```

**Exa integration**: Direct HTTP via `httpx`. API key stored in `ProviderKey` model (encrypted). Endpoint: `POST https://api.exa.ai/search`.

## Frontend UX

**Progress**: Indicator showing "Checking N claims... M/N" while streaming.

**Inline highlights** with verdict colors:
- Green — verified
- Yellow — dubious
- Red — false

**CommentThread** displays:
- Verdict badge
- Explanation text
- Source links (clickeable)
- "Approve" button for corrections (applies `suggested_text`)

**New API method**: `api.factCheck()` returning EventSource for SSE consumption.

## Architecture Decisions

- **Exa over MCP**: Direct HTTP call is simpler than running a separate MCP server for a single API
- **Extend Comment vs new model**: Reuses all existing infrastructure (decorations, threads, approve/reject)
- **Two-step pipeline**: Higher accuracy — real web evidence instead of LLM hallucination
- **SSE streaming**: Results appear progressively, better UX for multi-claim documents
