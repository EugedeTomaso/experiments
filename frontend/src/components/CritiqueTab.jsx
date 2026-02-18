import { useState } from "react";
import CritiqueSectionCard from "./CritiqueSectionCard";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(score) {
  if (score >= 8) return "var(--green-text, #2d7d46)";
  if (score >= 5) return "var(--amber-text, #9a6700)";
  return "var(--red-text, #c4432b)";
}

function scoreBg(score) {
  if (score >= 8) return "var(--green-bg, #dafbe1)";
  if (score >= 5) return "var(--amber-bg, #fff8c5)";
  return "var(--red-bg, #ffebe9)";
}

export default function CritiqueTab({
  critiques,
  isCritiquing,
  threadMessages,
  discussingSection,
  onLaunchCritique,
  onDiscussSection,
  onSelectCritique,
  activeCritiqueId,
}) {
  const [showHistory, setShowHistory] = useState(false);

  const activeCritique = critiques.find((c) => c.id === activeCritiqueId) || critiques[0];

  // Empty state
  if (!isCritiquing && critiques.length === 0) {
    return (
      <div className="critique-tab-empty">
        <p className="critique-tab-empty-title">No critiques yet.</p>
        <p className="critique-tab-empty-desc">
          Get a comprehensive evaluation of your document.
        </p>
        <button className="review-tab-launch-btn" onClick={onLaunchCritique}>
          Critique
        </button>
      </div>
    );
  }

  // Loading state
  if (isCritiquing && critiques.length === 0) {
    return (
      <div className="critique-tab-loading">
        <span className="review-card-thinking-spinner" />
        Analyzing document…
      </div>
    );
  }

  return (
    <div className="critique-tab">
      {activeCritique && (
        <>
          <div className="critique-overall">
            <span
              className="critique-overall-score"
              style={{
                color: scoreColor(activeCritique.overall_score),
                backgroundColor: scoreBg(activeCritique.overall_score),
              }}
            >
              {activeCritique.overall_score}/10
            </span>
            <p className="critique-overall-summary">{activeCritique.summary}</p>
          </div>

          {activeCritique.sections.map((section) => (
            <CritiqueSectionCard
              key={section.id}
              section={section}
              messages={threadMessages[section.id] || []}
              onDiscuss={onDiscussSection}
              isDiscussing={discussingSection === section.id}
            />
          ))}

          <div className="critique-footer">
            <span className="critique-timestamp">
              {timeAgo(activeCritique.created_at)}
            </span>
            <div className="critique-footer-actions">
              {critiques.length > 1 && (
                <button
                  className="critique-history-btn"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  History ({critiques.length})
                </button>
              )}
              <button
                className="review-tab-launch-btn"
                onClick={onLaunchCritique}
                disabled={isCritiquing}
              >
                {isCritiquing ? "Analyzing…" : "New critique"}
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="critique-history">
              {critiques.map((c) => (
                <button
                  key={c.id}
                  className={`critique-history-item${c.id === activeCritique.id ? " critique-history-item--active" : ""}`}
                  onClick={() => {
                    onSelectCritique(c.id);
                    setShowHistory(false);
                  }}
                >
                  <span>{timeAgo(c.created_at)}</span>
                  <span
                    className="critique-history-score"
                    style={{ color: scoreColor(c.overall_score) }}
                  >
                    {c.overall_score}/10
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
