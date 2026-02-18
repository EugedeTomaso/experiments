import { useState, useEffect, useRef, useCallback } from "react";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function SparkleIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
        fill="currentColor"
      />
    </svg>
  );
}

function PersonIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" fill="currentColor" />
      <path
        d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

export function CommentThread({
  comment,
  replies: propReplies,
  rect,
  onClose,
  onApprove,
  onReject,
  onResolve,
  onDelete,
  onReply,
  onAskAI,
  isAIThinking,
  onPrev,
  onNext,
  navLabel,
}) {
  const containerRef = useRef(null);
  const [replyText, setReplyText] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const textareaRef = useRef(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        // Don't close if clicking on a comment highlight
        if (e.target.closest && e.target.closest(".comment-highlight")) return;
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handleClose]);

  useEffect(() => {
    if (showComposer && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showComposer]);

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
    if (e.key === "Escape") {
      setShowComposer(false);
      setReplyText("");
    }
  };

  const isAI = comment.author_type === "assistant";
  const hasSuggestion = !!comment.suggested_text;
  const isOpen = comment.status === "open";
  const replies = propReplies || [];

  const style = {
    position: "fixed",
    top: rect.bottom + 8,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 330)),
    zIndex: 200,
  };

  return (
    <div className="comment-thread" ref={containerRef} style={style}>
      {/* Header */}
      <div className="comment-thread-header">
        <div
          className={`comment-thread-avatar ${
            isAI ? "comment-thread-avatar--ai" : "comment-thread-avatar--user"
          }`}
        >
          {isAI ? <SparkleIcon /> : <PersonIcon />}
        </div>
        <span className="comment-thread-author">
          {comment.author_label || (isAI ? "Assistant" : "You")}
        </span>
        <span className="comment-thread-time">{timeAgo(comment.created_at)}</span>
        {comment.status !== "resolved" && (
          <span
            className={`comment-thread-status comment-thread-status--${comment.status}`}
          >
            {comment.status}
          </span>
        )}
        {onPrev && onNext && (
          <div className="comment-thread-nav">
            <button className="comment-thread-nav-btn" onClick={onPrev} title="Previous">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 6.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {navLabel && <span className="comment-thread-nav-label">{navLabel}</span>}
            <button className="comment-thread-nav-btn" onClick={onNext} title="Next">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}
        <button className="comment-thread-close" onClick={handleClose}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {/* Verdict badge */}
      {comment.comment_type === "fact_check" && comment.verdict && (
        <div className={`comment-thread-verdict comment-thread-verdict--${comment.verdict}`}>
          {comment.verdict === "verified" && "Verified"}
          {comment.verdict === "dubious" && "Dubious"}
          {comment.verdict === "false" && "False"}
        </div>
      )}

      {/* Body */}
      <div className="comment-thread-body">{comment.body}</div>

      {/* Sources */}
      {comment.comment_type === "fact_check" && comment.sources?.length > 0 && (
        <div className="comment-thread-sources">
          <div className="comment-thread-sources-label">Sources</div>
          {comment.sources.map((source, i) => (
            <a
              key={i}
              className="comment-thread-source-link"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.title || source.url}
            </a>
          ))}
        </div>
      )}

      {/* Suggestion diff */}
      {hasSuggestion && (
        <div className="comment-thread-diff">
          <div>
            <span className="comment-thread-diff-del">{comment.quoted_text}</span>
          </div>
          <div className="comment-thread-diff-arrow">&#8595;</div>
          <div>
            <span className="comment-thread-diff-add">{comment.suggested_text}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {isOpen && (
        <div className="comment-thread-actions">
          {isAI && hasSuggestion && (
            <button
              className="comment-thread-action comment-thread-action--approve"
              onClick={() => onApprove(comment.id)}
            >
              Approve
            </button>
          )}
          {isAI && (
            <button
              className="comment-thread-action comment-thread-action--reject"
              onClick={() => onReject(comment.id)}
            >
              Reject
            </button>
          )}
          <button
            className="comment-thread-action"
            onClick={() => onResolve(comment.id)}
          >
            Resolve
          </button>
          {!isAI && (
            <button
              className="comment-thread-action"
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </button>
          )}
          {!showComposer && (
            <button
              className="comment-thread-action"
              onClick={() => setShowComposer(true)}
            >
              Reply
            </button>
          )}
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <>
          <div className="comment-thread-divider" />
          <div className="comment-thread-replies">
            {replies.map((reply, i) => {
              const replyIsAI = reply.author_type === "assistant";
              const isLast = i === replies.length - 1;
              return (
                <div key={reply.id}>
                  <div className="comment-thread-reply">
                    <div
                      className={`comment-thread-avatar ${
                        replyIsAI
                          ? "comment-thread-avatar--ai"
                          : "comment-thread-avatar--user"
                      }`}
                    >
                      {replyIsAI ? <SparkleIcon size={8} /> : <PersonIcon size={8} />}
                    </div>
                    <div className="comment-thread-reply-content">
                      <div className="comment-thread-reply-meta">
                        <span className="comment-thread-reply-author">
                          {reply.author_label || (replyIsAI ? "Assistant" : "You")}
                        </span>
                        <span className="comment-thread-reply-time">
                          {timeAgo(reply.created_at)}
                        </span>
                      </div>
                      <div className="comment-thread-reply-body">{reply.body}</div>
                    </div>
                  </div>
                  {/* Ask Assistant action on the last user reply */}
                  {isLast && !replyIsAI && isOpen && !isAIThinking && (
                    <button
                      className="comment-thread-ask-ai"
                      onClick={() => onAskAI(comment.id, reply.body)}
                      style={{ marginLeft: 28 }}
                    >
                      Ask Assistant
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* AI thinking indicator */}
      {isAIThinking && (
        <div className="comment-thread-thinking">
          <svg width="12" height="12" viewBox="0 0 16 16" className="spinner-icon">
            <circle
              cx="8" cy="8" r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="28"
              strokeDashoffset="8"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 8 8"
                to="360 8 8"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
          Thinking...
        </div>
      )}

      {/* Reply composer */}
      {showComposer && isOpen && (
        <>
          <div className="comment-thread-divider" />
          <div className="comment-thread-composer">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              rows={1}
            />
            <button
              className="comment-thread-composer-btn"
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
            >
              Reply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
