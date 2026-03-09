import { useState, useMemo } from "react";
import { timeAgo } from "../utils";
import { getProjectColor, formatTypeLabel } from "./ProjectSwitcher";

export function AllProjects({ projects, onSelect, onCreate, canCreate = true }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  if (projects.length === 0) {
    return (
      <div className="all-projects">
        <div className="all-projects-empty">
          <div className="all-projects-empty-title">No projects yet</div>
          <div className="all-projects-empty-text">
            Create your first project to start writing.
          </div>
          {canCreate && (
            <button className="all-projects-empty-action" onClick={onCreate}>
              New Project
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="all-projects">
      <div className="all-projects-header">
        <h1 className="all-projects-title">Projects</h1>
        <div className="all-projects-search">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="all-projects-grid">
        {filtered.map((p) => {
          const color = getProjectColor(p.id);
          const typeLabel = formatTypeLabel(p);

          return (
            <button
              key={p.id}
              className="project-card"
              onClick={() => onSelect(p.id)}
            >
              <div className="project-card-header">
                <span className="project-dot" style={{ background: color }} />
                <span className="project-card-title">{p.name}</span>
              </div>
              {typeLabel && (
                <span className="project-card-type">{typeLabel}</span>
              )}
              <span className="project-card-meta">{timeAgo(p.updated_at)}</span>
            </button>
          );
        })}

        {canCreate && (
          <button className="project-card project-card-new" onClick={onCreate}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>New Project</span>
          </button>
        )}
      </div>

      {search.trim() && filtered.length === 0 && (
        <div className="all-projects-no-results">
          No projects matching "{search}"
        </div>
      )}
    </div>
  );
}
