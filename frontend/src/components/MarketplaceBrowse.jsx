import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ListingCard } from "./ListingCard";

export function MarketplaceBrowse({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [ordering, setOrdering] = useState("-listed_at");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (genre) params.genre = genre;
      params.ordering = ordering;
      const data = await api.listMarketplace(params);
      setListings(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Failed to load marketplace:", err);
    } finally {
      setLoading(false);
    }
  }, [search, genre, ordering]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <div className="marketplace-browse">
      <h1 className="marketplace-browse__title">Marketplace</h1>
      <div className="marketplace-browse__controls">
        <input
          type="text"
          className="marketplace-browse__search"
          placeholder="Search manuscripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="text"
          className="marketplace-browse__genre"
          placeholder="Filter by genre..."
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        />
        <select
          className="marketplace-browse__sort"
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
        >
          <option value="-listed_at">Most Recent</option>
          <option value="-ai_score__overall">Highest Score</option>
          <option value="word_count">Shortest First</option>
          <option value="-word_count">Longest First</option>
        </select>
      </div>
      {loading ? (
        <div className="marketplace-browse__loading">Loading manuscripts...</div>
      ) : listings.length === 0 ? (
        <div className="marketplace-browse__empty">
          <p>No manuscripts found.</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Check back later or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="marketplace-browse__grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onClick={onSelectListing} />
          ))}
        </div>
      )}
    </div>
  );
}
