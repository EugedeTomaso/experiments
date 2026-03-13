import { VerifyCard } from "./VerifyCard";

export function VerifyTab({
  comments,
  pendingCount,
  canAccept = true,
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
      {isFactChecking && (
        <div className="review-tab-loading">
          <span className="review-tab-loading-spinner" />
          <span>
            {factCheckProgress
              ? `Checking claims\u2026 ${factCheckProgress.done}/${factCheckProgress.total}`
              : "Extracting claims\u2026"
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
            canAccept={canAccept}
            onClick={() => onClickComment(c)}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}
