import { useState, useRef, useEffect } from "react";

export function ProjectSwitcher({ projects, activeProjectId, onSelect, onCreate }) {
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

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="project-switcher" ref={ref}>
      <button
        className="project-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{activeProject?.name || "Select project"}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path
            d="M7 10l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="project-switcher-dropdown">
          {projects.map((p) => (
            <button
              key={p.id}
              className={`project-switcher-item ${p.id === activeProjectId ? "active" : ""}`}
              onClick={() => {
                onSelect(p.id);
                setIsOpen(false);
              }}
            >
              {p.name}
            </button>
          ))}
          {projects.length > 0 && <div className="project-switcher-divider" />}
          <button
            className="project-switcher-item"
            onClick={() => {
              onCreate();
              setIsOpen(false);
            }}
          >
            + New project
          </button>
        </div>
      )}
    </div>
  );
}
