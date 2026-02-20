# Background AI Streaming Design

## Problem

When the AI streams content into a document and the user navigates to another document (or project), the streaming appears to be interrupted. The `useEffect` on `activeNodeId` clears `streamingContent` and `isStreaming` state, so the UI loses track of the operation. The fetch itself continues in the background (it captures `targetNodeId` and `targetEditor`), but the user has no way to see the result when they return.

## Goal

Allow users to navigate freely while AI operations run in the background. When returning to a document with a completed (or in-progress) AI operation, show the changes with track-changes style highlighting and accept/discard controls.

## Design

### Data Model: `streamingOpsRef`

A `useRef(new Map())` in App.jsx where each key is a `nodeId` and each value is:

```
{
  isStreaming: boolean,
  streamingContent: string,      // partial chat content
  isEditingDocument: boolean,
  parser: StreamParser,
  preEditDraft: string,          // document snapshot before AI edit
  result: null | {
    documentContent: string,
    chatContent: string,
    routedAgentId: string|null,
    routedAgentName: string|null,
  },
  status: 'streaming' | 'completed' | 'accepted' | 'discarded'
}
```

React state variables (`isStreaming`, `streamingContent`, `isEditingDocument`) remain as **derived views** of the active node's entry in the Map.

### Streaming Flow (changes to `handleSendMessageDirect`)

1. **Start**: Create entry in `streamingOpsRef` for `targetNodeId` with `status: 'streaming'`
2. **During**: Update the Map entry. Only call React setters (`setIsStreaming`, `setStreamingContent`, etc.) if `activeNodeId === targetNodeId` at that moment.
3. **Finalize**: Mark `status: 'completed'`, store `result`. If the node is still active, apply diff highlights + show accept/discard banner. If not active, the result waits in the Map.

### Navigation (`useEffect` on `activeNodeId`)

When `activeNodeId` changes:
- Do NOT blindly clear streaming state
- Read `streamingOpsRef.current.get(newActiveNodeId)`:
  - `status === 'streaming'` → restore `isStreaming=true`, `streamingContent` from Map, reconnect with live streaming display
  - `status === 'completed'` → load `preEditDraft` in editor, apply `replaceContentDiff(result.documentContent)`, show diff highlights + accept/discard banner
  - No entry → clean state (load conversations as before)
- For the **old** node being navigated away from: no cleanup needed, the Map retains the state

### Track Changes UI

When returning to a node with `status: 'completed'`:
1. Editor loads the original `preEditDraft`
2. Applies `replaceContentDiff(result.documentContent)` + `showDiffHighlights()`
3. A banner appears above the editor:
   ```
   [sparkles icon] AI made changes to this document    [Accept] [Discard]
   ```
4. **Accept**: keeps the new content, removes the Map entry, clears diff highlights
5. **Discard**: restores `preEditDraft`, removes the Map entry, persists original content via API

### Sidebar Badge (FolderView)

- App.jsx computes a `Set<nodeId>` or `Map<nodeId, status>` from `streamingOpsRef` and passes it as a prop to FolderView
- FolderView renders a small indicator dot next to the document name:
  - Orange/pulsing for `streaming` (AI is working)
  - Green for `completed` (pending review)
- Badge disappears when status becomes `accepted` or `discarded`

### Edge Cases

- **User sends another message while previous completed result is pending**: Accept the pending result first, then proceed with the new message
- **User manually edits the document while AI result is pending**: Clear the pending result (user's edit takes precedence)
- **Multiple streaming ops on different nodes simultaneously**: Each runs independently in the Map; the UI shows whichever corresponds to the active node
- **Editor instance becomes stale**: The captured `targetEditor` may be unmounted. The `finalize()` already handles this with try/catch. The Map stores the result for when the user returns and a fresh editor is mounted.
