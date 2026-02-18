# Review Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the AssistantPanel into a tabbed interface (Chat | Review | Verify) for reviewing AI comments, approving/dismissing suggestions, and verifying facts.

**Architecture:** Add tab state to App.jsx, extend useComments with tab-filtered derived lists, split AssistantPanel content into three tab views. Review/Verify tabs render card lists with inline actions and reply threads. Entry points: topbar button, slash commands, selection toolbar.

**Tech Stack:** React 18.2, Milkdown/ProseMirror, CSS custom properties, Playwright for e2e tests.

**Design doc:** `docs/plans/2026-02-18-review-panel-design.md`

---

### Task 1: Extend useComments with tab-filtered derived state

**Files:**
- Modify: `frontend/src/hooks/useComments.js`

**Step 1: Add derived state for Review tab comments**

After the existing `decorationComments` useMemo (around line 45), add:

```js
const reviewTabComments = useMemo(() =>
  comments
    .filter(c => !c.parent && c.comment_type !== "fact_check" && c.status !== "resolved" && c.quoted_text && isAnchored(c))
    .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity)),
  [comments, content]
);

const verifyTabComments = useMemo(() =>
  comments
    .filter(c => !c.parent && c.comment_type === "fact_check" && c.status !== "resolved" && c.quoted_text && isAnchored(c))
    .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity)),
  [comments, content]
);

const reviewPendingCount = useMemo(() =>
  reviewTabComments.filter(c => c.status === "open").length,
  [reviewTabComments]
);

const verifyPendingCount = useMemo(() =>
  verifyTabComments.filter(c => c.status === "open").length,
  [verifyTabComments]
);

const reviewAcceptedCount = useMemo(() =>
  comments.filter(c => !c.parent && c.comment_type !== "fact_check" && (c.status === "approved" || c.status === "rejected" || c.status === "resolved") && c.author_type === "assistant").length,
  [comments]
);

const reviewDismissedCount = useMemo(() =>
  comments.filter(c => !c.parent && c.comment_type !== "fact_check" && c.status === "rejected" && c.author_type === "assistant").length,
  [comments]
);
```

**Step 2: Add a `getReplies` helper**

```js
const getReplies = useCallback((parentId) =>
  comments.filter(c => c.parent === parentId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  [comments]
);
```

**Step 3: Expose new values in the return object**

Add to the return statement:

```js
reviewTabComments, verifyTabComments,
reviewPendingCount, verifyPendingCount,
reviewAcceptedCount, reviewDismissedCount,
getReplies,
```

**Step 4: Commit**

```bash
git add frontend/src/hooks/useComments.js
git commit -m "feat: extend useComments with tab-filtered derived state"
```

---

### Task 2: Create ReviewCard component

**Files:**
- Create: `frontend/src/components/ReviewCard.jsx`

**Step 1: Create the ReviewCard component**

```jsx
import { useState, useRef, useEffect } from "react";
import { timeAgo } from "../utils";

export function ReviewCard({
  comment,
  replies,
  isActive,
  isAiThinking,
  onClick,
  onApprove,
  onDismiss,
  onResolve,
  onDelete,
  onReply,
  onAskAI,
}) {
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const replyInputRef = useRef(null);

  useEffect(() => {
    if (isThreadOpen && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [isThreadOpen]);

  const isAI = comment.author_type === "assistant";
  const hasSuggestion = !!comment.suggested_text;
  const isOpen = comment.status === "open";
  const isApproved = comment.status === "approved";
  const isRejected = comment.status === "rejected";

  const handleReplySubmit = () => {
    const text = replyText.trim();
    if (!text) return;
    onReply(comment.id, text);
    setReplyText("");
  };

  const handleReplyKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReplySubmit();
    }
    if (e.key === "Escape") {
      setIsThreadOpen(false);
      setReplyText("");
    }
  };

  return (
    <div
      className={`review-card${isActive ? " review-card--active" : ""}${isApproved ? " review-card--approved" : ""}${isRejected ? " review-card--rejected" : ""}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="review-card-header">
        <span className="review-card-icon">
          {isAI ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            </svg>
          )}
        </span>
        <span className="review-card-author">{comment.author_label || (isAI ? "Assistant" : "You")}</span>
        <span className="review-card-time">{timeAgo(comment.created_at)}</span>
      </div>

      {/* Quoted text */}
      {comment.quoted_text && (
        <div className="review-card-quote">
          "{comment.quoted_text.length > 80 ? comment.quoted_text.slice(0, 80) + "…" : comment.quoted_text}"
        </div>
      )}

      {/* Body */}
      <div className="review-card-body">{comment.body}</div>

      {/* Suggestion diff */}
      {hasSuggestion && (
        <div className="review-card-diff">
          <del className="review-card-diff-del">{comment.quoted_text}</del>
          <ins className="review-card-diff-ins">{comment.suggested_text}</ins>
        </div>
      )}

      {/* Actions */}
      {isOpen && (
        <div className="review-card-actions">
          {isAI && hasSuggestion && (
            <button className="review-card-btn review-card-btn--accept" onClick={(e) => { e.stopPropagation(); onApprove(comment.id); }}>
              Accept
            </button>
          )}
          {isAI ? (
            <button className="review-card-btn review-card-btn--dismiss" onClick={(e) => { e.stopPropagation(); onDismiss(comment.id); }}>
              Dismiss
            </button>
          ) : (
            <>
              <button className="review-card-btn review-card-btn--dismiss" onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}>
                Resolve
              </button>
              <button className="review-card-btn review-card-btn--delete" onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}>
                Delete
              </button>
            </>
          )}
          <button className="review-card-btn review-card-btn--reply" onClick={(e) => { e.stopPropagation(); setIsThreadOpen(!isThreadOpen); }}>
            Reply
          </button>
        </div>
      )}

      {/* Thread */}
      {isThreadOpen && (
        <div className="review-card-thread" onClick={(e) => e.stopPropagation()}>
          {replies.map((r) => (
            <div key={r.id} className={`review-card-reply review-card-reply--${r.author_type}`}>
              <span className="review-card-reply-author">{r.author_label || (r.author_type === "assistant" ? "Assistant" : "You")}</span>
              <span className="review-card-reply-body">{r.body}</span>
            </div>
          ))}
          {isAiThinking && (
            <div className="review-card-reply review-card-reply--assistant">
              <span className="review-card-reply-author">Assistant</span>
              <span className="review-card-thinking-spinner" />
            </div>
          )}
          {!isAiThinking && replies.length > 0 && replies[replies.length - 1].author_type === "user" && (
            <button className="review-card-ask-ai" onClick={() => onAskAI(comment.id)}>
              Ask Assistant
            </button>
          )}
          <div className="review-card-reply-composer">
            <textarea
              ref={replyInputRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Reply…"
              rows={1}
            />
            <button
              className="review-card-reply-send"
              disabled={!replyText.trim()}
              onClick={handleReplySubmit}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ReviewCard.jsx
git commit -m "feat: create ReviewCard component for review tab"
```

---

### Task 3: Create VerifyCard component

**Files:**
- Create: `frontend/src/components/VerifyCard.jsx`

**Step 1: Create the VerifyCard component**

```jsx
import { useState } from "react";
import { timeAgo } from "../utils";

const VERDICT_CONFIG = {
  verified: { label: "Verified", className: "review-card-verdict--verified" },
  dubious:  { label: "Dubious",  className: "review-card-verdict--dubious" },
  false:    { label: "False",    className: "review-card-verdict--false" },
};

export function VerifyCard({
  comment,
  isActive,
  onClick,
  onAccept,
  onDismiss,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const verdict = VERDICT_CONFIG[comment.verdict] || null;
  const hasSuggestion = !!comment.suggested_text;
  const isOpen = comment.status === "open";
  const isApproved = comment.status === "approved";
  const isRejected = comment.status === "rejected";
  const sources = comment.sources || [];

  return (
    <div
      className={`review-card review-card--verify${isActive ? " review-card--active" : ""}${isApproved ? " review-card--approved" : ""}${isRejected ? " review-card--rejected" : ""}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="review-card-header">
        <span className="review-card-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <path d="M8 4v5M8 11v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="review-card-author">Fact-Check</span>
        <span className="review-card-time">{timeAgo(comment.created_at)}</span>
      </div>

      {/* Claim text */}
      {comment.quoted_text && (
        <div className="review-card-quote">
          "{comment.quoted_text.length > 100 ? comment.quoted_text.slice(0, 100) + "…" : comment.quoted_text}"
        </div>
      )}

      {/* Verdict badge */}
      {verdict && (
        <span className={`review-card-verdict ${verdict.className}`}>
          {verdict.label}
        </span>
      )}

      {/* Explanation */}
      <div className="review-card-body">{comment.body}</div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="review-card-sources">
          <button
            className="review-card-sources-toggle"
            onClick={(e) => { e.stopPropagation(); setSourcesOpen(!sourcesOpen); }}
          >
            {sourcesOpen ? "▾" : "▸"} Sources ({sources.length})
          </button>
          {sourcesOpen && (
            <ul className="review-card-sources-list">
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                  {s.snippet && <span className="review-card-source-snippet">{s.snippet}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Suggestion diff */}
      {hasSuggestion && (
        <div className="review-card-diff">
          <del className="review-card-diff-del">{comment.quoted_text}</del>
          <ins className="review-card-diff-ins">{comment.suggested_text}</ins>
        </div>
      )}

      {/* Actions */}
      {isOpen && (
        <div className="review-card-actions">
          {hasSuggestion && (
            <button className="review-card-btn review-card-btn--accept" onClick={(e) => { e.stopPropagation(); onAccept(comment.id); }}>
              Accept
            </button>
          )}
          <button className="review-card-btn review-card-btn--dismiss" onClick={(e) => { e.stopPropagation(); onDismiss(comment.id); }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/VerifyCard.jsx
git commit -m "feat: create VerifyCard component for verify tab"
```

---

### Task 4: Create ReviewTab component

**Files:**
- Create: `frontend/src/components/ReviewTab.jsx`

**Step 1: Create the ReviewTab with list, empty state, and complete state**

```jsx
import { ReviewCard } from "./ReviewCard";

export function ReviewTab({
  comments,
  pendingCount,
  acceptedCount,
  dismissedCount,
  focusedCommentId,
  aiThinkingId,
  getReplies,
  onClickComment,
  onApprove,
  onDismiss,
  onResolve,
  onDelete,
  onReply,
  onAskAI,
  onLaunchReview,
  isReviewing,
}) {
  const allResolved = comments.length > 0 && pendingCount === 0;
  const isEmpty = comments.length === 0 && !isReviewing;

  // Empty state
  if (isEmpty) {
    return (
      <div className="review-tab-empty">
        <div className="review-tab-empty-heading">No review comments yet.</div>
        <div className="review-tab-empty-desc">Run a review to get AI feedback on your writing.</div>
        <div className="review-tab-empty-actions">
          <button className="review-tab-launch-btn" onClick={() => onLaunchReview("all")}>Review All</button>
          <button className="review-tab-launch-btn" onClick={() => onLaunchReview("grammar")}>Grammar</button>
          <button className="review-tab-launch-btn" onClick={() => onLaunchReview("style")}>Style</button>
        </div>
      </div>
    );
  }

  // All resolved state
  if (allResolved && !isReviewing) {
    return (
      <div className="review-tab-complete">
        <div className="review-tab-complete-heading">All comments resolved</div>
        <div className="review-tab-complete-stats">
          {acceptedCount > 0 && <span>{acceptedCount} accepted</span>}
          {acceptedCount > 0 && dismissedCount > 0 && <span> · </span>}
          {dismissedCount > 0 && <span>{dismissedCount} dismissed</span>}
        </div>
        <button className="review-tab-launch-btn" onClick={() => onLaunchReview("all")}>
          Run another review
        </button>
      </div>
    );
  }

  return (
    <div className="review-tab">
      {/* Loading indicator */}
      {isReviewing && (
        <div className="review-tab-loading">
          <span className="review-tab-loading-spinner" />
          <span>Analyzing your document…</span>
        </div>
      )}

      {/* Card list */}
      <div className="review-tab-list">
        {comments.map((c) => (
          <ReviewCard
            key={c.id}
            comment={c}
            replies={getReplies(c.id)}
            isActive={c.id === focusedCommentId}
            isAiThinking={c.id === aiThinkingId}
            onClick={() => onClickComment(c)}
            onApprove={onApprove}
            onDismiss={onDismiss}
            onResolve={onResolve}
            onDelete={onDelete}
            onReply={onReply}
            onAskAI={onAskAI}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ReviewTab.jsx
git commit -m "feat: create ReviewTab component with card list and states"
```

---

### Task 5: Create VerifyTab component

**Files:**
- Create: `frontend/src/components/VerifyTab.jsx`

**Step 1: Create the VerifyTab**

```jsx
import { VerifyCard } from "./VerifyCard";

export function VerifyTab({
  comments,
  pendingCount,
  focusedCommentId,
  onClickComment,
  onAccept,
  onDismiss,
  onLaunchFactCheck,
  isFactChecking,
  factCheckProgress,
}) {
  const allResolved = comments.length > 0 && pendingCount === 0;
  const isEmpty = comments.length === 0 && !isFactChecking;

  if (isEmpty) {
    return (
      <div className="review-tab-empty">
        <div className="review-tab-empty-heading">No fact-checks yet.</div>
        <div className="review-tab-empty-desc">Run a fact-check to verify claims in your writing.</div>
        <div className="review-tab-empty-actions">
          <button className="review-tab-launch-btn" onClick={() => onLaunchFactCheck()}>Run Fact-Check</button>
        </div>
      </div>
    );
  }

  if (allResolved && !isFactChecking) {
    return (
      <div className="review-tab-complete">
        <div className="review-tab-complete-heading">All claims reviewed</div>
        <button className="review-tab-launch-btn" onClick={() => onLaunchFactCheck()}>
          Run another fact-check
        </button>
      </div>
    );
  }

  return (
    <div className="review-tab">
      {/* Loading with progress */}
      {isFactChecking && (
        <div className="review-tab-loading">
          <span className="review-tab-loading-spinner" />
          <span>
            {factCheckProgress
              ? `Checking claims… ${factCheckProgress.done}/${factCheckProgress.total}`
              : "Extracting claims…"
            }
          </span>
          {factCheckProgress && (
            <div className="review-tab-progress-bar">
              <div
                className="review-tab-progress-fill"
                style={{ width: `${(factCheckProgress.done / factCheckProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="review-tab-list">
        {comments.map((c) => (
          <VerifyCard
            key={c.id}
            comment={c}
            isActive={c.id === focusedCommentId}
            onClick={() => onClickComment(c)}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/VerifyTab.jsx
git commit -m "feat: create VerifyTab component with progress and states"
```

---

### Task 6: Add tab bar to AssistantPanel

**Files:**
- Modify: `frontend/src/components/AssistantPanel.jsx`

**Step 1: Add tab props and imports**

At the top of the file, add imports:

```js
import { ReviewTab } from "./ReviewTab";
import { VerifyTab } from "./VerifyTab";
```

Add new props to the component signature (after `activeProjectId`):

```js
  // Tab system
  activeTab,         // "chat" | "review" | "verify"
  onTabChange,       // (tab) => void
  // Review tab data
  reviewTabComments,
  reviewPendingCount,
  reviewAcceptedCount,
  reviewDismissedCount,
  verifyTabComments,
  verifyPendingCount,
  focusedCommentId,
  aiThinkingId,
  getReplies,
  onClickComment,
  onApproveComment,
  onDismissComment,
  onResolveComment,
  onDeleteComment,
  onReplyComment,
  onAskAIComment,
  onLaunchReview,
  onLaunchFactCheck,
  isReviewing,
  isFactChecking,
  factCheckProgress,
```

**Step 2: Add tab bar JSX after the header**

Insert right after the closing `</div>` of `.agent-pane-header` (around line 476), before the memory strip:

```jsx
      {/* Tab bar */}
      <div className="agent-tab-bar">
        <button
          className={`agent-tab${activeTab === "chat" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("chat")}
        >
          Chat
        </button>
        <button
          className={`agent-tab${activeTab === "review" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("review")}
        >
          Review
          {reviewPendingCount > 0 && <span className="agent-tab-badge">{reviewPendingCount}</span>}
        </button>
        <button
          className={`agent-tab${activeTab === "verify" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("verify")}
        >
          Verify
          {verifyPendingCount > 0 && <span className="agent-tab-badge">{verifyPendingCount}</span>}
        </button>
      </div>
```

**Step 3: Conditionally render tab content**

Wrap the existing memory strip + body + action block + context block + composer in a condition `{activeTab === "chat" && ( ... )}`. Then add the other two tabs:

After the chat content block:

```jsx
      {activeTab === "review" && (
        <div className="agent-pane-body">
          <ReviewTab
            comments={reviewTabComments}
            pendingCount={reviewPendingCount}
            acceptedCount={reviewAcceptedCount}
            dismissedCount={reviewDismissedCount}
            focusedCommentId={focusedCommentId}
            aiThinkingId={aiThinkingId}
            getReplies={getReplies}
            onClickComment={onClickComment}
            onApprove={onApproveComment}
            onDismiss={onDismissComment}
            onResolve={onResolveComment}
            onDelete={onDeleteComment}
            onReply={onReplyComment}
            onAskAI={onAskAIComment}
            onLaunchReview={onLaunchReview}
            isReviewing={isReviewing}
          />
        </div>
      )}

      {activeTab === "verify" && (
        <div className="agent-pane-body">
          <VerifyTab
            comments={verifyTabComments}
            pendingCount={verifyPendingCount}
            focusedCommentId={focusedCommentId}
            onClickComment={onClickComment}
            onAccept={onApproveComment}
            onDismiss={onDismissComment}
            onLaunchFactCheck={onLaunchFactCheck}
            isFactChecking={isFactChecking}
            factCheckProgress={factCheckProgress}
          />
        </div>
      )}
```

**Step 4: Commit**

```bash
git add frontend/src/components/AssistantPanel.jsx
git commit -m "feat: add tab bar and review/verify tabs to AssistantPanel"
```

---

### Task 7: Wire tab state and comment data in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add tab state**

Near the existing `isAssistantOpen` state (around line 200), add:

```js
const [assistantTab, setAssistantTab] = useState("chat");
```

**Step 2: Auto-switch tab on review launch**

In `handleRequestReview` (around line 1127), after `setIsReviewing(true)`, add:

```js
setAssistantTab("review");
if (!isAssistantOpen) setIsAssistantOpen(true);
```

In `handleFactCheck` (around line 1155), after `setIsFactChecking(true)`, add:

```js
setAssistantTab("verify");
if (!isAssistantOpen) setIsAssistantOpen(true);
```

**Step 3: Add comment click handler**

Before the AssistantPanel render, add a handler that scrolls the editor to a comment's highlight and focuses it:

```js
const handlePanelCommentClick = useCallback((comment) => {
  commentState.navigateTo(comment.id);
}, [commentState]);
```

**Step 4: Pass new props to AssistantPanel**

Add to the `<AssistantPanel>` JSX (around line 2826):

```jsx
  activeTab={assistantTab}
  onTabChange={setAssistantTab}
  reviewTabComments={commentState.reviewTabComments}
  reviewPendingCount={commentState.reviewPendingCount}
  reviewAcceptedCount={commentState.reviewAcceptedCount}
  reviewDismissedCount={commentState.reviewDismissedCount}
  verifyTabComments={commentState.verifyTabComments}
  verifyPendingCount={commentState.verifyPendingCount}
  focusedCommentId={focusedCommentId}
  aiThinkingId={aiThinkingCommentId}
  getReplies={commentState.getReplies}
  onClickComment={handlePanelCommentClick}
  onApproveComment={handleApproveComment}
  onDismissComment={handleRejectComment}
  onResolveComment={handleResolveComment}
  onDeleteComment={handleDeleteComment}
  onReplyComment={handleReplyToComment}
  onAskAIComment={handleAskAIInThread}
  onLaunchReview={handleRequestReview}
  onLaunchFactCheck={handleFactCheck}
  isReviewing={isReviewing}
  isFactChecking={isFactChecking}
  factCheckProgress={factCheckProgress}
```

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire tab state and comment data to AssistantPanel"
```

---

### Task 8: Add /review and /fact-check slash commands

**Files:**
- Modify: `frontend/src/components/SlashMenu.jsx`

**Step 1: Add onReview and onFactCheck props**

The SlashMenu component is rendered inside the Milkdown editor via a tooltip plugin. It needs access to callbacks. Currently, the `COMMANDS` array uses `callCommand` from Milkdown.

For slash commands that trigger app-level actions (review, fact-check), add an approach using CustomEvent dispatch on the editor view's DOM, similar to how the SelectionToolbar dispatches events.

Add to the end of the `COMMANDS` array:

```js
{ key: "review", label: "Review", shortcut: "", icon: "✏️",
  run: (ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dom.dispatchEvent(new CustomEvent("slash-review-request", { bubbles: true }));
  }
},
{ key: "fact-check", label: "Fact-Check", shortcut: "", icon: "🔍",
  run: (ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dom.dispatchEvent(new CustomEvent("slash-factcheck-request", { bubbles: true }));
  }
},
```

Make sure `editorViewCtx` is imported from `@milkdown/kit/core`:

```js
import { editorViewCtx } from "@milkdown/kit/core";
```

**Step 2: Listen for these events in App.jsx**

In the existing DOM event listener effect in App.jsx (around lines 739–769), add:

```js
const onSlashReview = () => handleRequestReview("all");
const onSlashFactCheck = () => handleFactCheck();
wrapper.addEventListener("slash-review-request", onSlashReview);
wrapper.addEventListener("slash-factcheck-request", onSlashFactCheck);
```

And in the cleanup:

```js
wrapper.removeEventListener("slash-review-request", onSlashReview);
wrapper.removeEventListener("slash-factcheck-request", onSlashFactCheck);
```

**Step 3: Commit**

```bash
git add frontend/src/components/SlashMenu.jsx frontend/src/App.jsx
git commit -m "feat: add /review and /fact-check slash commands"
```

---

### Task 9: Add CSS styles for tabs, cards, and states

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Add tab bar styles**

Add after the existing `.agent-pane-header` styles (around line 2500):

```css
/* ── Tab bar ────────────────────────────────── */
.agent-tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-subtle);
  margin: 0 -16px;
  padding: 0 16px;
}

.agent-tab {
  all: unset;
  cursor: pointer;
  padding: 8px 12px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-tab:hover {
  color: var(--text-2);
}

.agent-tab--active {
  color: var(--text-1);
  border-bottom-color: var(--text-1);
}

.agent-tab-badge {
  font-size: 10px;
  font-weight: 600;
  background: var(--accent);
  color: white;
  border-radius: 99px;
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
```

**Step 2: Add review card styles**

```css
/* ── Review cards ───────────────────────────── */
.review-tab { display: flex; flex-direction: column; gap: 2px; }
.review-tab-list { display: flex; flex-direction: column; gap: 2px; }

.review-card {
  background: var(--surface-inset);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: opacity 0.3s, background 0.15s;
  border-left: 3px solid transparent;
}

.review-card:hover { background: var(--surface-inset-hover, #ededed); }

.review-card--active { border-left-color: var(--accent); }

.review-card--approved {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 1s ease;
}

.review-card--rejected {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.5s ease;
}

.review-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
}

.review-card-icon { display: flex; color: var(--text-3); }
.review-card-author { font-weight: 500; color: var(--text-2); }
.review-card-time { margin-left: auto; }

.review-card-quote {
  font-size: 12px;
  color: var(--text-3);
  font-style: italic;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-card-body {
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.5;
}

.review-card-diff {
  font-size: 12px;
  background: var(--surface);
  border-radius: 6px;
  padding: 8px;
  line-height: 1.5;
}

.review-card-diff-del {
  color: var(--red, #c0392b);
  text-decoration: line-through;
  display: block;
}

.review-card-diff-ins {
  color: var(--green, #27ae60);
  text-decoration: none;
  display: block;
}

.review-card-actions {
  display: flex;
  gap: 6px;
  padding-top: 4px;
}

.review-card-btn {
  all: unset;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}

.review-card-btn--accept { color: var(--accent); }
.review-card-btn--accept:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.review-card-btn--dismiss { color: var(--text-3); }
.review-card-btn--dismiss:hover { background: var(--surface-inset); }
.review-card-btn--delete { color: var(--red, #c0392b); }
.review-card-btn--delete:hover { background: color-mix(in srgb, var(--red, #c0392b) 10%, transparent); }
.review-card-btn--reply { color: var(--text-3); }
.review-card-btn--reply:hover { background: var(--surface-inset); }
```

**Step 3: Add verdict badge styles**

```css
/* ── Verdict badges ─────────────────────────── */
.review-card-verdict {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  display: inline-flex;
  align-self: flex-start;
}

.review-card-verdict--verified { background: #e8f5e9; color: #2e7d32; }
.review-card-verdict--dubious  { background: #fff8e1; color: #f57f17; }
.review-card-verdict--false    { background: #fce4ec; color: #c62828; }
```

**Step 4: Add thread and reply styles**

```css
/* ── Reply thread ───────────────────────────── */
.review-card-thread {
  border-top: 1px solid var(--border-subtle);
  margin-top: 4px;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-card-reply {
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-card-reply-author {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.review-card-reply-body { color: var(--text-1); }

.review-card-reply--user .review-card-reply-body {
  background: var(--surface);
  padding: 6px 10px;
  border-radius: 8px;
}

.review-card-thinking-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--text-4);
  border-top-color: var(--text-2);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

.review-card-ask-ai {
  all: unset;
  cursor: pointer;
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.review-card-ask-ai:hover { text-decoration: underline; }

.review-card-reply-composer {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}

.review-card-reply-composer textarea {
  all: unset;
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
  padding: 6px 10px;
  background: var(--surface);
  border-radius: 8px;
  resize: none;
  min-height: 20px;
  max-height: 80px;
}

.review-card-reply-send {
  all: unset;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  padding: 6px 8px;
}

.review-card-reply-send:disabled { opacity: 0.4; cursor: default; }
```

**Step 5: Add sources styles**

```css
/* ── Sources ────────────────────────────────── */
.review-card-sources { font-size: 12px; }

.review-card-sources-toggle {
  all: unset;
  cursor: pointer;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 500;
}

.review-card-sources-toggle:hover { color: var(--text-2); }

.review-card-sources-list {
  list-style: none;
  padding: 4px 0 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-card-sources-list a {
  color: var(--accent);
  font-size: 11px;
  text-decoration: none;
}

.review-card-sources-list a:hover { text-decoration: underline; }

.review-card-source-snippet {
  display: block;
  font-size: 10px;
  color: var(--text-4);
  line-height: 1.4;
  margin-top: 1px;
}
```

**Step 6: Add tab empty and complete state styles**

```css
/* ── Tab states ─────────────────────────────── */
.review-tab-empty,
.review-tab-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
}

.review-tab-empty-heading,
.review-tab-complete-heading {
  font-size: 14px;
  color: var(--text-2);
  font-weight: 500;
}

.review-tab-empty-desc {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.review-tab-complete-stats {
  font-size: 12px;
  color: var(--text-3);
}

.review-tab-empty-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.review-tab-launch-btn {
  all: unset;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  transition: background 0.15s, border-color 0.15s;
}

.review-tab-launch-btn:hover {
  background: var(--surface-inset);
  border-color: var(--text-4);
}

/* ── Loading ────────────────────────────────── */
.review-tab-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 12px;
  color: var(--text-3);
}

.review-tab-loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-4);
  border-top-color: var(--text-2);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.review-tab-progress-bar {
  width: 100%;
  max-width: 200px;
  height: 3px;
  background: var(--surface-inset);
  border-radius: 2px;
  overflow: hidden;
}

.review-tab-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

**Step 7: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add CSS for tab bar, review cards, verdict badges, and states"
```

---

### Task 10: Playwright integration test

**Files:**
- Create: `frontend/tests/review-panel.spec.js`

**Step 1: Write Playwright test for the review panel flow**

```js
import { test, expect } from "@playwright/test";

test.describe("Review Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to load and the editor to be ready
    await page.waitForSelector(".ProseMirror", { timeout: 10000 });
  });

  test("shows tab bar in assistant panel", async ({ page }) => {
    // Open assistant panel if not already open
    const chatTab = page.locator(".agent-tab").filter({ hasText: "Chat" });
    await expect(chatTab).toBeVisible();

    const reviewTab = page.locator(".agent-tab").filter({ hasText: "Review" });
    await expect(reviewTab).toBeVisible();

    const verifyTab = page.locator(".agent-tab").filter({ hasText: "Verify" });
    await expect(verifyTab).toBeVisible();
  });

  test("review tab shows empty state", async ({ page }) => {
    // Click the Review tab
    await page.locator(".agent-tab").filter({ hasText: "Review" }).click();

    // Should show empty state
    await expect(page.locator(".review-tab-empty-heading")).toHaveText("No review comments yet.");
    await expect(page.locator(".review-tab-launch-btn").first()).toBeVisible();
  });

  test("verify tab shows empty state", async ({ page }) => {
    await page.locator(".agent-tab").filter({ hasText: "Verify" }).click();
    await expect(page.locator(".review-tab-empty-heading")).toHaveText("No fact-checks yet.");
  });

  test("switching tabs preserves chat content", async ({ page }) => {
    // Should be on Chat tab by default
    await expect(page.locator(".agent-pane-body").first()).toBeVisible();

    // Switch to Review
    await page.locator(".agent-tab").filter({ hasText: "Review" }).click();
    await expect(page.locator(".review-tab-empty")).toBeVisible();

    // Switch back to Chat
    await page.locator(".agent-tab").filter({ hasText: "Chat" }).click();
    // Chat body should be visible again (empty state or messages)
    await expect(page.locator(".agent-pane-body").first()).toBeVisible();
  });
});
```

**Step 2: Run the test**

Run: `cd frontend && npx playwright test tests/review-panel.spec.js --headed`

Expected: All 4 tests pass.

**Step 3: Commit**

```bash
git add frontend/tests/review-panel.spec.js
git commit -m "test: add Playwright tests for review panel tabs"
```

---

### Task 11: Update topbar Review button to also set tab

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Find the existing review button dropdown in the topbar**

The review button is part of the `doc-more-dropdown` (around lines 2637–2654). The fact-check button is the `review-btn` (around line 2602). These already call `handleRequestReview(focus)` and `handleFactCheck()` which we updated in Task 7 to auto-switch tabs.

Verify that the topbar Review button dropdown options call `handleRequestReview` with the correct focus parameter, and the Fact-Check button calls `handleFactCheck`. No additional changes should be needed since Task 7 already added the tab-switching logic inside those handlers.

**Step 2: Verify and commit**

If no changes were needed:

```bash
git commit --allow-empty -m "chore: verified topbar buttons already wire to tab switching"
```

If adjustments were needed, commit those changes.

---

### Summary of all files touched

| Action | File |
|--------|------|
| Modify | `frontend/src/hooks/useComments.js` |
| Create | `frontend/src/components/ReviewCard.jsx` |
| Create | `frontend/src/components/VerifyCard.jsx` |
| Create | `frontend/src/components/ReviewTab.jsx` |
| Create | `frontend/src/components/VerifyTab.jsx` |
| Modify | `frontend/src/components/AssistantPanel.jsx` |
| Modify | `frontend/src/App.jsx` |
| Modify | `frontend/src/components/SlashMenu.jsx` |
| Modify | `frontend/src/App.css` |
| Create | `frontend/tests/review-panel.spec.js` |
