import { useState, useRef, useEffect } from "react";

export function VersionsMenu({ versions, onRestore }) {
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
          {versions.map((v) => (
            <div key={v.id} className="versions-item">
              <div className="versions-item-info">
                <div className="versions-item-date">
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <div className="versions-item-snippet">
                  {(v.content_md || "").slice(0, 60) || "Empty"}
                </div>
              </div>
              <button
                className="ghost"
                onClick={() => {
                  onRestore(v);
                  setIsOpen(false);
                }}
              >
                Restore
              </button>
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
