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
  onApproveReply,
  onDismiss,
  onResolve,
  onDelete,
  onReply,
  onAskAI,
  onLaunchReview,
  isReviewing,
  agents,
}) {
  const allResolved = comments.length > 0 && pendingCount === 0;
  const isEmpty = comments.length === 0 && !isReviewing;

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
      {isReviewing && (
        <div className="review-tab-loading">
          <span className="review-tab-loading-spinner" />
          <span>Analyzing your document…</span>
        </div>
      )}
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
            onApproveReply={onApproveReply}
            onDismiss={onDismiss}
            onResolve={onResolve}
            onDelete={onDelete}
            onReply={onReply}
            onAskAI={onAskAI}
            agents={agents}
          />
        ))}
      </div>
    </div>
  );
}
