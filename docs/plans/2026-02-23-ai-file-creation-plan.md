# AI File Creation Suggestions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the AI to suggest creating new files/folders in its chat responses, rendered as interactive cards the user can click to create.

**Architecture:** The AI uses `<create-file>` / `<create-folder>` XML tags in responses. The stream parser extracts them. AssistantPanel renders interactive cards. On click, nodes are created via existing API and the user navigates to the new document.

**Tech Stack:** React, existing `streamParser.js`, existing `api.createNode()`, CSS custom properties.

---

### Task 1: Extend streamParser to extract `<create-file>` and `<create-folder>` tags

**Files:**
- Modify: `frontend/src/streamParser.js`

**Step 1: Add tag constants and parser function**

Add after line 6 in `streamParser.js`:

```javascript
const CF_OPEN = "<create-file";
const CF_CLOSE = "</create-file>";
const CFO_OPEN = "<create-folder";
const CFO_CLOSE = "</create-folder>";

function parseCreateBlocks(text) {
  const blocks = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const folderIdx = text.indexOf(CFO_OPEN, searchFrom);
    const fileIdx = text.indexOf(CF_OPEN, searchFrom);

    // Find next block (folder or standalone file)
    if (folderIdx !== -1 && (fileIdx === -1 || folderIdx <= fileIdx)) {
      // Parse <create-folder>
      const tagEnd = text.indexOf(">", folderIdx);
      if (tagEnd === -1) break;
      const attrs = text.slice(folderIdx + CFO_OPEN.length, tagEnd);
      const titleMatch = attrs.match(/title="([^"]+)"/);
      const closeIdx = text.indexOf(CFO_CLOSE, tagEnd);
      if (closeIdx === -1) {
        // Incomplete folder tag — still streaming
        blocks.push({
          type: "folder",
          title: titleMatch?.[1] || "Untitled",
          files: [],
          complete: false,
          start: folderIdx,
          end: text.length,
        });
        break;
      }
      // Parse nested <create-file> tags inside the folder
      const innerText = text.slice(tagEnd + 1, closeIdx);
      const files = parseFileTags(innerText);
      blocks.push({
        type: "folder",
        title: titleMatch?.[1] || "Untitled",
        files,
        complete: true,
        start: folderIdx,
        end: closeIdx + CFO_CLOSE.length,
      });
      searchFrom = closeIdx + CFO_CLOSE.length;
    } else if (fileIdx !== -1) {
      // Parse standalone <create-file>
      const tagEnd = text.indexOf(">", fileIdx);
      if (tagEnd === -1) break;
      const attrs = text.slice(fileIdx + CF_OPEN.length, tagEnd);
      const titleMatch = attrs.match(/title="([^"]+)"/);
      const folderMatch = attrs.match(/folder="([^"]+)"/);
      const closeIdx = text.indexOf(CF_CLOSE, tagEnd);
      if (closeIdx === -1) {
        blocks.push({
          type: "file",
          title: titleMatch?.[1] || "Untitled",
          folder: folderMatch?.[1] || null,
          content: text.slice(tagEnd + 1).trim(),
          complete: false,
          start: fileIdx,
          end: text.length,
        });
        break;
      }
      blocks.push({
        type: "file",
        title: titleMatch?.[1] || "Untitled",
        folder: folderMatch?.[1] || null,
        content: text.slice(tagEnd + 1, closeIdx).trim(),
        complete: true,
        start: fileIdx,
        end: closeIdx + CF_CLOSE.length,
      });
      searchFrom = closeIdx + CF_CLOSE.length;
    } else {
      break;
    }
  }
  return blocks;
}

function parseFileTags(text) {
  const files = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = text.indexOf(CF_OPEN, pos);
    if (idx === -1) break;
    const tagEnd = text.indexOf(">", idx);
    if (tagEnd === -1) break;
    const attrs = text.slice(idx + CF_OPEN.length, tagEnd);
    const titleMatch = attrs.match(/title="([^"]+)"/);
    const closeIdx = text.indexOf(CF_CLOSE, tagEnd);
    if (closeIdx === -1) {
      files.push({
        title: titleMatch?.[1] || "Untitled",
        content: text.slice(tagEnd + 1).trim(),
        complete: false,
      });
      break;
    }
    files.push({
      title: titleMatch?.[1] || "Untitled",
      content: text.slice(tagEnd + 1, closeIdx).trim(),
      complete: true,
    });
    pos = closeIdx + CF_CLOSE.length;
  }
  return files;
}

function stripCreateBlocks(text) {
  return text
    .replace(/<create-folder[^>]*>[\s\S]*?<\/create-folder>/g, "")
    .replace(/<create-file[^>]*>[\s\S]*?<\/create-file>/g, "")
    .trim();
}
```

**Step 2: Add `createBlocks` to the parser state**

Modify the `getState()` method in `createStreamParser()` — in the return objects, add `createBlocks` alongside `memorySuggestion`. The `chatContent` should have create tags stripped out:

In the "no document tag" branch (current line 50-56):
```javascript
const createBlocks = parseCreateBlocks(rawChat);
return {
  mode: possiblePartial ? "pending" : "chat",
  chatContent: stripMemoryTag(stripCreateBlocks(rawChat)),
  documentContent: null,
  isDocumentComplete: false,
  memorySuggestion,
  createBlocks,
};
```

In the "document edit" branch (current line 80-86):
```javascript
const createBlocks = parseCreateBlocks(chatContent);
return {
  mode: "document_edit",
  chatContent: stripMemoryTag(stripCreateBlocks(chatContent)),
  documentContent,
  isDocumentComplete,
  memorySuggestion,
  createBlocks,
};
```

**Step 3: Commit**

```bash
git add frontend/src/streamParser.js
git commit -m "feat: extend stream parser to extract create-file/folder tags"
```

---

### Task 2: Inject project tree and create instructions into system prompt

**Files:**
- Modify: `frontend/src/App.jsx` (lines ~1858-1961)

**Step 1: Add project tree builder helper**

Add this helper function inside `App.jsx` (near the top, around line 100 with other helpers):

```javascript
function buildProjectTree(nodes) {
  const byParent = new Map();
  for (const n of nodes) {
    const key = n.parent ? String(n.parent) : "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }
  // Sort children by order
  for (const children of byParent.values()) {
    children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  function render(parentKey, prefix) {
    const children = byParent.get(parentKey) || [];
    return children.map((n, i) => {
      const isLast = i === children.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      const label = n.type === "folder" ? `${n.title}/ (folder)` : `${n.title} (file)`;
      const line = prefix + connector + label;
      if (n.type === "folder") {
        const sub = render(String(n.id), childPrefix);
        return sub.length ? line + "\n" + sub.join("\n") : line;
      }
      return line;
    });
  }
  const lines = render("root", "");
  return lines.join("\n");
}
```

**Step 2: Inject tree + instructions into system prompt**

In `handleSendMessageDirect`, after the memory injection block (after line 1858) and **before** the `if (activeNode?.type === "file")` block (line 1860), add:

```javascript
// Project tree + file creation instructions
const projectTree = buildProjectTree(nodes);
if (projectTree) {
  systemContent += `\n\n## Project structure\n${projectTree}`;
}

const currentLocation = activeNode
  ? (activeNode.type === "folder"
    ? `the folder "${activeNode.title}"`
    : `the file "${activeNode.title}"`)
  : "the project root";
systemContent += `\n\nThe user is chatting from ${currentLocation}.`;

systemContent += `\n\n## Creating new documents
When the user's request would be better served as a new document (rather than editing the current one or just answering with text), suggest creating it. Use <create-file> tags. Use <create-folder> to group files in a new folder.

Format for a single file:
<create-file title="Document Title" folder="Existing Folder Name">
markdown content
</create-file>

Format for a new folder with files:
<create-folder title="Folder Name">
<create-file title="File Title">
content
</create-file>
</create-folder>

Rules:
- title is required. folder is optional (defaults to current location).
- You can include normal text before/after the tags to explain.
- If the user explicitly asks to create a file or document, always use the tags.
- Do NOT use <create-file> when the user wants to edit the current document — use <document> tags for that.`;
```

**Step 3: Remove the duplicate location line**

The existing code at line 1867 says `The user is working on ${locationLabel}`. Since we now inject location before the file/folder blocks, update line 1867 to remove the location prefix (it's now redundant). Change:

```javascript
systemContent += `\n\nThe user is working on ${locationLabel}. Current content:\n\n${draft}`;
```

to:

```javascript
systemContent += `\n\nCurrent content:\n\n${draft}`;
```

And at line 1949, change:

```javascript
`The user is viewing a folder titled "${activeNode.title}".`,
```

to remove it since location is already injected above. Remove just that line from the `summaryLines` array.

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: inject project tree and create-file instructions into system prompt"
```

---

### Task 3: Pass create blocks through streaming to AssistantPanel

**Files:**
- Modify: `frontend/src/App.jsx` (streaming handler, ~lines 2147-2177)

**Step 1: Track create blocks in streaming state**

Add a new state variable near line 219:

```javascript
const [streamingCreateBlocks, setStreamingCreateBlocks] = useState([]);
```

**Step 2: Update the streaming handler to propagate create blocks**

In the streaming loop, where `state.mode === "chat"` is handled (around line 2172-2176), add:

```javascript
} else if (state.mode === "chat") {
  session.streamingContent = state.chatContent || fullContent;
  if (isCurrentlyViewed()) {
    setStreamingContent(state.chatContent || fullContent);
    setStreamingCreateBlocks(state.createBlocks || []);
  }
}
```

Note: use `state.chatContent` (which has tags stripped) instead of raw `fullContent`.

Also update the `document_edit` branch (line 2170) similarly:

```javascript
if (isCurrentlyViewed()) {
  setIsEditingDocument(true);
  setStreamingContent(state.chatContent || "");
  setStreamingCreateBlocks(state.createBlocks || []);
}
```

**Step 3: On finalize, save create blocks into the message**

In the `finalize()` function (search for where the assistant message is pushed to `setChatMessages`), add `createBlocks` to the saved message object. Find the line that does:

```javascript
setChatMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
```

And change to:

```javascript
const finalCreateBlocks = parser.getState().createBlocks || [];
setChatMessages((prev) => [
  ...prev,
  {
    role: "assistant",
    content: assistantContent,
    createBlocks: finalCreateBlocks.length > 0 ? finalCreateBlocks : undefined,
  },
]);
```

Also reset streaming create blocks:

```javascript
setStreamingCreateBlocks([]);
```

**Step 4: Pass to AssistantPanel**

In the JSX where `<AssistantPanel>` is rendered (around line 3389), add:

```jsx
streamingCreateBlocks={streamingCreateBlocks}
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: pass create blocks from stream parser to AssistantPanel"
```

---

### Task 4: Create the `CreateFileCard` component

**Files:**
- Create: `frontend/src/components/CreateFileCard.jsx`

**Step 1: Create the component**

```jsx
import { useState } from "react";

function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1Z" />
      <polyline points="9 1 9 5 13 5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v8Z" />
    </svg>
  );
}

export default function CreateFileCard({ block, onCreateFile, onCreateFolder }) {
  const [status, setStatus] = useState("pending"); // pending | creating | created

  const handleCreate = async () => {
    setStatus("creating");
    try {
      if (block.type === "folder") {
        await onCreateFolder(block);
      } else {
        await onCreateFile(block);
      }
      setStatus("created");
    } catch (e) {
      console.error("Failed to create:", e);
      setStatus("pending");
    }
  };

  if (block.type === "folder") {
    return (
      <div className="create-file-card">
        <div className="create-file-card-header">
          <FolderIcon />
          <span className="create-file-card-title">{block.title}</span>
        </div>
        {block.files.length > 0 && (
          <div className="create-file-card-filelist">
            {block.files.map((f, i) => (
              <div key={i} className="create-file-card-filelist-item">
                <FileIcon />
                <span>{f.title}</span>
                <span className="create-file-card-meta">{wordCount(f.content)} words</span>
              </div>
            ))}
          </div>
        )}
        <div className="create-file-card-actions">
          {status === "pending" && (
            <button className="create-file-card-btn" onClick={handleCreate}>
              Create all
            </button>
          )}
          {status === "creating" && (
            <span className="create-file-card-status">Creating...</span>
          )}
          {status === "created" && (
            <span className="create-file-card-status create-file-card-done">Created</span>
          )}
        </div>
      </div>
    );
  }

  // Single file
  const words = wordCount(block.content);
  return (
    <div className="create-file-card">
      <div className="create-file-card-header">
        <FileIcon />
        <span className="create-file-card-title">{block.title}</span>
      </div>
      {block.folder && (
        <div className="create-file-card-location">in {block.folder}/</div>
      )}
      <div className="create-file-card-meta">{words} words</div>
      <div className="create-file-card-actions">
        {status === "pending" && (
          <button className="create-file-card-btn" onClick={handleCreate}>
            Create & open
          </button>
        )}
        {status === "creating" && (
          <span className="create-file-card-status">Creating...</span>
        )}
        {status === "created" && (
          <span className="create-file-card-status create-file-card-done">Created</span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/CreateFileCard.jsx
git commit -m "feat: add CreateFileCard component for AI file creation suggestions"
```

---

### Task 5: Render create cards in AssistantPanel

**Files:**
- Modify: `frontend/src/components/AssistantPanel.jsx`

**Step 1: Import CreateFileCard**

Add at the top imports:

```javascript
import CreateFileCard from "./CreateFileCard";
```

**Step 2: Add props**

The component needs new props: `streamingCreateBlocks`, `onCreateFile`, `onCreateFolder`. Add them to the destructured props.

**Step 3: Render cards in saved messages**

In the message rendering loop (line 655-660), after the `ReactMarkdown` for assistant messages, add:

```jsx
<div className={`agent-msg-content${msg.role === "assistant" ? " chat-content-md" : ""}`}>
  {msg.role === "assistant" ? (
    <>
      <ReactMarkdown>{msg.content}</ReactMarkdown>
      {msg.createBlocks?.map((block, j) => (
        <CreateFileCard
          key={j}
          block={block}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
        />
      ))}
    </>
  ) : (
    msg.content
  )}
</div>
```

**Step 4: Render cards during streaming**

In the streaming content section (line 694-698), add after the ReactMarkdown:

```jsx
{streamingContent && (
  <div className="agent-msg-content chat-content-md">
    <ReactMarkdown>{streamingContent}</ReactMarkdown>
    {streamingCreateBlocks?.map((block, j) => (
      <CreateFileCard
        key={j}
        block={block}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
      />
    ))}
  </div>
)}
```

**Step 5: Commit**

```bash
git add frontend/src/components/AssistantPanel.jsx
git commit -m "feat: render CreateFileCard in assistant messages"
```

---

### Task 6: Implement create handlers in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add the handler functions**

Add these near the existing `handleCreateNode` function (around line 1315):

```javascript
const handleAICreateFile = async (block) => {
  if (!activeProjectId) return;
  // Resolve parent folder
  let parentId = null;
  if (block.folder) {
    const folder = nodes.find(
      (n) => n.type === "folder" && n.title === block.folder && n.project === activeProjectId
    );
    if (folder) parentId = folder.id;
  }
  if (!parentId && activeNode?.type === "folder") {
    parentId = activeNode.id;
  } else if (!parentId && activeNode?.parent) {
    parentId = activeNode.parent;
  }

  const node = await api.createNode({
    project: activeProjectId,
    parent: parentId,
    type: "file",
    title: block.title,
    order: getNextOrder(parentId),
    content_md: block.content || "",
  });
  setNodes((prev) => [...prev, node]);
  setActiveNodeId(String(node.id));
  return node;
};

const handleAICreateFolder = async (block) => {
  if (!activeProjectId) return;
  // Determine parent — default to root or current folder
  let parentId = null;
  if (activeNode?.type === "folder") {
    parentId = activeNode.id;
  } else if (activeNode?.parent) {
    parentId = activeNode.parent;
  }

  // Create the folder first
  const folder = await api.createNode({
    project: activeProjectId,
    parent: parentId,
    type: "folder",
    title: block.title,
    order: getNextOrder(parentId),
    content_md: "",
  });
  setNodes((prev) => [...prev, folder]);

  // Create files inside the folder
  let firstFileId = null;
  for (let i = 0; i < block.files.length; i++) {
    const f = block.files[i];
    const fileNode = await api.createNode({
      project: activeProjectId,
      parent: folder.id,
      type: "file",
      title: f.title,
      order: i,
      content_md: f.content || "",
    });
    setNodes((prev) => [...prev, fileNode]);
    if (i === 0) firstFileId = fileNode.id;
  }

  // Navigate to first file
  if (firstFileId) setActiveNodeId(String(firstFileId));
  return folder;
};
```

**Step 2: Pass handlers to AssistantPanel**

In the JSX where `<AssistantPanel>` is rendered, add:

```jsx
onCreateFile={handleAICreateFile}
onCreateFolder={handleAICreateFolder}
```

**Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add AI file/folder creation handlers"
```

---

### Task 7: Style the CreateFileCard

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Add card styles**

Add these styles (near the existing `.memory-suggestion` styles, around line 3450):

```css
/* AI Create File Card */
.create-file-card {
  margin-top: 10px;
  padding: 12px 14px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.create-file-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-1);
}

.create-file-card-location {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  padding-left: 20px;
}

.create-file-card-meta {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  padding-left: 20px;
}

.create-file-card-filelist {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
}

.create-file-card-filelist-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.create-file-card-filelist-item .create-file-card-meta {
  margin-top: 0;
  margin-left: auto;
  padding-left: 0;
}

.create-file-card-actions {
  margin-top: 10px;
}

.create-file-card-btn {
  background: var(--text-1);
  color: var(--surface);
  border: none;
  border-radius: var(--radius-sm);
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.create-file-card-btn:hover {
  opacity: 0.85;
}

.create-file-card-status {
  font-size: 12px;
  color: var(--text-3);
}
.create-file-card-done {
  color: var(--success, #16a34a);
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add CreateFileCard styles"
```

---

### Task 8: Manual testing & cleanup

**Step 1: Test with a folder chat**

1. Open a project, navigate to a folder
2. In the chat, type: "Write me a glossary document"
3. Verify the AI responds with a `<create-file>` tag
4. Verify the card renders with title, word count, and "Create & open" button
5. Click "Create & open" — verify the file is created and you navigate to it

**Step 2: Test with a file chat**

1. Open a document
2. In the chat, type: "Create a separate appendix for this chapter"
3. Verify the card appears alongside normal text
4. Verify clicking "Create & open" creates the file in the right folder

**Step 3: Test folder creation**

1. In chat, type: "Create an 'Appendices' section with a glossary and bibliography"
2. Verify a folder card appears with nested file list
3. Click "Create all" — verify folder + files are created, you navigate to first file

**Step 4: Test that normal chat is unaffected**

1. Ask a question like "What do you think of the introduction?"
2. Verify no cards appear — just normal text

**Step 5: Test edge cases**

- AI response with tags + normal text mixed: verify text renders and cards render
- Multiple `<create-file>` tags in one response: verify all cards render
- Incomplete tags while streaming: verify no partial/broken cards appear

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address edge cases in AI file creation"
```
