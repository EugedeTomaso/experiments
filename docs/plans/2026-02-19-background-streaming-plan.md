# Background AI Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow AI streaming to continue in the background when the user navigates away, with track-changes review (accept/discard) when they return.

**Architecture:** Replace global streaming state with a per-node `streamingOpsRef` Map. The streaming fetch loop updates the Map entry; React state is derived from the active node's entry. Navigation reads from the Map instead of clearing state. Sidebar shows badges for nodes with active/completed AI operations.

**Tech Stack:** React 18 (useState, useRef, useEffect), existing Milkdown editor API (replaceContentDiff, showDiffHighlights, clearAiHighlights), existing CSS design system.

---

### Task 1: Add `streamingOpsRef` and helper functions

**Files:**
- Modify: `frontend/src/App.jsx:194` (add ref after `abortRef`)

**Step 1: Add the ref and helpers**

After line 195 (`preEditDraftRef`), add:

```jsx
// Per-node streaming operations — survives navigation
// Map<nodeId, { status, streamingContent, isEditingDocument, preEditDraft, result, convId, chatMessages }>
const streamingOpsRef = useRef(new Map());
```

Add a derived state for the sidebar badge — a simple `useState` that we'll update whenever the Map changes:

```jsx
const [aiActiveNodes, setAiActiveNodes] = useState(new Map()); // nodeId → 'streaming' | 'completed'
```

Add a helper to sync the badge state from the ref:

```jsx
const syncAiActiveNodes = useCallback(() => {
  const map = new Map();
  for (const [nodeId, op] of streamingOpsRef.current) {
    if (op.status === 'streaming' || op.status === 'completed') {
      map.set(nodeId, op.status);
    }
  }
  setAiActiveNodes(map);
}, []);
```

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add streamingOpsRef for per-node AI operations"
```

---

### Task 2: Update `handleSendMessageDirect` to use the Map

**Files:**
- Modify: `frontend/src/App.jsx:1445-1907` (the `handleSendMessageDirect` function)

**Step 1: Register the operation in the Map at stream start**

After line 1495 (`const targetEditor = editorRef.current;`), add:

```jsx
// Register this streaming operation in the per-node Map
const op = {
  status: 'streaming',
  streamingContent: '',
  isEditingDocument: false,
  preEditDraft: draft,
  result: null,
  convId: null,
  chatMessages: [...chatMessages, {
    role: 'user',
    content: userMsg,
    context: context || undefined,
    mentionedFiles: capturedMentionedIds.length > 0 ? capturedMentionedIds : undefined,
  }],
  abortController: abortRef.current,
};
streamingOpsRef.current.set(targetNodeId, op);
syncAiActiveNodes();
```

**Step 2: Update the Map's convId once the conversation is created**

After line 1506 (`setActiveConversationId(conv.id);`), add:

```jsx
op.convId = conv.id;
```

And after line 1498 (`let convId = activeConversationId;`) when convId already exists, also sync:

```jsx
op.convId = convId;
```

**Step 3: Guard React state setters — only update if still on the target node**

In the streaming loop (lines 1859-1872), wrap React setters with a guard:

```jsx
const isActiveTarget = () => activeNodeId === targetNodeId;
```

Note: `activeNodeId` is a closure over the value at the start of the function. We need a ref to read the *current* value. Add a `activeNodeIdRef` (see Task 3 for this). For now, note the pattern:

Replace the streaming content updates inside the `while(true)` loop. Where currently we have:

```jsx
if (state.mode === "document_edit") {
  setIsEditingDocument(true);
  // ...throttled apply...
  setStreamingContent(state.chatContent || "");
} else if (state.mode === "chat") {
  setStreamingContent(fullContent);
}
```

Change to:

```jsx
if (state.mode === "document_edit") {
  op.isEditingDocument = true;
  op.streamingContent = state.chatContent || "";
  if (activeNodeIdRef.current === targetNodeId) {
    setIsEditingDocument(true);
    setStreamingContent(state.chatContent || "");
  }
  // Typewriter: apply partial content throttled
  const now = Date.now();
  if (state.documentContent && targetEditor && now - lastApplyTime >= 80) {
    try { targetEditor.replaceContentDiff(state.documentContent, { streaming: true }); } catch (_) {}
    lastApplyTime = now;
    appliedDocument = true;
  }
} else if (state.mode === "chat") {
  op.streamingContent = fullContent;
  if (activeNodeIdRef.current === targetNodeId) {
    setStreamingContent(fullContent);
  }
}
```

**Step 4: Update `finalize()` to store result in Map**

Inside `finalize()` (line 1768), add at the beginning:

```jsx
op.status = 'completed';
```

After the document content is determined (line 1773-1803), also store the result:

```jsx
if (finalState.mode === "document_edit" && finalState.documentContent) {
  op.result = {
    documentContent: finalState.documentContent,
    chatContent: finalState.chatContent || "I've updated the document.",
    routedAgentId,
    routedAgentName,
  };
}
```

Guard the `setChatMessages`, `setDiffStats`, `setDiffVisible`, `setDiffAvailable` calls:

```jsx
if (activeNodeIdRef.current === targetNodeId) {
  // existing diff highlight code + setChatMessages
} else {
  // Store chat messages in the op for when user returns
  if (finalState.mode === "document_edit") {
    op.chatMessages = [...op.chatMessages, { role: "assistant", content: op.result?.chatContent || "I've updated the document.", isDocumentEdit: true, routedAgentId, routedAgentName }];
  } else {
    op.chatMessages = [...op.chatMessages, { role: "assistant", content: fullContent, routedAgentId, routedAgentName }];
  }
}
```

At the end of finalize, always sync badge state:

```jsx
syncAiActiveNodes();
```

Guard the `setStreamingContent("")`, `setIsStreaming(false)`, `setIsEditingDocument(false)` at the end of finalize:

```jsx
if (activeNodeIdRef.current === targetNodeId) {
  setStreamingContent("");
  setIsStreaming(false);
  setIsEditingDocument(false);
}
```

**Step 5: Same guard in the error/abort handlers**

In the `catch` block (lines 1880-1901) and `finally` block (1902-1906), guard with `activeNodeIdRef.current === targetNodeId`. Also update the Map entry:

```jsx
// In catch:
op.status = 'error';
streamingOpsRef.current.delete(targetNodeId);
syncAiActiveNodes();

// In finally:
if (activeNodeIdRef.current === targetNodeId) {
  setIsStreaming(false);
}
```

**Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: streaming loop writes to per-node Map, guards React setters"
```

---

### Task 3: Add `activeNodeIdRef` for current-value access in closures

**Files:**
- Modify: `frontend/src/App.jsx:185` (after `activeNodeId` state declaration)

**Step 1: Add the ref**

After line 185 (`const [activeNodeId, setActiveNodeId] = useState(null);`), add:

```jsx
const activeNodeIdRef = useRef(activeNodeId);
```

And add a useEffect to keep it in sync:

```jsx
useEffect(() => {
  activeNodeIdRef.current = activeNodeId;
}, [activeNodeId]);
```

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add activeNodeIdRef for closure-safe access"
```

---

### Task 4: Update the `activeNodeId` useEffect — restore from Map instead of clearing

**Files:**
- Modify: `frontend/src/App.jsx:702-714` (the `useEffect` on `activeNodeId`)

**Step 1: Replace the useEffect**

Replace lines 702-714 with:

```jsx
// Load conversations when node changes; restore or reset chat state
useEffect(() => {
  // Check if the new node has an active/completed streaming operation
  const op = activeNodeId ? streamingOpsRef.current.get(activeNodeId) : null;

  if (op && (op.status === 'streaming' || op.status === 'completed')) {
    // Restore state from the Map
    setChatMessages(op.chatMessages || []);
    setStreamingContent(op.streamingContent || "");
    setIsStreaming(op.status === 'streaming');
    setIsEditingDocument(op.isEditingDocument || false);
    setChatInput("");
    setActiveConversationId(op.convId || null);
    setMentionedFileIds([]);

    if (op.status === 'completed' && op.result) {
      // Apply completed result to the editor after it mounts
      setTimeout(() => {
        if (editorRef.current) {
          try {
            editorRef.current.replaceContentDiff(op.result.documentContent);
            setTimeout(() => {
              try {
                editorRef.current.showDiffHighlights();
                const stats = editorRef.current.getDiffStats();
                setDiffStats(stats);
                setDiffVisible(true);
                setDiffAvailable(true);
                setCompareVersionId(null);
              } catch (_) {}
            }, 400);
          } catch (_) {}
        }
      }, 300); // Wait for editor to mount with new content
    }

    // Still load conversations list
    if (activeNodeId) {
      api.listConversations(activeNodeId).then(setConversations).catch(() => setConversations([]));
    }
  } else {
    // No active operation — clean reset as before
    setChatMessages([]);
    setStreamingContent("");
    setChatInput("");
    setActiveConversationId(null);
    setMentionedFileIds([]);
    setIsStreaming(false);
    setIsEditingDocument(false);
    if (activeNodeId) {
      api.listConversations(activeNodeId).then(setConversations).catch(() => setConversations([]));
    } else {
      setConversations([]);
    }
  }
}, [activeNodeId]);
```

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: restore streaming state from Map on navigation"
```

---

### Task 5: Update `handleAcceptEdit` and `handleUndoEdit` to clean up the Map

**Files:**
- Modify: `frontend/src/App.jsx:1915-1940` (handleUndoEdit and handleAcceptEdit)

**Step 1: Add Map cleanup to handleAcceptEdit**

```jsx
const handleAcceptEdit = () => {
  if (editorRef.current) {
    editorRef.current.clearAiHighlights();
  }
  setDiffVisible(false);
  setDiffAvailable(false);
  setDiffStats(null);
  setCompareVersionId(null);
  preEditDraftRef.current = null;
  // Clean up the streaming op
  if (activeNodeId) {
    streamingOpsRef.current.delete(activeNodeId);
    syncAiActiveNodes();
  }
};
```

**Step 2: Add Map cleanup to handleUndoEdit**

```jsx
const handleUndoEdit = () => {
  // Check the Map first for the pre-edit draft (works even if we navigated away and back)
  const op = activeNodeId ? streamingOpsRef.current.get(activeNodeId) : null;
  const originalDraft = op?.preEditDraft ?? preEditDraftRef.current;

  if (originalDraft != null && editorRef.current) {
    editorRef.current.replaceContent(originalDraft);
    editorRef.current.clearAiHighlights();
    setDiffVisible(false);
    setDiffAvailable(false);
    setDiffStats(null);
    setCompareVersionId(null);
    // Persist undo
    if (activeNodeId) {
      api.updateNode(activeNodeId, { content_md: originalDraft }).catch(() => {});
    }
    preEditDraftRef.current = null;
  }
  // Clean up the streaming op
  if (activeNodeId) {
    streamingOpsRef.current.delete(activeNodeId);
    syncAiActiveNodes();
  }
};
```

**Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: accept/discard clean up per-node streaming Map"
```

---

### Task 6: Add sidebar badge to TreeItem

**Files:**
- Modify: `frontend/src/components/TreeItem.jsx:43-67` (props) and `~272-290` (render)
- Modify: `frontend/src/App.jsx:2629-2654` (TreeItem render, pass new prop)

**Step 1: Pass `aiActiveNodes` to TreeItem**

In `App.jsx` at line ~2629, add the prop:

```jsx
<TreeItem
  key={node.id}
  node={node}
  // ...existing props...
  aiActiveNodes={aiActiveNodes}
/>
```

**Step 2: Accept and use the prop in TreeItem**

In `TreeItem.jsx`, add `aiActiveNodes` to the destructured props (line ~67).

After line 70 (`const hasAgent = agentNodeIds?.has(String(node.id));`), add:

```jsx
const aiStatus = aiActiveNodes?.get(String(node.id)); // 'streaming' | 'completed' | undefined
```

After the `<span className="tree-icon">` block (around line 272-274), add an indicator dot:

```jsx
<span className="tree-icon">
  <FileIcon />
  {aiStatus && (
    <span className={`tree-ai-badge ${aiStatus}`} />
  )}
</span>
```

**Step 3: Pass `aiActiveNodes` recursively to children**

In TreeItem's recursive render of children (around line 331), pass the prop through:

```jsx
<TreeItem
  // ...existing props...
  aiActiveNodes={aiActiveNodes}
/>
```

**Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/TreeItem.jsx
git commit -m "feat: add AI activity badge to sidebar tree items"
```

---

### Task 7: Add sidebar badge to FolderView (grid/list views)

**Files:**
- Modify: `frontend/src/components/FolderView.jsx:39-49` (props) and grid/list renders
- Modify: `frontend/src/App.jsx:2818-2833` (FolderView render, pass new prop)

**Step 1: Pass `aiActiveNodes` to FolderView**

In `App.jsx` at the FolderView render (~line 2818):

```jsx
<FolderView
  // ...existing props...
  aiActiveNodes={aiActiveNodes}
/>
```

**Step 2: Accept and render in FolderView**

Add `aiActiveNodes` to the destructured props.

In the grid view card (around line 198-200), after the icon span:

```jsx
<span className="folder-card-icon">
  {child.type === "folder" ? <FolderIcon /> : <FileIcon />}
  {aiActiveNodes?.get(String(child.id)) && (
    <span className={`tree-ai-badge ${aiActiveNodes.get(String(child.id))}`} />
  )}
</span>
```

In the list view (around line 243):

```jsx
<span className="folder-list-icon">
  {child.type === "folder" ? <FolderIcon /> : <FileIcon />}
  {aiActiveNodes?.get(String(child.id)) && (
    <span className={`tree-ai-badge ${aiActiveNodes.get(String(child.id))}`} />
  )}
</span>
```

**Step 3: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/FolderView.jsx
git commit -m "feat: add AI activity badge to folder grid/list views"
```

---

### Task 8: Add CSS for the AI badge

**Files:**
- Modify: `frontend/src/App.css` (add styles near existing `.tree-icon` styles)

**Step 1: Add badge styles**

Search for `.tree-icon` in App.css and add after it:

```css
/* AI activity badge — small dot on tree/folder items */
.tree-icon,
.folder-card-icon,
.folder-list-icon {
  position: relative;
}

.tree-ai-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--surface);
}

.tree-ai-badge.streaming {
  background: var(--amber-9, #f59e0b);
  animation: ai-badge-pulse 1.5s ease-in-out infinite;
}

.tree-ai-badge.completed {
  background: var(--green-9, #22c55e);
}

@keyframes ai-badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add CSS for AI activity badge (pulsing orange/green dot)"
```

---

### Task 9: Fix the `isStreaming` guard in `handleSendMessageDirect`

**Files:**
- Modify: `frontend/src/App.jsx:1447`

**Step 1: Update the guard**

Currently line 1447 checks the global `isStreaming`:

```jsx
if (!rawMsg.trim() || isStreaming || !activeProjectId) return;
```

This should also check if the *current node* already has an active operation:

```jsx
const nodeHasActiveOp = activeNodeId && streamingOpsRef.current.get(activeNodeId)?.status === 'streaming';
if (!rawMsg.trim() || (isStreaming && nodeHasActiveOp) || !activeProjectId) return;
```

This allows sending messages on different nodes while another node is streaming, but prevents double-streaming the same node.

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: allow sending messages on other nodes while one is streaming"
```

---

### Task 10: Manual integration test

**Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

**Step 2: Test the flow**

1. Open a document, send a message that triggers a document edit (e.g., "Write a 500-word essay about coffee")
2. While the AI is streaming, click on a different document in the sidebar
3. Verify: the sidebar shows an orange pulsing dot on the original document
4. Navigate back to the original document
5. Verify: you see the streaming continuing in real-time (if still in progress) OR the completed changes with green diff highlights and accept/discard banner (if finished)
6. Click "Accept" — verify the badge disappears and the changes are kept
7. Repeat steps 1-5 but click "Discard" — verify the original content is restored

**Step 3: Test edge cases**

1. Start streaming on doc A, navigate to doc B, start a new chat on doc B (not document edit, just a question) — verify both work independently
2. Start streaming on doc A, navigate to a folder view — verify the badge shows in the grid/list
3. Start streaming, navigate away, navigate to a third document, then back to the streaming doc — verify state is preserved through multiple navigations

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: background AI streaming with per-node state and review on return"
```
