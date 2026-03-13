# AI File Creation Suggestions — Design

## Summary

When chatting with the AI (from any node — folder or file), the AI can suggest creating new documents or folders in the project. It detects when a response would be better as a standalone file and renders an interactive card with title, location, and a create button. The user can also explicitly ask for file creation.

## Approach: Special XML Tags

The AI uses `<create-file>` and `<create-folder>` tags in its response. The frontend parses these from the streamed markdown and renders interactive cards inline. No backend streaming changes required.

## Tag Format

### Single file

```xml
<create-file title="Apéndice A: Glosario" folder="Apéndices">
Contenido markdown del documento...
</create-file>
```

- `title` — required, name of the file
- `folder` — optional, name of an existing folder. Defaults to current folder if omitted.

### Folder with files

```xml
<create-folder title="Apéndices">
  <create-file title="Glosario">
  Contenido del glosario...
  </create-file>
  <create-file title="Bibliografía">
  Contenido de la bibliografía...
  </create-file>
</create-folder>
```

Files nested inside `<create-folder>` are created within that new folder.

The AI can mix normal text before/after the tags.

## System Prompt Additions (~250 fixed tokens + variable tree)

### 1. Project tree (variable, ~10 tokens per node)

```
Project structure:
├── Capítulo 1: Introducción (file)
├── Capítulo 2: Marco Teórico (file)
├── Apéndices/ (folder)
│   ├── Glosario (file)
│   └── Bibliografía (file)
```

### 2. Instructions (~250 tokens)

```
When the user's request would be better served as a new document
(rather than editing the current one or just answering), suggest
creating it using <create-file> tags. Use <create-folder> if it
makes sense to group files. Choose the most logical location in
the project tree. You can also respond with normal text alongside
the tags to explain what you did.

If the user explicitly asks to create a file or document, always
use the tags.
```

### 3. Current location context

```
You are chatting from [folder/file name].
```

## Frontend: Card UI

### Single file card

```
┌─────────────────────────────────────┐
│ 📄 **Marco Teórico**                │
│ en Capítulo 2/                      │
│                                     │
│ 1,240 palabras · vista previa...    │
│                                     │
│  [Crear y abrir]                    │
└─────────────────────────────────────┘
```

### Folder with files card

```
┌─────────────────────────────────────┐
│ 📁 Crear carpeta: **Apéndices**     │
│                                     │
│  📄 Glosario                        │
│  📄 Bibliografía                    │
│                                     │
│  [Crear todo]                       │
└─────────────────────────────────────┘
```

### Card states

- **Pending**: shows content preview + "Crear y abrir" / "Crear todo" button
- **Created**: shows "✓ Creado" with link to open the document

### Styling

Consistent with design system: `--surface-inset` background, subtle border, no shadow. Similar treatment to existing diff cards in AssistantPanel.

## Create Flow

1. User clicks "Crear y abrir" / "Crear todo"
2. `POST /api/nodes/` for each node (folder first if applicable, then files)
3. Update `nodes` state in App.jsx
4. Navigate to first created file via `setActiveNodeId(newId)`
5. Card transitions to "Created" state

## What Changes

| File | Change | ~Lines |
|------|--------|--------|
| `App.jsx` | Inject project tree + instructions into system prompt | ~30 |
| `CreateFileCard.jsx` (new) | Interactive card component | ~150 |
| `AssistantPanel.jsx` | Parse tags from message content, render cards | ~80 |
| `App.css` | Card styles | ~40 |

## What Does NOT Change

- Backend streaming endpoint
- Node API (`POST /api/nodes/`)
- Conversation/Message models (tags saved as-is in message content)
- Existing `<document>` tag flow for editing current file
