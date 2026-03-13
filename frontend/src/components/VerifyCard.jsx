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
  canAccept = true,
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

      {comment.quoted_text && (
        <div className="review-card-quote">
          &ldquo;{comment.quoted_text.length > 100 ? comment.quoted_text.slice(0, 100) + "\u2026" : comment.quoted_text}&rdquo;
        </div>
      )}

      {verdict && (
        <span className={`review-card-verdict ${verdict.className}`}>
          {verdict.label}
        </span>
      )}

      <div className="review-card-body">{comment.body}</div>

      {sources.length > 0 && (
        <div className="review-card-sources">
          <button
            className="review-card-sources-toggle"
            onClick={(e) => { e.stopPropagation(); setSourcesOpen(!sourcesOpen); }}
          >
            {sourcesOpen ? "\u25be" : "\u25b8"} Sources ({sources.length})
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

      {hasSuggestion && (
        <div className="review-card-diff">
          <del className="review-card-diff-del">{comment.quoted_text}</del>
          <ins className="review-card-diff-ins">{comment.suggested_text}</ins>
        </div>
      )}

      {isOpen && (
        <div className="review-card-actions">
          {hasSuggestion && canAccept && (
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
