import { useState, useRef, useEffect, useMemo } from "react";
import { timeAgo, wordCount as countWords } from "../utils";

export const PROJECT_COLORS = [
  "#8B7355", // warm brown
  "#6B8E6B", // sage green
  "#7B8FA1", // dusty blue
  "#9B7B8E", // mauve
  "#A18B6E", // tan
  "#7BA19B", // teal
  "#8E8B7B", // olive
  "#9B8585", // rose brown
];

export const TYPE_LABELS = {
  novel: "Novel",
  "short-story": "Short Story",
  screenplay: "Screenplay",
  "tv-series": "TV Series",
  youtube: "YouTube / Video",
  article: "Article / Essay",
  academic: "Academic",
  product: "Product / Work",
  freeform: "Freeform",
  custom: "Custom",
};

export const EXT_LABELS = {
  novella: "Novella", standard: "Standard Novel", saga: "Saga / Series",
  flash: "Flash Fiction", short: "Short Story", novelette: "Novelette",
  "short-film": "Short Film", feature: "Feature Film", series: "Series / Limited",
  limited: "Limited Series", season: "Single Season", "multi-season": "Multi-Season",
  "short-video": "Short / Reel", "standard-video": "Standard Video", "long-video": "Long-form / Documentary",
  blog: "Blog Post", essay: "Essay", longform: "Long-form Article",
  "academic-essay": "Academic Essay", paper: "Research Paper", monograph: "Monograph", thesis: "Thesis / Dissertation",
  brief: "Product Brief", "full-product": "Full Product", "research-project": "Research Project",
};

const QUICK_TYPES = [
  { id: "", label: "No type" },
  { id: "novel", label: "Novel" },
  { id: "short-story", label: "Short Story" },
  { id: "screenplay", label: "Screenplay" },
  { id: "article", label: "Article / Essay" },
  { id: "academic", label: "Academic" },
  { id: "product", label: "Product / Work" },
  { id: "freeform", label: "Freeform" },
];

export function getProjectColor(id) {
  return PROJECT_COLORS[id % PROJECT_COLORS.length];
}

export function formatTypeLabel(project) {
  const type = TYPE_LABELS[project.project_type] || "";
  const ext = EXT_LABELS[project.project_extension] || "";
  if (type && ext) return `${type} / ${ext}`;
  return type || "";
}

const ROLE_LABELS = {
  viewer: "Viewer",
  commenter: "Reviewer",
  editor: "Editor",
  admin: "Admin",
};

function ProjectPanelItem({
  project: p,
  isActive,
  isDeleting,
  isRenaming,
  menuOpenId,
  renameRef,
  renameValue,
  setRenameValue,
  setDeletingId,
  setMenuOpenId,
  handleConfirmRename,
  handleConfirmDelete,
  handleSelect,
  handleStartRename,
  handleStartDelete,
  handleOpenSettings,
  activeWordCount,
  activeProjectId,
  showRoleBadge,
}) {
  const canManageProject =
    p.current_user_role === "owner" ||
    p.current_user_role === "admin" ||
    p.current_user_role === "editor";
  const color = getProjectColor(p.id);
  const typeLabel = formatTypeLabel(p);

  if (isDeleting) {
    return (
      <div className="project-panel-confirm">
        <span className="project-panel-confirm-text">
          Delete <strong>{p.name}</strong> and all its documents?
        </span>
        <div className="project-panel-confirm-actions">
          <button
            className="project-panel-confirm-cancel"
            onClick={() => setDeletingId(null)}
          >
            Cancel
          </button>
          <button
            className="project-panel-confirm-delete"
            onClick={handleConfirmDelete}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`project-panel-item${isActive ? " active" : ""}`}
      onClick={() => !isRenaming && handleSelect(p.id)}
    >
      <div className="project-panel-item-header">
        <span className="project-dot" style={{ background: color }} />
        {isRenaming ? (
          <input
            ref={renameRef}
            className="project-panel-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmRename();
              if (e.key === "Escape") setDeletingId(null);
            }}
            onBlur={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="project-panel-item-name">{p.name}</span>
            {showRoleBadge && p.current_user_role && (
              <span className="role-badge">
                {ROLE_LABELS[p.current_user_role] || p.current_user_role}
              </span>
            )}
          </>
        )}
        {!isRenaming && canManageProject && (
          <button
            className="project-panel-item-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === p.id ? null : p.id);
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* Context menu */}
      {menuOpenId === p.id && (
        <div
          className="project-panel-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleStartRename(p)}>Rename</button>
          <button onClick={() => handleOpenSettings(p.id)}>Settings</button>
          <div className="project-panel-context-divider" />
          <button
            className="project-panel-context-danger"
            onClick={() => handleStartDelete(p.id)}
          >
            Delete
          </button>
        </div>
      )}

      <div className="project-panel-item-meta">
        {typeLabel && <span>{typeLabel}</span>}
        {isActive && activeWordCount > 0 && (
          <>
            {typeLabel && <span className="meta-dot">&middot;</span>}
            <span>{activeWordCount.toLocaleString()} words</span>
          </>
        )}
      </div>
      <span className="project-panel-item-date">
        {timeAgo(p.updated_at)}
      </span>
    </div>
  );
}

export function ProjectSwitcher({
  projects,
  activeProjectId,
  nodes,
  canCreateProjects = true,
  onSelect,
  onCreate,
  onQuickCreate,
  onDelete,
  onRename,
  onOpenSettings,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickType, setQuickType] = useState("");

  const ref = useRef(null);
  const searchRef = useRef(null);
  const renameRef = useRef(null);
  const quickNameRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Focus search when panel opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  // Focus quick-create name input
  useEffect(() => {
    if (isQuickCreating && quickNameRef.current) {
      quickNameRef.current.focus();
    }
  }, [isQuickCreating]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setMenuOpenId(null);
      setRenamingId(null);
      setDeletingId(null);
      setIsQuickCreating(false);
      setQuickName("");
      setQuickType("");
    }
  }, [isOpen]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (isQuickCreating) {
          setIsQuickCreating(false);
        } else if (renamingId) {
          setRenamingId(null);
        } else if (deletingId) {
          setDeletingId(null);
        } else if (menuOpenId) {
          setMenuOpenId(null);
        } else {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isQuickCreating, renamingId, deletingId, menuOpenId]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Compute word count for active project from loaded nodes
  const activeWordCount = useMemo(() => {
    if (!nodes?.length) return 0;
    return nodes
      .filter((n) => n.type === "file")
      .reduce((sum, n) => sum + countWords(n.content_md), 0);
  }, [nodes]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const myProjects = useMemo(
    () => filteredProjects.filter((p) => p.current_user_role === "owner"),
    [filteredProjects]
  );
  const sharedProjects = useMemo(
    () => filteredProjects.filter((p) => p.current_user_role && p.current_user_role !== "owner"),
    [filteredProjects]
  );

  const handleSelect = (projectId) => {
    onSelect(projectId);
    setIsOpen(false);
  };

  const handleStartRename = (project) => {
    setMenuOpenId(null);
    setRenamingId(project.id);
    setRenameValue(project.name);
  };

  const handleConfirmRename = () => {
    if (renameValue.trim() && renameValue.trim() !== projects.find((p) => p.id === renamingId)?.name) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleStartDelete = (projectId) => {
    setMenuOpenId(null);
    setDeletingId(projectId);
  };

  const handleConfirmDelete = () => {
    onDelete(deletingId);
    setDeletingId(null);
  };

  const handleQuickCreate = () => {
    if (!quickName.trim()) return;
    onQuickCreate({ name: quickName.trim(), type: quickType });
    setIsQuickCreating(false);
    setIsOpen(false);
  };

  const handleOpenSettings = (projectId) => {
    setMenuOpenId(null);
    setIsOpen(false);
    onOpenSettings(projectId);
  };

  return (
    <div className="project-switcher" ref={ref}>
      {/* Trigger */}
      <button
        className="project-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {activeProject && (
          <span
            className="project-dot"
            style={{ background: getProjectColor(activeProject.id) }}
          />
        )}
        <span>{activeProject?.name || "Select project"}</span>
        <svg
          className={`project-switcher-chevron${isOpen ? " open" : ""}`}
          viewBox="0 0 24 24"
          width="12"
          height="12"
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

      {/* Panel */}
      {isOpen && (
        <div className="project-panel">
          {/* Search */}
          <div className="project-panel-search">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Project list */}
          <div className="project-panel-list">
            {filteredProjects.length === 0 && (
              <div className="project-panel-empty">
                {projects.length === 0
                  ? "No projects yet. Create one to get started."
                  : "No projects found."}
              </div>
            )}

            {myProjects.length > 0 && sharedProjects.length > 0 && (
              <div className="project-group-label">My Projects</div>
            )}

            {myProjects.map((p) => (
              <ProjectPanelItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                isDeleting={deletingId === p.id}
                isRenaming={renamingId === p.id}
                menuOpenId={menuOpenId}
                renameRef={renameRef}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                setDeletingId={setDeletingId}
                setMenuOpenId={setMenuOpenId}
                handleConfirmRename={handleConfirmRename}
                handleConfirmDelete={handleConfirmDelete}
                handleSelect={handleSelect}
                handleStartRename={handleStartRename}
                handleStartDelete={handleStartDelete}
                handleOpenSettings={handleOpenSettings}
                activeWordCount={activeWordCount}
                activeProjectId={activeProjectId}
              />
            ))}

            {sharedProjects.length > 0 && (
              <div className="project-group-label">Shared with me</div>
            )}

            {sharedProjects.map((p) => (
              <ProjectPanelItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                isDeleting={deletingId === p.id}
                isRenaming={renamingId === p.id}
                menuOpenId={menuOpenId}
                renameRef={renameRef}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                setDeletingId={setDeletingId}
                setMenuOpenId={setMenuOpenId}
                handleConfirmRename={handleConfirmRename}
                handleConfirmDelete={handleConfirmDelete}
                handleSelect={handleSelect}
                handleStartRename={handleStartRename}
                handleStartDelete={handleStartDelete}
                handleOpenSettings={handleOpenSettings}
                activeWordCount={activeWordCount}
                activeProjectId={activeProjectId}
                showRoleBadge
              />
            ))}
          </div>

          {/* Footer */}
          <div className="project-panel-footer">
            {canCreateProjects && isQuickCreating ? (
              <div className="project-panel-quick-form">
                <input
                  ref={quickNameRef}
                  className="project-panel-quick-input"
                  placeholder="Project name..."
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickCreate();
                    if (e.key === "Escape") setIsQuickCreating(false);
                  }}
                />
                <select
                  className="project-panel-quick-select"
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value)}
                >
                  {QUICK_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <div className="project-panel-quick-actions">
                  <button
                    className="project-panel-quick-cancel"
                    onClick={() => setIsQuickCreating(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="project-panel-quick-submit"
                    disabled={!quickName.trim()}
                    onClick={handleQuickCreate}
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : canCreateProjects ? (
              <>
                <button
                  className="project-panel-create-btn"
                  onClick={() => setIsQuickCreating(true)}
                >
                  + Quick create
                </button>
                <button
                  className="project-panel-wizard-btn"
                  onClick={() => {
                    onCreate();
                    setIsOpen(false);
                  }}
                  title="New project with wizard"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M9.937 4.562 11.5 1l1.563 3.562L16.625 6.5l-3.562 1.063L11.5 11.125 9.937 7.563 6.375 6.5Zm7.063 5.938L18.25 8l1.25 2.5L22 11.75l-2.5 1.25L18.25 15.5 17 13l-2.5-1.25ZM9.937 14.438 11.5 11l1.563 3.438L16.625 16l-3.562 1.563L11.5 21l-1.563-3.437L6.375 16Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <div className="project-panel-empty">
                Reviewer access
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
