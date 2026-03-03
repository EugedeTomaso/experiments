import { ScoreBadge } from "./ScoreBadge";

export function ListingCard({ listing, onClick }) {
  return (
    <button className="listing-card" onClick={() => onClick(listing)}>
      <div className="listing-card__header">
        <h3 className="listing-card__title">{listing.project_name}</h3>
        <ScoreBadge score={listing.score} />
      </div>
      <p className="listing-card__author">by {listing.author_name}</p>
      {listing.synopsis && (
        <p className="listing-card__synopsis">
          {listing.synopsis.length > 200
            ? listing.synopsis.slice(0, 200) + "..."
            : listing.synopsis}
        </p>
      )}
      <div className="listing-card__meta">
        {listing.genre && <span className="listing-card__genre">{listing.genre}</span>}
        <span className="listing-card__words">
          {(listing.word_count || 0).toLocaleString()} words
        </span>
      </div>
    </button>
  );
}
