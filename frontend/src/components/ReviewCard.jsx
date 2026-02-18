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

      {comment.quoted_text && (
        <div className="review-card-quote">
          &ldquo;{comment.quoted_text.length > 80 ? comment.quoted_text.slice(0, 80) + "\u2026" : comment.quoted_text}&rdquo;
        </div>
      )}

      <div className="review-card-body">{comment.body}</div>

      {hasSuggestion && (
        <div className="review-card-diff">
          <del className="review-card-diff-del">{comment.quoted_text}</del>
          <ins className="review-card-diff-ins">{comment.suggested_text}</ins>
        </div>
      )}

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
