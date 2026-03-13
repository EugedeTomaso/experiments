import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ScoreRadar } from "./ScoreRadar";

export function ListingDetail({ listing, onBack, onStartReview }) {
  const [detail, setDetail] = useState(listing);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fullDetail, nodes, myReviews] = await Promise.all([
          api.getMarketplaceListing(listing.id),
          api.getListingNodes(listing.id),
          api.listMyReviews(),
        ]);
        if (cancelled) return;
        setDetail(fullDetail);

        const reviews = Array.isArray(myReviews) ? myReviews : myReviews.results || [];
        const match = reviews.find((r) => r.listing === listing.id);
        if (match) setExistingReview(match);

        const firstFile = nodes.find((n) => n.type === "file");
        if (firstFile) {
          const node = await api.getListingNode(listing.id, firstFile.id);
          if (!cancelled && node.content_md) {
            const words = node.content_md.split(/\s+/).slice(0, 500);
            setPreview(words.join(" ") + (node.content_md.split(/\s+/).length > 500 ? "..." : ""));
          }
        }
      } catch (err) {
        console.error("Failed to load listing detail:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [listing.id]);

  const handleStartReview = useCallback(async () => {
    if (existingReview) {
      onStartReview(existingReview, detail);
      return;
    }
    setStarting(true);
    try {
      const review = await api.createReview(listing.id);
      onStartReview(review, detail);
    } catch (err) {
      alert(err.message || "Failed to start review");
    } finally {
      setStarting(false);
    }
  }, [listing.id, detail, existingReview, onStartReview]);

  if (loading) {
    return (
      <div className="listing-detail">
        <button className="btn-text" onClick={onBack}>&larr; Back</button>
        <div className="listing-detail__loading">Loading...</div>
      </div>
    );
  }

  const isSubmitted = existingReview?.status === "submitted" || existingReview?.status === "read_by_author";

  return (
    <div className="listing-detail">
      <button className="btn-text" onClick={onBack}>&larr; Back to Marketplace</button>

      <div className="listing-detail__header">
        <div>
          <h1 className="listing-detail__title">{detail.project_name}</h1>
          <p className="listing-detail__author">by {detail.author_name}</p>
          <div className="listing-detail__meta">
            {detail.genre && <span className="listing-detail__genre">{detail.genre}</span>}
            <span>{(detail.word_count || 0).toLocaleString()} words</span>
          </div>
        </div>
        <div className="listing-detail__actions">
          {isSubmitted ? (
            <span className="listing-detail__submitted-badge">Review submitted</span>
          ) : (
            <button
              className="listing-detail__start-btn"
              onClick={handleStartReview}
              disabled={starting}
            >
              {starting ? "Loading..." : existingReview ? "Continue Review" : "Start Review"}
            </button>
          )}
        </div>
      </div>

      {detail.synopsis && (
        <section className="listing-detail__section">
          <h3>Synopsis</h3>
          <p>{detail.synopsis}</p>
        </section>
      )}

      {detail.ai_score && detail.ai_score.overall && (
        <section className="listing-detail__section">
          <h3>AI Quality Score</h3>
          <ScoreRadar aiScore={detail.ai_score} />
        </section>
      )}

      {preview && (
        <section className="listing-detail__section">
          <h3>Preview</h3>
          <div className="listing-detail__preview">{preview}</div>
        </section>
      )}
    </div>
  );
}
