import { useState, useEffect } from "react";
import { api } from "../api";

export function InvitationBanner({ onAccepted }) {
  const [invitations, setInvitations] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState({});

  useEffect(() => {
    api.listInvitations().then(setInvitations).catch(() => {});
  }, []);

  const handleAccept = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: "accepting" }));
    try {
      await api.acceptInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      onAccepted?.();
    } catch {
      // ignore
    }
    setLoading((prev) => ({ ...prev, [id]: null }));
  };

  const handleDecline = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: "declining" }));
    try {
      await api.declineInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch {
      // ignore
    }
    setLoading((prev) => ({ ...prev, [id]: null }));
  };

  if (invitations.length === 0) return null;

  return (
    <div className="invitation-banner">
      <button
        className="invitation-banner-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span>You have {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}</span>
        <svg
          className={`invitation-chevron${expanded ? " open" : ""}`}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="M7 10l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="invitation-list">
          {invitations.map((inv) => (
            <div key={inv.id} className="invitation-item">
              <div className="invitation-info">
                <span className="invitation-project">{inv.project_name}</span>
                <span className="invitation-meta">
                  from {inv.invited_by_name || "someone"} &middot; {inv.role}
                </span>
              </div>
              <div className="invitation-actions">
                <button
                  className="invitation-accept"
                  disabled={!!loading[inv.id]}
                  onClick={() => handleAccept(inv.id)}
                >
                  {loading[inv.id] === "accepting" ? "..." : "Accept"}
                </button>
                <button
                  className="invitation-decline"
                  disabled={!!loading[inv.id]}
                  onClick={() => handleDecline(inv.id)}
                >
                  {loading[inv.id] === "declining" ? "..." : "Decline"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
