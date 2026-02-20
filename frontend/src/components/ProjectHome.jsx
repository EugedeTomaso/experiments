import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContextFilePicker } from "./ContextFilePicker";
import { wordCount, timeAgo } from "../utils";

const TYPE_LABELS = {
  novel: "Novel", "short-story": "Short Story", screenplay: "Screenplay",
  "tv-series": "TV Series", youtube: "YouTube / Video", article: "Article / Essay",
  academic: "Academic", product: "Product / Work", freeform: "Freeform",
};
const EXT_LABELS = {
  novella: "Novella", standard: "Standard Novel", saga: "Saga / Series",
  flash: "Flash Fiction", short: "Short Story", novelette: "Novelette",
  "short-film": "Short Film", feature: "Feature Film", series: "Series / Limited",
  limited: "Limited Series", season: "Single Season", "multi-season": "Multi-Season",
  "short-video": "Short / Reel", "standard-video": "Standard Video", "long-video": "Long-form / Documentary",
  blog: "Blog Post", essay: "Essay", longform: "Long-form Article",
  "academic-essay": "Academic Essay", paper: "Research Paper", monograph: "Monograph", thesis: "Thesis / Dissertation",
  brief: "Product Brief", "full-product": "Full Product", "research-project": "Research Project",
};

export function ProjectHome({ project, nodes = [], agents = [], onUpdate, onDelete, onEditAgent, onCreateAgent, memories = [], onCreateMemory, onDeleteMemory, onUpdateMemory }) {
  const [brief, setBrief] = useState(project?.brief || "");
  const [autoContext, setAutoContext] = useState(project?.auto_context !== false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");
  const debounceRef = useRef(null);
  const titleRef = useRef(null);

  const projectMemories = memories.filter((m) => m.scope === "project");

  useEffect(() => {
    setBrief(project?.brief || "");
    setAutoContext(project?.auto_context !== false);
    setIsConfirmingDelete(false);
  }, [project?.id]);

  const saveBrief = useCallback(
    (value) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate({ brief: value });
      }, 800);
    },
    [onUpdate]
  );

  const handleBriefChange = (e) => {
    const value = e.target.value;
    setBrief(value);
    saveBrief(value);
  };

  const toggleAutoContext = () => {
    const next = !autoContext;
    setAutoContext(next);
    onUpdate({ auto_context: next });
  };

  const handleTitleBlur = () => {
    const newTitle = titleRef.current?.textContent?.trim();
    if (newTitle && newTitle !== project.name) {
      onUpdate({ name: newTitle });
    } else if (titleRef.current) {
      titleRef.current.textContent = project.name;
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      titleRef.current?.blur();
    }
    if (e.key === "Escape") {
      if (titleRef.current) titleRef.current.textContent = project.name;
      titleRef.current?.blur();
    }
  };

  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.type === "file");
    const totalWords = files.reduce((sum, n) => sum + wordCount(n.content_md), 0);
    const allDates = nodes.map((n) => n.updated_at).filter(Boolean);
    const lastUpdated = allDates.length
      ? allDates.sort((a, b) => new Date(b) - new Date(a))[0]
      : null;
    return { docCount: files.length, totalWords, lastUpdated };
  }, [nodes]);

  if (!project) return null;

  const typeLabel = TYPE_LABELS[project.project_type] || project.project_type || "";
  const extLabel = EXT_LABELS[project.project_extension] || project.project_extension || "";
  const fullType = typeLabel && extLabel ? `${typeLabel} / ${extLabel}` : typeLabel;

  return (
    <div className="project-home">
      <h1
        ref={titleRef}
        className="project-home-title"
        contentEditable
        suppressContentEditableWarning
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        spellCheck={false}
      >
        {project.name}
      </h1>
      {fullType && <span className="project-home-type-label">{fullType}</span>}
      {project.created_at && (
        <span className="project-home-date">
          Created {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )}

      {/* Stats */}
      <div className="project-home-stats">
        <div className="project-home-stat">
          <span className="project-home-stat-value">{stats.docCount}</span>
          <span className="project-home-stat-label">Documents</span>
        </div>
        <div className="project-home-stat">
          <span className="project-home-stat-value">{stats.totalWords.toLocaleString()}</span>
          <span className="project-home-stat-label">Words</span>
        </div>
        {stats.lastUpdated && (
          <div className="project-home-stat">
            <span className="project-home-stat-value">{timeAgo(stats.lastUpdated)}</span>
            <span className="project-home-stat-label">Last edit</span>
          </div>
        )}
      </div>

      <div className="section-divider">Brief</div>

      <textarea
        className="project-home-brief"
        value={brief}
        onChange={handleBriefChange}
        placeholder="What is this project about?"
        rows={3}
      />

      <div className="section-divider">Reference</div>

      <ContextFilePicker
        pinnedIds={project.context_nodes || []}
        nodes={nodes}
        onChange={(newIds) => onUpdate({ context_nodes: newIds })}
      />

      <div className="section-divider">Behavior</div>

      <div className="toggle-row">
        <button
          className={`toggle-track${autoContext ? " on" : ""}`}
          onClick={toggleAutoContext}
          role="switch"
          aria-checked={autoContext}
        >
          <span className="toggle-thumb" />
        </button>
        <span className="toggle-label">Auto-include siblings</span>
      </div>
      <p className="toggle-hint">
        When no files are pinned to a folder, documents in the same folder are included automatically.
      </p>

      <div className="section-divider">Memory</div>

      <p className="project-home-memory-hint">
        Preferences the AI remembers for this project.
      </p>
      <div className="project-home-memory-list">
        {projectMemories.map((mem) => (
          <div key={mem.id} className="project-home-memory-item">
            {editingMemoryId === mem.id ? (
              <input
                className="project-home-memory-edit-input"
                value={editingMemoryText}
                onChange={(e) => setEditingMemoryText(e.target.value)}
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdateMemory(mem.id, { content: editingMemoryText });
                    setEditingMemoryId(null);
                  }
                  if (e.key === "Escape") setEditingMemoryId(null);
                }}
                onBlur={() => {
                  if (editingMemoryText.trim() && editingMemoryText !== mem.content) {
                    onUpdateMemory(mem.id, { content: editingMemoryText });
                  }
                  setEditingMemoryId(null);
                }}
              />
            ) : (
              <span
                className="project-home-memory-text"
                onClick={() => {
                  setEditingMemoryId(mem.id);
                  setEditingMemoryText(mem.content);
                }}
              >
                {mem.content}
              </span>
            )}
            {mem.source === "ai_suggested" && (
              <span className="project-home-memory-source">AI</span>
            )}
            <button
              className="project-home-memory-delete"
              onClick={() => onDeleteMemory(mem.id)}
              aria-label="Delete"
            >
              <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {projectMemories.length === 0 && (
          <div className="project-home-memory-empty">No project memories yet.</div>
        )}
      </div>
      <div className="project-home-memory-add">
        <input
          type="text"
          placeholder="e.g., Never use cliches. Prefer active voice."
          value={newMemoryText}
          onChange={(e) => setNewMemoryText(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newMemoryText.trim()) {
              onCreateMemory(newMemoryText.trim(), "project");
              setNewMemoryText("");
            }
          }}
        />
        <button
          className="project-home-memory-add-btn"
          onClick={() => {
            if (!newMemoryText.trim()) return;
            onCreateMemory(newMemoryText.trim(), "project");
            setNewMemoryText("");
          }}
          disabled={!newMemoryText.trim()}
        >
          Add
        </button>
      </div>

      <div className="section-divider">Assistants</div>

      <div className="project-home-agents">
        {agents.length > 0 ? (
          agents.map((agent) => (
            <div key={agent.id} className="project-home-agent-row">
              <div className="project-home-agent-info">
                <span className="project-home-agent-name">{agent.name}</span>
                <span className="project-home-agent-model">{agent.config?.model || "default"}</span>
              </div>
              <button
                className="project-home-agent-edit"
                onClick={() => onEditAgent?.(agent)}
                aria-label={`Edit ${agent.name}`}
              >
                Edit
              </button>
            </div>
          ))
        ) : (
          <p className="project-home-agents-empty">No assistants yet.</p>
        )}
        <button
          className="project-home-add-agent"
          onClick={onCreateAgent}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          Add assistant
        </button>
      </div>

      <div className="section-divider">Danger Zone</div>

      <div className="project-home-danger">
        {isConfirmingDelete ? (
          <div className="project-home-confirm">
            <span className="project-home-confirm-text">
              This will permanently delete <strong>{project.name}</strong> and all its documents. This cannot be undone.
            </span>
            <div className="project-home-confirm-actions">
              <button
                className="project-home-confirm-cancel"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                className="project-home-confirm-delete"
                onClick={onDelete}
              >
                Delete permanently
              </button>
            </div>
          </div>
        ) : (
          <button
            className="project-home-delete-btn"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete this project
          </button>
        )}
      </div>
    </div>
  );
}
