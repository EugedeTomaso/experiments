import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ScoreBadge } from "./ScoreBadge";

export function MarketplacePublishDialog({ projectId, projectName, onClose }) {
  const [listing, setListing] = useState(null);
  const [genre, setGenre] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const listings = await api.listMyListings();
        const list = Array.isArray(listings) ? listings : listings.results || [];
        const existing = list.find(
          (l) => l.project_name === projectName || l.id === projectId
        );
        if (existing) {
          setListing(existing);
          setGenre(existing.genre || "");
          setSynopsis(existing.synopsis || "");
        }
      } catch {
        // no existing listing
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, projectName]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const result = await api.createListing({
        project: projectId,
        genre,
        synopsis,
      });
      setListing(result);
    } catch (err) {
      alert(err.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }, [projectId, genre, synopsis]);

  const handleDelist = useCallback(async () => {
    if (!listing) return;
    if (!confirm("Remove this project from the marketplace?")) return;
    try {
      await api.delistListing(listing.id);
      setListing({ ...listing, status: "delisted" });
    } catch (err) {
      alert(err.message || "Failed to delist");
    }
  }, [listing]);

  const handleRefreshScore = useCallback(async () => {
    if (!listing) return;
    setRefreshing(true);
    try {
      const result = await api.refreshListingScore(listing.id);
      if (result.ai_score) {
        setListing({ ...listing, ai_score: result.ai_score });
      }
    } catch (err) {
      alert(err.message || "Failed to refresh score");
    } finally {
      setRefreshing(false);
    }
  }, [listing]);

  return (
    <div className="marketplace-publish-overlay" onClick={onClose}>
      <div className="marketplace-publish-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="marketplace-publish-dialog__header">
          <h2>Publish to Marketplace</h2>
          <button className="btn-text" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="marketplace-publish-dialog__loading">Loading...</div>
        ) : listing && listing.status === "listed" ? (
          <div className="marketplace-publish-dialog__listed">
            <div className="marketplace-publish-dialog__status">
              <span className="marketplace-publish-dialog__status-badge">Listed</span>
              <span>{projectName}</span>
            </div>

            {listing.ai_score && listing.ai_score.overall != null && (
              <div className="marketplace-publish-dialog__score">
                <span>AI Score:</span>
                <ScoreBadge score={listing.ai_score.overall} size="large" />
                <button
                  className="btn-text"
                  onClick={handleRefreshScore}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Score"}
                </button>
              </div>
            )}

            <div className="marketplace-publish-dialog__info">
              <p><strong>Genre:</strong> {listing.genre || "—"}</p>
              <p><strong>Words:</strong> {(listing.word_count || 0).toLocaleString()}</p>
            </div>

            <button className="marketplace-publish-dialog__delist" onClick={handleDelist}>
              Remove from Marketplace
            </button>
          </div>
        ) : (
          <div className="marketplace-publish-dialog__form">
            <p className="marketplace-publish-dialog__desc">
              Publish <strong>{projectName}</strong> to the marketplace. Reviewers will be able to read it and provide structured feedback.
            </p>

            <div className="marketplace-publish-dialog__field">
              <label>Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Science Fiction, Literary Fiction, Mystery..."
              />
            </div>

            <div className="marketplace-publish-dialog__field">
              <label>Synopsis</label>
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Brief description of your project for reviewers..."
                rows={4}
              />
            </div>

            <button
              className="marketplace-publish-dialog__publish"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? "Publishing..." : "Publish to Marketplace"}
            </button>

            {listing && listing.status === "delisted" && (
              <p className="marketplace-publish-dialog__note">
                This project was previously listed and delisted.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
