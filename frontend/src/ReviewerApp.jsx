import { useState } from "react";
import { useAuth } from "./AuthContext";
import { MarketplaceBrowse } from "./components/MarketplaceBrowse";
import "./App.css";

export function ReviewerApp() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("marketplace");
  const [selectedListing, setSelectedListing] = useState(null);
  const [activeReview, setActiveReview] = useState(null);

  const handleSelectListing = (listing) => {
    setSelectedListing(listing);
    setView("listing-detail");
  };

  return (
    <div className="reviewer-app">
      <header className="reviewer-topbar">
        <div className="reviewer-topbar-left">
          <div className="reviewer-brand">Mive</div>
          <nav className="reviewer-nav">
            <button
              className={`reviewer-nav__item${view === "marketplace" ? " reviewer-nav__item--active" : ""}`}
              onClick={() => setView("marketplace")}
            >
              Marketplace
            </button>
            <button
              className={`reviewer-nav__item${view === "my-reviews" ? " reviewer-nav__item--active" : ""}`}
              onClick={() => setView("my-reviews")}
            >
              My Reviews
            </button>
          </nav>
        </div>
        <div className="reviewer-topbar-right">
          <span className="reviewer-badge">Reviewer</span>
          <span className="reviewer-username">{user.name}</span>
          <button onClick={logout} className="btn-text">Log out</button>
        </div>
      </header>
      <main className="reviewer-main">
        {view === "marketplace" && (
          <MarketplaceBrowse onSelectListing={handleSelectListing} />
        )}
        {view === "listing-detail" && selectedListing && (
          <div>
            <button className="btn-text" onClick={() => setView("marketplace")}>
              &larr; Back to Marketplace
            </button>
            <h2>{selectedListing.project_name}</h2>
            <p>Listing detail coming in Task 8...</p>
          </div>
        )}
        {view === "my-reviews" && (
          <div>
            <h2>My Reviews</h2>
            <p>Coming in Task 12...</p>
          </div>
        )}
      </main>
    </div>
  );
}
