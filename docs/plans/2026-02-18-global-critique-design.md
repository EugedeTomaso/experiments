# Global Critique Review — Design Document

## Overview

A new review mode that evaluates a document as a whole, producing structured sections with scores and narrative feedback. Complements the existing line-level suggestion review. Uses a dedicated "professional critic" prompt independent of user-configured agents.

## Data Model

### Critique

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | PK |
| node | FK → Node | Document being critiqued |
| sections | JSONField | Array of section objects (see below) |
| overall_score | IntegerField (1-10) | Global rating |
| summary | TextField | 1-2 sentence executive summary |
| created_at | DateTimeField auto_now_add | Timestamp |

### Section JSON structure

```json
[
  {
    "id": "sec_1",
    "title": "Narrative Structure",
    "score": 7,
    "body": "The document presents a clear logical progression..."
  }
]
```

Section `id` is generated server-side (e.g. `sec_<index>`) to enable thread references.

### CritiqueThread

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | PK |
| critique | FK → Critique | Parent critique |
| section_id | CharField | References section `id` in JSON |
| created_at | DateTimeField auto_now_add | Timestamp |

### CritiqueMessage

| Field | Type | Description |
|-------|------|-------------|
| id | AutoField | PK |
| thread | FK → CritiqueThread | Parent thread |
| role | CharField | "user" or "assistant" |
| content | TextField | Message text |
| created_at | DateTimeField auto_now_add | Timestamp |

## API

### Generate critique

```
POST /api/ai/critique
Body: { "node_id": 123, "provider": "deepseek", "model": "deepseek-chat" }
Response: 201 → serialized Critique
```

Non-streaming. The AI generates the full critique, which is parsed and persisted.

### List critiques (history)

```
GET /api/critiques/?node_id=123
Response: 200 → Critique[] ordered by created_at desc
```

### Critique detail

```
GET /api/critiques/<id>/
Response: 200 → Critique with sections
```

### Discuss a section (streaming)

```
POST /api/ai/critique-discuss
Body: {
  "critique_id": 1,
  "section_id": "sec_2",
  "message": "Can you give concrete examples?"
}
Response: 200 → streaming AI response
```

Creates CritiqueThread if it doesn't exist, appends user message, streams AI reply. Context includes the full critique + section + thread history.

### List thread messages

```
GET /api/critique-threads/?critique_id=1&section_id=sec_2
Response: 200 → CritiqueMessage[]
```

## AI Prompt

```
You are a professional writing critic. Analyze the following document
and provide a comprehensive critique.

For each aspect you evaluate, return a JSON object with:
- "title": the aspect name (e.g., "Structure", "Clarity", "Tone")
- "score": a rating from 1 to 10
- "body": your detailed evaluation (2-4 sentences)

Choose the aspects that are most relevant to THIS specific document.
Typically 4-7 aspects. Always include an overall assessment.

Also provide:
- "overall_score": a single 1-10 rating for the document
- "summary": a 1-2 sentence executive summary

Return ONLY valid JSON in this format:
{
  "overall_score": 7,
  "summary": "...",
  "sections": [{"title": "...", "score": 7, "body": "..."}, ...]
}
```

## UI

### Navigation

Inside the existing Review tab in AssistantPanel, a sub-toggle switches between modes:

```
[Suggestions] [Critique]
```

"Suggestions" = existing ReviewTab. "Critique" = new CritiqueTab.

### CritiqueTab states

**Empty:** "No critiques yet. Get a global evaluation of your document." + [Critique] button.

**Loading:** Spinner + "Analyzing document..."

**Active:** Shows the most recent critique with:
- Overall score + summary at top
- List of CritiqueSectionCard components
- Timestamp
- [History (N)] button to browse past critiques
- [New critique] button

**History view:** Dropdown/list of past critiques by date + overall_score. Selecting one loads it.

### CritiqueSectionCard

- Title left, score right
- Score color: 1-4 warm red, 5-7 warm amber, 8-10 warm green (subtle, consistent with warm gray palette)
- Body text below
- [Discuss] button to expand inline conversation

### Section conversation (expanded)

When user clicks "Discuss":
- Card expands to show message thread
- Previous messages displayed (user right-aligned, AI left-aligned)
- Text input + Send button at bottom
- AI responses stream in real-time
- Thread persists across sessions

## Design decisions

1. **Dedicated model vs reusing Comment:** Critique is conceptually different from line-level comments. A dedicated model avoids null fields, simplifies queries, and makes history clean.

2. **Non-streaming generation:** The critique needs to be complete and coherent JSON. Streaming partial JSON would add complexity for minimal UX gain since the response is short.

3. **Dynamic categories:** The AI chooses relevant aspects per document rather than using fixed categories. This produces more useful feedback for diverse document types.

4. **Generic critic prompt:** Independent of user agents to ensure consistent, professional-quality feedback regardless of agent configuration.

5. **Section conversations:** Enable depth without cluttering the main view. Users can drill into any section that interests them.
