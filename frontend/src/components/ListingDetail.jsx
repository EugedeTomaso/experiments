import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ScoreRadar } from "./ScoreRadar";

export function ListingDetail({ listing, onBack, onStartReview }) {
  const [detail, setDetail] = useState(listing);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fullDetail, nodes] = await Promise.all([
          api.getMarketplaceListing(listing.id),
          api.getListingNodes(listing.id),
        ]);
        if (cancelled) return;
        setDetail(fullDetail);
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
    setStarting(true);
    try {
      const review = await api.createReview(listing.id);
      onStartReview(review, detail);
    } catch (err) {
      alert(err.message || "Failed to start review");
    } finally {
      setStarting(false);
    }
  }, [listing.id, detail, onStartReview]);

  if (loading) {
    return (
      <div className="listing-detail">
        <button className="btn-text" onClick={onBack}>&larr; Back</button>
        <div className="listing-detail__loading">Loading...</div>
      </div>
    );
  }

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
        <button
          className="listing-detail__start-btn"
          onClick={handleStartReview}
          disabled={starting}
        >
          {starting ? "Starting..." : "Start Review"}
        </button>
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
