import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_LABELS = {
  in_progress: "In Progress",
  submitted: "Submitted",
  read_by_author: "Read",
};

const VERDICT_LABELS = {
  promising: "Promising",
  needs_work: "Needs Work",
  publish_ready: "Publish Ready",
};

export function MyReviews({ onOpenReview }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.listMyReviews();
        setReviews(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="my-reviews__loading">Loading your reviews...</div>;
  }

  return (
    <div className="my-reviews">
      <h1 className="my-reviews__title">My Reviews</h1>
      {reviews.length === 0 ? (
        <div className="my-reviews__empty">
          <p>No reviews yet.</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Browse the marketplace to find manuscripts to review.
          </p>
        </div>
      ) : (
        <div className="my-reviews__list">
          {reviews.map((r) => (
            <button
              key={r.id}
              className="my-reviews__card"
              onClick={() => onOpenReview(r)}
            >
              <div className="my-reviews__card-header">
                <h3 className="my-reviews__card-title">{r.project_name}</h3>
                <span className={`my-reviews__status my-reviews__status--${r.status}`}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
              <div className="my-reviews__card-meta">
                <span>Started {new Date(r.started_at).toLocaleDateString()}</span>
                {r.submitted_at && (
                  <span>Submitted {new Date(r.submitted_at).toLocaleDateString()}</span>
                )}
                {r.verdict && (
                  <span className="my-reviews__verdict">{VERDICT_LABELS[r.verdict] || r.verdict}</span>
                )}
              </div>
              {r.summary && (
                <p className="my-reviews__card-summary">
                  {r.summary.length > 120 ? r.summary.slice(0, 120) + "..." : r.summary}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
