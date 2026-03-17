import { useState, useRef, useEffect } from "react";

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function VersionsMenu({
  versions,
  onRestore,
  onCompare,
  activeCompareId,
  canRestore = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div className="versions-menu" ref={ref}>
      <button
        className="versions-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {versions.length} {versions.length === 1 ? "version" : "versions"}
        </span>
      </button>
      {isOpen && (
        <div className="versions-dropdown">
          <div className="versions-dropdown-header">Version history</div>
          {versions.map((v, i) => (
            <div key={v.id} className={`versions-item${activeCompareId === v.id ? " versions-item-comparing" : ""}`}>
              <div className="versions-item-info">
                <div className="versions-item-date">
                  <span>{relativeTime(v.created_at)}</span>
                  {i === 0 && <span className="versions-item-latest">Latest</span>}
                </div>
                <div className="versions-item-snippet">
                  {(v.content_md || "").replace(/<[^>]+>/g, "").replace(/[#*_~`>\-\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Empty"}
                </div>
              </div>
              <div className="versions-item-actions">
                {onCompare && (
                  <button
                    className={`versions-item-btn${activeCompareId === v.id ? " active" : ""}`}
                    onClick={() => {
                      onCompare(v);
                    }}
                    title="Compare with current"
                  >
                    {activeCompareId === v.id ? "Comparing" : "Compare"}
                  </button>
                )}
                {canRestore && (
                  <button
                    className="versions-item-btn"
                    onClick={() => {
                      onRestore(v);
                      setIsOpen(false);
                    }}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
          {versions.length === 0 && (
            <div className="versions-empty">
              No versions yet. Start editing to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
