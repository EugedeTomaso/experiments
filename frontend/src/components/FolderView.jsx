import { useMemo, useState } from "react";
import { buildSnippet, timeAgo, wordCount } from "../utils";

const FileIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M4.5 1.5h4.586a1 1 0 0 1 .707.293l2.914 2.914a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M9 1.5v3a1 1 0 0 0 1 1h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M1.5 3.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.5 4.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function FolderView({
  activeNode,
  folderSummary,
  childrenMap,
  nodesById,
  onSelectNode,
  onCreateNode,
  onRenameNode,
}) {
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState("grid");

  const directChildren = useMemo(() => {
    const children = childrenMap.get(String(activeNode.id)) || [];
    const mapped = children.map((child) => {
      const wc = child.type === "file" ? wordCount(child.content_md) : 0;
      const childCount =
        child.type === "folder"
          ? (childrenMap.get(String(child.id)) || []).length
          : 0;
      return { ...child, wc, childCount };
    });

    const sorted = [...mapped];
    if (sortBy === "recent") {
      sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    } else if (sortBy === "alpha") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "words") {
      sorted.sort((a, b) => b.wc - a.wc);
    }
    return sorted;
  }, [activeNode.id, childrenMap, sortBy]);

  return (
    <div className="editor-content">
      <div className="document-header">
        <h1
          className="editable-title"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) => {
            const newTitle = e.target.textContent.trim();
            if (newTitle && newTitle !== activeNode.title) {
              onRenameNode(activeNode.id, newTitle);
            } else {
              e.target.textContent = activeNode.title;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
            if (e.key === "Escape") { e.target.textContent = activeNode.title; e.target.blur(); }
          }}
        >
          {activeNode.title}
        </h1>
        {folderSummary && (
          <div className="document-meta">
            <span className="eyebrow">Folder</span>
            <span className="folder-stats">
              {folderSummary.fileCount} file{folderSummary.fileCount !== 1 ? "s" : ""}
              {folderSummary.folderCount > 0 && (
                <>, {folderSummary.folderCount} folder{folderSummary.folderCount !== 1 ? "s" : ""}</>
              )}
              {folderSummary.wordCount > 0 && (
                <> &middot; {folderSummary.wordCount.toLocaleString()} words</>
              )}
              {folderSummary.lastUpdated && (
                <> &middot; Updated {timeAgo(new Date(folderSummary.lastUpdated).toISOString())}</>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="folder-toolbar">
        <div className="folder-sort-pills">
          {[
            { key: "recent", label: "Recent" },
            { key: "alpha", label: "Name" },
            { key: "words", label: "Words" },
          ].map((opt) => (
            <button
              key={opt.key}
              className={`folder-sort-pill ${sortBy === opt.key ? "active" : ""}`}
              onClick={() => setSortBy(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="folder-view-toggle">
          <button
            className={`folder-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <svg viewBox="0 0 16 16" width="14" height="14">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="1" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            className={`folder-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M1 4h14M1 8h14M1 12h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {directChildren.length === 0 ? (
        <div className="folder-empty">
          <p>This folder is empty</p>
          <button className="folder-empty-action" onClick={() => onCreateNode("file")}>
            Create a document
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="folder-card-grid">
          {directChildren.map((child) => (
            <div
              key={child.id}
              className="folder-card"
              onClick={() => onSelectNode(child)}
            >
              <div className="folder-card-header">
                <span className="folder-card-icon">
                  {child.type === "folder" ? <FolderIcon /> : <FileIcon />}
                </span>
                <span className="folder-card-title">{child.title}</span>
              </div>
              <div className="folder-card-body">
                {child.type === "file" ? (
                  <span className="folder-card-summary">
                    {child.summary
                      ? buildSnippet(child.summary, 120)
                      : buildSnippet(child.content_md, 120) || "Empty document"}
                  </span>
                ) : (
                  <span className="folder-card-summary">
                    {child.childCount} item{child.childCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="folder-card-meta">
                {timeAgo(child.updated_at)}
                {child.type === "file" && child.wc > 0 && (
                  <> &middot; {child.wc}w</>
                )}
              </div>
            </div>
          ))}
          <div
            className="folder-card folder-card-new"
            onClick={() => onCreateNode("file")}
          >
            <PlusIcon />
            <span>New document</span>
          </div>
        </div>
      ) : (
        <div className="folder-list">
          {directChildren.map((child) => (
            <div
              key={child.id}
              className="folder-list-item"
              onClick={() => onSelectNode(child)}
            >
              <span className="folder-list-icon">
                {child.type === "folder" ? <FolderIcon /> : <FileIcon />}
              </span>
              <span className="folder-list-title">{child.title}</span>
              <span className="folder-list-summary">
                {child.type === "file"
                  ? buildSnippet(child.summary || child.content_md, 80) || "Empty"
                  : `${child.childCount} item${child.childCount !== 1 ? "s" : ""}`}
              </span>
              <span className="folder-list-meta">
                {timeAgo(child.updated_at)}
                {child.type === "file" && child.wc > 0 && <> &middot; {child.wc}w</>}
              </span>
            </div>
          ))}
          <div
            className="folder-list-item folder-list-new"
            onClick={() => onCreateNode("file")}
          >
            <span className="folder-list-icon"><PlusIcon /></span>
            <span className="folder-list-title">New document</span>
          </div>
        </div>
      )}
    </div>
  );
}
