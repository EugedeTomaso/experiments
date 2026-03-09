import { useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import { ListingDetail } from "./components/ListingDetail";
import { MarketplaceBrowse } from "./components/MarketplaceBrowse";
import { MyReviews } from "./components/MyReviews";
import { ReaderView } from "./components/ReaderView";
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
          <div className="reviewer-brand">Marvin</div>
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
      <main className={`reviewer-main${view === "reader" ? " reviewer-main--reader" : ""}`}>
        {view === "marketplace" && (
          <MarketplaceBrowse onSelectListing={handleSelectListing} />
        )}
        {view === "listing-detail" && selectedListing && (
          <ListingDetail
            listing={selectedListing}
            onBack={() => setView("marketplace")}
            onStartReview={(review, listing) => {
              setActiveReview(review);
              setSelectedListing(listing);
              setView("reader");
            }}
          />
        )}
        {view === "reader" && activeReview && (
          <ReaderView
            review={activeReview}
            listing={selectedListing}
            onBack={() => setView("marketplace")}
          />
        )}
        {view === "my-reviews" && (
          <MyReviews
            onOpenReview={async (review) => {
              try {
                const listing = await api.getMarketplaceListing(review.listing);
                setActiveReview(review);
                setSelectedListing(listing);
                setView("reader");
              } catch (err) {
                console.error("Failed to open review:", err);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
