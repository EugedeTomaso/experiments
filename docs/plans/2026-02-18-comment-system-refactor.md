# Comment System Refactor & Version Restore Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 bugs in comment navigation/resolving/highlights and version restore by centralizing comment state into a `useComments` hook.

**Architecture:** Extract ~200 lines of comment state, handlers, and navigation logic from App.jsx into `src/hooks/useComments.js`. The hook owns all comment state and exposes a single `openComments` list used by decorations, navigation, and UI. The decoration plugin stops filtering internally and renders whatever it receives.

**Tech Stack:** React 18.2, ProseMirror decoration plugin, Milkdown v7.6.3

---

### Task 1: Fix Version Restore (independent quick win)

**Files:**
- Modify: `frontend/src/App.jsx:2113-2116`

**Step 1: Fix handleRestoreVersion to update the editor**

In `App.jsx`, find `handleRestoreVersion` (line 2113) and add the `replaceContent` call:

```javascript
const handleRestoreVersion = (version) => {
  const md = version.content_md || "";
  setDraft(md);
  setCompareVersionId(null);
  if (editorRef.current) {
    editorRef.current.replaceContent(md);
  }
};
```

**Step 2: Verify manually**

1. Open a document with multiple versions
2. Click a past version's "Restore" button
3. Editor content should update immediately to the restored version

**Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "fix: version restore now updates editor content immediately"
```

---

### Task 2: Remove internal filter from decoration plugin

**Files:**
- Modify: `frontend/src/commentDecorationPlugin.js:8-12`

**Step 1: Remove the status filter in buildDecorations**

The plugin should render whatever comments it receives without filtering. Replace:

```javascript
function buildDecorations(doc, comments) {
  // Only decorate root comments (no parent) that are open or recently actioned
  const rootComments = comments.filter(
    (c) => !c.parent && c.status !== "resolved"
  );
  const resolved = resolveCommentPositions(doc, rootComments);
```

With:

```javascript
function buildDecorations(doc, comments) {
  // Render all comments passed in — filtering is done by the caller
  const resolved = resolveCommentPositions(doc, comments);
```

This is safe because MarkdownEditor.jsx already filters to `comments.filter(c => c.quoted_text)` on line 97 before dispatching to the plugin. After the hook is created (Task 3), the hook will pass `openComments` which is fully pre-filtered.

**Step 2: Verify no regression**

Existing behavior should be unchanged since the caller already passes filtered comments. Resolved comments still get filtered — just at a different layer now.

**Step 3: Commit**

```bash
git add frontend/src/commentDecorationPlugin.js
git commit -m "refactor: decoration plugin renders all received comments without internal filtering"
```

---

### Task 3: Create useComments hook

**Files:**
- Create: `frontend/src/hooks/useComments.js`

**Step 1: Create the hook file**

Create `frontend/src/hooks/useComments.js` with the following content. This extracts all comment state and logic from App.jsx:

```javascript
import { useState, useMemo, useCallback, useRef } from "react";
import api from "../api";

/**
 * Centralized comment state and actions.
 *
 * `openComments` is the single source of truth for:
 *   - Which highlights to render (passed to decoration plugin)
 *   - Navigation prev/next ordering
 *   - Counter display (N/M)
 */
export function useComments({ nodeId, editorRef, editorWrapperRef }) {
  const [comments, setComments] = useState([]);
  const [activeThread, setActiveThread] = useState(null); // { comment, rect } | null
  const [focusedId, setFocusedId] = useState(null);
  const [aiThinkingId, setAiThinkingId] = useState(null);

  // --- Derived state ---

  // openComments: root comments that are actionable and have inline positions.
  // This is the ONLY list used for navigation, decorations, and counting.
  const openComments = useMemo(() => {
    return comments
      .filter(
        (c) =>
          !c.parent &&
          c.status !== "resolved" &&
          c.status !== "approved" &&
          c.status !== "rejected" &&
          c.quoted_text
      )
      .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity));
  }, [comments]);

  const navIndex = useMemo(() => {
    if (!focusedId) return -1;
    return openComments.findIndex((c) => c.id === focusedId);
  }, [focusedId, openComments]);

  const navTotal = openComments.length;

  // --- Loading ---

  const load = useCallback(
    async (nId) => {
      if (!nId) {
        setComments([]);
        return;
      }
      try {
        const list = await api.listComments(nId);
        setComments(list);
      } catch {
        setComments([]);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setComments([]);
    setActiveThread(null);
    setFocusedId(null);
    setAiThinkingId(null);
  }, []);

  // --- Navigation helpers ---

  const findHighlightElement = useCallback(
    (commentId) => {
      return editorWrapperRef.current?.querySelector(
        `[data-comment-id="${commentId}"]`
      );
    },
    [editorWrapperRef]
  );

  const navigateTo = useCallback(
    (commentId) => {
      setFocusedId(commentId);
      const el = findHighlightElement(commentId);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
        // Wait for scroll to finish before capturing position
        requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect();
          const comment = comments.find((c) => c.id === commentId);
          if (comment) {
            setActiveThread({ comment, rect });
          }
        });
      }
    },
    [comments, findHighlightElement]
  );

  const navigatePrev = useCallback(() => {
    if (openComments.length === 0) return;
    const currentIdx = focusedId != null
      ? openComments.findIndex((c) => c.id === focusedId)
      : -1;
    const prevIdx = currentIdx <= 0 ? openComments.length - 1 : currentIdx - 1;
    navigateTo(openComments[prevIdx].id);
  }, [openComments, focusedId, navigateTo]);

  const navigateNext = useCallback(() => {
    if (openComments.length === 0) return;
    const currentIdx = focusedId != null
      ? openComments.findIndex((c) => c.id === focusedId)
      : -1;
    const nextIdx = currentIdx >= openComments.length - 1 ? 0 : currentIdx + 1;
    navigateTo(openComments[nextIdx].id);
  }, [openComments, focusedId, navigateTo]);

  // --- Thread management ---

  const openThread = useCallback((comment, rect) => {
    setActiveThread({ comment, rect });
    setFocusedId(comment.id);
  }, []);

  const closeThread = useCallback(() => {
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  // --- Actions ---

  const create = useCallback(
    async (payload) => {
      const comment = await api.createComment(payload);
      setComments((prev) => [...prev, comment]);
      return comment;
    },
    []
  );

  const approve = useCallback(
    async (commentId) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment || !comment.suggested_text) return;

      // Apply suggestion to ProseMirror document
      if (editorRef.current) {
        editorRef.current.applySuggestion(
          comment.quoted_text,
          comment.suggested_text,
          comment.position_from
        );
      }

      try {
        const updated = await api.approveComment(commentId);
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
        );
        // Immediately resolve after approval (the decoration plugin already
        // excludes "approved" via openComments filter, so no ghost highlight).
        // The 1.5s CSS fade-out on .comment-highlight--approved handles the
        // visual transition before the decoration is removed.
        setTimeout(async () => {
          try {
            const resolved = await api.resolveComment(commentId);
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, ...resolved } : c
              )
            );
          } catch {
            // Fallback: at least mark locally as resolved
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, status: "resolved" } : c
              )
            );
          }
        }, 1500);
      } catch (err) {
        console.error("Approve failed:", err);
      }
      setActiveThread(null);
      setFocusedId(null);
    },
    [comments, editorRef]
  );

  const reject = useCallback(async (commentId) => {
    try {
      const updated = await api.rejectComment(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
    } catch (err) {
      console.error("Reject failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const resolve = useCallback(async (commentId) => {
    try {
      const updated = await api.resolveComment(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
    } catch (err) {
      console.error("Resolve failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const remove = useCallback(async (commentId) => {
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const reply = useCallback(
    async (parentId, body) => {
      if (!nodeId) return;
      const replyComment = await api.createComment({
        node: nodeId,
        parent: parentId,
        body,
        author_type: "user",
      });
      // Add reply to the parent's replies array
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), replyComment] }
            : c
        )
      );
      // Update active thread if open
      setActiveThread((prev) => {
        if (!prev || prev.comment.id !== parentId) return prev;
        return {
          ...prev,
          comment: {
            ...prev.comment,
            replies: [...(prev.comment.replies || []), replyComment],
          },
        };
      });
    },
    [nodeId]
  );

  const askAI = useCallback(
    async (commentId) => {
      if (!nodeId) return;
      setAiThinkingId(commentId);
      try {
        const providerSettings = JSON.parse(
          localStorage.getItem("mive:ai-provider") || "{}"
        );
        const provider = providerSettings.provider || "deepseek";
        const model = providerSettings.model || "deepseek-chat";
        const rootComment = comments.find((c) => c.id === commentId);
        const lastUserReply = (rootComment?.replies || [])
          .filter((r) => r.author_type === "user")
          .pop();
        if (!lastUserReply) return;

        const result = await api.requestCommentReply({
          comment_id: commentId,
          user_message: lastUserReply.body,
          provider,
          model,
        });
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                ...result.root_comment,
                replies: [...(c.replies || []), result.reply],
              };
            }
            return c;
          })
        );
        setActiveThread((prev) => {
          if (!prev || prev.comment.id !== commentId) return prev;
          return {
            ...prev,
            comment: {
              ...prev.comment,
              ...result.root_comment,
              replies: [...(prev.comment.replies || []), result.reply],
            },
          };
        });
      } catch (err) {
        console.error("AI reply failed:", err);
      } finally {
        setAiThinkingId(null);
      }
    },
    [nodeId, comments]
  );

  // Add comments in bulk (used by review and fact-check flows)
  const addBulk = useCallback((newComments) => {
    setComments((prev) => [...prev, ...newComments]);
  }, []);

  // Add a single comment (used by SSE fact-check stream)
  const addOne = useCallback((comment) => {
    setComments((prev) => [...prev, comment]);
  }, []);

  // --- Review progress (derived) ---
  const reviewComments = useMemo(
    () => comments.filter((c) => c.author_type === "assistant" && !c.parent),
    [comments]
  );
  const reviewResolved = useMemo(
    () =>
      reviewComments.filter(
        (c) =>
          c.status === "approved" ||
          c.status === "rejected" ||
          c.status === "resolved"
      ).length,
    [reviewComments]
  );
  const hasReviewProgress =
    reviewComments.length > 0 && reviewResolved < reviewComments.length;

  return {
    // State
    comments,
    openComments,
    activeThread,
    focusedId,
    navIndex,
    navTotal,
    aiThinkingId,
    // Review
    reviewComments,
    reviewResolved,
    hasReviewProgress,
    // Loading
    load,
    clear,
    // Navigation
    navigateTo,
    navigatePrev,
    navigateNext,
    // Thread
    openThread,
    closeThread,
    // Actions
    create,
    approve,
    reject,
    resolve,
    remove,
    reply,
    askAI,
    addBulk,
    addOne,
    // Raw setter (for edge cases in App.jsx that need direct access)
    setComments,
  };
}
```

**Step 2: Verify the file has no syntax errors**

Run: `cd frontend && npx -y acorn --ecma2020 --module src/hooks/useComments.js`

If acorn isn't available, just check with: `node -e "import('./src/hooks/useComments.js')"` (will fail on imports but no syntax errors).

**Step 3: Commit**

```bash
git add frontend/src/hooks/useComments.js
git commit -m "feat: create useComments hook centralizing comment state and actions"
```

---

### Task 4: Wire useComments into App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

This is the largest task. We're replacing ~200 lines of comment state, handlers, and navigation logic with the `useComments` hook.

**Step 1: Add the import**

At the top of App.jsx, add the import (near other hook imports):

```javascript
import { useComments } from "./hooks/useComments";
```

**Step 2: Replace comment state declarations**

Remove these lines (around lines 190, 273-274, 286-287):

```javascript
const [comments, setComments] = useState([]);
// ... (other state between)
const [commentInputState, setCommentInputState] = useState(null);
const [activeThreadComment, setActiveThreadComment] = useState(null);
// ... (other state between)
const [aiThinkingCommentId, setAiThinkingCommentId] = useState(null);
const [focusedCommentId, setFocusedCommentId] = useState(null);
```

Add in their place (keep `commentInputState` since it's for the CommentInput component, not the hook):

```javascript
const commentState = useComments({ nodeId: activeNodeId, editorRef, editorWrapperRef });
const {
  comments, openComments, activeThread: activeThreadComment,
  focusedId: focusedCommentId, navIndex: focusedNavIndex, navTotal,
  aiThinkingId: aiThinkingCommentId,
  reviewComments, reviewResolved, hasReviewProgress,
  load: loadComments, clear: clearComments,
  navigateTo: navigateToComment, navigatePrev: handleNavPrev, navigateNext: handleNavNext,
  openThread, closeThread: handleCloseThread,
  create: createComment, approve: handleApproveComment,
  reject: handleRejectComment, resolve: handleResolveComment,
  remove: handleDeleteComment, reply: handleReplyToComment,
  askAI: handleAskAIInThread, addBulk: addBulkComments, addOne: addOneComment,
  setComments,
} = commentState;
const [commentInputState, setCommentInputState] = useState(null);
```

**Step 3: Replace comment loading in the activeNodeId effect**

Find the effect around line 504 that loads comments. Replace:

```javascript
api.listComments(node.id).then(setComments).catch(() => setComments([]));
```

With:

```javascript
loadComments(node.id);
```

And replace:

```javascript
setComments([]);
```

With:

```javascript
clearComments();
```

**Step 4: Remove old handlers (lines ~1131-1398)**

Delete these functions and derived values (they now live in the hook):
- `handleApproveComment` (lines 1131-1162)
- `handleRejectComment` (lines 1164-1175)
- `handleResolveComment` (lines 1177-1188)
- `handleDeleteComment` (lines 1190-1199)
- `handleReplyToComment` (lines 1201-1228)
- `handleAskAIInThread` (lines 1230-1278)
- `reviewComments`, `reviewResolved`, `hasReviewProgress` (lines 1280-1287)
- `unresolvedComments` (lines 1291-1296)
- `focusedNavIndex` (lines 1298-1301)
- `getNavigableCommentIds` (lines 1305-1321)
- `navigateToComment` (lines 1324-1337)
- `handleNavPrev` (lines 1339-1345)
- `handleNavNext` (lines 1347-1353)
- Active highlight class sync effect (lines 1355-1369)
- `focusedCommentId` sync effect (lines 1372-1376)
- `handleCloseThread` (lines 1379-1382)
- Keyboard nav effect (lines 1384-1398)

**Step 5: Update handleHighlightClick**

Replace the `handleHighlightClick` callback (line 629) to use `openThread`:

```javascript
const handleHighlightClick = useCallback(
  (commentIds, rect) => {
    const rootComment = comments.find(
      (c) => commentIds.includes(c.id) && !c.parent
    );
    if (rootComment) {
      openThread(rootComment, rect);
    }
  },
  [comments, openThread]
);
```

**Step 6: Update handleCreateInlineComment**

Replace `setComments((prev) => [...prev, comment])` with `createComment`:

```javascript
const handleCreateInlineComment = async (body) => {
  if (!activeNode || !commentInputState) return;
  await createComment({
    node: activeNode.id,
    body,
    quoted_text: commentInputState.text,
    position_from: commentInputState.from,
    position_to: commentInputState.to,
  });
  setCommentInputState(null);
};
```

**Step 7: Update review and fact-check flows**

In `handleRequestReview` (around line 1036), replace:
```javascript
setComments((prev) => [...prev, ...newComments]);
```
With:
```javascript
addBulkComments(newComments);
```

In the SSE fact-check handler (around line 1110), replace:
```javascript
setComments((prev) => [...prev, parsed.comment]);
```
With:
```javascript
addOneComment(parsed.comment);
```

**Step 8: Update the review bar counter display**

In the review bar JSX (around line 2847), replace `unresolvedComments` references:

```javascript
{openComments.length > 0 && (
  <>
    <div className="comment-nav">
      {/* ... prev button ... */}
      <span className="comment-nav-count">
        {focusedNavIndex >= 0 ? focusedNavIndex + 1 : "–"}/{navTotal}
      </span>
      {/* ... next button ... */}
    </div>
    {/* ... */}
  </>
)}
```

**Step 9: Update CommentThread props**

In the CommentThread rendering (around line 3108), update nav props:

```javascript
onPrev={navTotal > 1 ? handleNavPrev : undefined}
onNext={navTotal > 1 ? handleNavNext : undefined}
navLabel={navTotal > 1 && focusedNavIndex >= 0
  ? `${focusedNavIndex + 1}/${navTotal}`
  : undefined}
```

**Step 10: Add active highlight class sync and keyboard nav effects**

These were deleted from App.jsx (they were inline) but the hook doesn't own the DOM. Add them back, using hook values:

```javascript
// Sync active highlight class on DOM
useEffect(() => {
  const wrapper = editorWrapperRef.current;
  if (!wrapper) return;
  wrapper.querySelectorAll(".comment-highlight--active").forEach((el) => {
    el.classList.remove("comment-highlight--active");
  });
  if (focusedCommentId) {
    wrapper.querySelectorAll(`[data-comment-id="${focusedCommentId}"]`).forEach((el) => {
      el.classList.add("comment-highlight--active");
    });
  }
}, [focusedCommentId]);

// Keyboard: Cmd+Shift+Arrow to navigate comments
useEffect(() => {
  const handler = (e) => {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      handleNavNext();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      handleNavPrev();
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [handleNavNext, handleNavPrev]);
```

**Step 11: Update MarkdownEditor comments prop**

In the MarkdownEditor JSX, change the `comments` prop to pass `openComments` so the decoration plugin receives pre-filtered data:

```javascript
<MarkdownEditor
  key={activeNode.id}
  docId={activeNode.id}
  value={activeNode.content_md || ""}
  onChange={setDraft}
  comments={openComments}
  editorRef={editorRef}
  readOnly={currentRole === "viewer"}
  currentRole={currentRole}
  collabSession={collabSession}
/>
```

**Step 12: Verify the app compiles**

Run: `cd frontend && npm run build`

Fix any import or reference errors.

**Step 13: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "refactor: wire useComments hook into App.jsx, remove ~200 lines of comment state"
```

---

### Task 5: Update MarkdownEditor to remove redundant comment filter

**Files:**
- Modify: `frontend/src/MarkdownEditor.jsx:92-101`

**Step 1: Remove the inline filter**

Since App.jsx now passes `openComments` (already filtered), remove the redundant filter in the sync effect. Replace:

```javascript
useEffect(() => {
  if (loading) return;
  get().action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const inlineComments = comments.filter((c) => c.quoted_text);
    const tr = view.state.tr.setMeta(commentDecoPluginKey, inlineComments);
    view.dispatch(tr);
  });
}, [comments, loading, get]);
```

With:

```javascript
useEffect(() => {
  if (loading) return;
  get().action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const tr = view.state.tr.setMeta(commentDecoPluginKey, comments);
    view.dispatch(tr);
  });
}, [comments, loading, get]);
```

The `comments` prop is now `openComments` from the hook, which is already filtered to root, non-resolved, with `quoted_text`.

**Step 2: Commit**

```bash
git add frontend/src/MarkdownEditor.jsx
git commit -m "refactor: remove redundant comment filter in MarkdownEditor sync effect"
```

---

### Task 6: End-to-end manual verification

**Step 1: Test version restore**

1. Open a document, make edits, wait for auto-save
2. Open version history dropdown
3. Click "Restore" on a past version
4. Verify: editor content updates immediately

**Step 2: Test comment highlights disappear on resolve**

1. Create an inline comment on some text
2. Click the highlight to open the thread
3. Click "Resolve"
4. Verify: highlight disappears immediately, thread closes

**Step 3: Test approve flow**

1. Trigger an AI review to get suggestion comments
2. Click a suggestion highlight
3. Click "Approve"
4. Verify: suggestion is applied, highlight fades out over ~1.5s, no ghost highlight remains

**Step 4: Test comment navigation**

1. Create 3+ inline comments on different parts of the document
2. Use the prev/next buttons in the review bar
3. Verify: counter shows correct N/M, thread moves to the correct comment
4. Verify: editor scrolls to the comment position
5. Verify: thread panel is positioned near the highlight (not at a stale position)

**Step 5: Test keyboard navigation**

1. With comments present, press Cmd+Shift+ArrowDown
2. Verify: navigates to next comment
3. Press Cmd+Shift+ArrowUp
4. Verify: navigates to previous comment

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
