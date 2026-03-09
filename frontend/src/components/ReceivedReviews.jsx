import { useEffect, useState } from "react";
import { api } from "../api";

const VERDICT_LABELS = {
  promising: "Promising",
  needs_work: "Needs Work",
  publish_ready: "Publish Ready",
};

const VERDICT_COLORS = {
  promising: { bg: "#fff8e1", color: "#f57f17" },
  needs_work: { bg: "#ffebee", color: "#c62828" },
  publish_ready: { bg: "#e8f5e9", color: "#2e7d32" },
};

export function ReceivedReviews({ onClose }) {
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState({});
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewComments, setReviewComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const listingData = await api.listMyListings();
        const listingList = Array.isArray(listingData) ? listingData : listingData.results || [];
        setListings(listingList);

        const reviewMap = {};
        for (const listing of listingList) {
          try {
            const revs = await api.getListingReviews(listing.id);
            const revList = Array.isArray(revs) ? revs : revs.results || [];
            if (revList.length > 0) {
              reviewMap[listing.id] = revList;
            }
          } catch {
            // skip
          }
        }
        setReviews(reviewMap);
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelectReview = async (review) => {
    setSelectedReview(review);
    try {
      const comments = await api.listReviewComments(review.id);
      setReviewComments(Array.isArray(comments) ? comments : comments.results || []);
    } catch {
      setReviewComments([]);
    }
  };

  const totalReviews = Object.values(reviews).flat().length;

  if (selectedReview) {
    const grouped = {};
    reviewComments.forEach((c) => {
      const key = c.node_title || `Node ${c.node}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    return (
      <div className="received-reviews">
        <button className="btn-text" onClick={() => setSelectedReview(null)}>← Back to reviews</button>

        <div className="received-review-detail">
          <div className="received-review-detail__header">
            <h2>Review from {selectedReview.reviewer_name}</h2>
            {selectedReview.verdict && (
              <span
                className="received-review-detail__verdict"
                style={{
                  background: VERDICT_COLORS[selectedReview.verdict]?.bg,
                  color: VERDICT_COLORS[selectedReview.verdict]?.color,
                }}
              >
                {VERDICT_LABELS[selectedReview.verdict]}
              </span>
            )}
          </div>

          {selectedReview.summary && (
            <div className="received-review-detail__section">
              <h3>Summary</h3>
              <p>{selectedReview.summary}</p>
            </div>
          )}

          <div className="received-review-detail__section">
            <h3>Comments ({reviewComments.length})</h3>
            {Object.entries(grouped).length === 0 ? (
              <p className="received-review-detail__empty">No inline comments.</p>
            ) : (
              Object.entries(grouped).map(([title, comments]) => (
                <div key={title} className="received-review-detail__group">
                  <h4>{title}</h4>
                  {comments.map((c) => (
                    <div key={c.id} className="received-review-detail__comment">
                      <span className={`comment-type-tag comment-type-tag--${c.comment_type}`}>{c.comment_type}</span>
                      <span>{c.body}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="received-review-detail__meta">
            Submitted {selectedReview.submitted_at ? new Date(selectedReview.submitted_at).toLocaleDateString() : "—"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="received-reviews">
      <div className="received-reviews__header">
        <h2>Received Reviews</h2>
        <button className="btn-text" onClick={onClose}>Close</button>
      </div>

      {loading ? (
        <div className="received-reviews__loading">Loading...</div>
      ) : totalReviews === 0 ? (
        <div className="received-reviews__empty">
          <p>No reviews received yet.</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Publish a project to the marketplace to get reviewer feedback.
          </p>
        </div>
      ) : (
        <div className="received-reviews__list">
          {Object.entries(reviews).map(([listingId, revs]) => {
            const listing = listings.find((l) => l.id === parseInt(listingId));
            return (
              <div key={listingId} className="received-reviews__project">
                <h3 className="received-reviews__project-name">
                  {listing?.project_name || "Unknown Project"}
                </h3>
                {revs.map((r) => (
                  <button
                    key={r.id}
                    className="received-reviews__card"
                    onClick={() => handleSelectReview(r)}
                  >
                    <div className="received-reviews__card-top">
                      <span className="received-reviews__reviewer">
                        Review by {r.reviewer_name}
                      </span>
                      {r.verdict && (
                        <span
                          className="received-reviews__verdict-tag"
                          style={{
                            background: VERDICT_COLORS[r.verdict]?.bg,
                            color: VERDICT_COLORS[r.verdict]?.color,
                          }}
                        >
                          {VERDICT_LABELS[r.verdict]}
                        </span>
                      )}
                    </div>
                    {r.summary && (
                      <p className="received-reviews__summary">
                        {r.summary.length > 100 ? r.summary.slice(0, 100) + "..." : r.summary}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
