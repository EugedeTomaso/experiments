import { useEffect, useMemo, useRef, useState } from "react";

const FileIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
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

const CloseIcon = () => (
  <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
    <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function ContextFilePicker({ pinnedIds = [], nodes = [], onChange, excludeNodeId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [String(n.id), n])),
    [nodes]
  );

  const pinnedFiles = useMemo(
    () => pinnedIds
      .map((id) => nodesById.get(String(id)))
      .filter(Boolean),
    [pinnedIds, nodesById]
  );

  const pinnedSet = useMemo(
    () => new Set(pinnedIds.map(String)),
    [pinnedIds]
  );

  const getParentPath = (node) => {
    const parts = [];
    let current = node.parent ? nodesById.get(String(node.parent)) : null;
    while (current) {
      parts.unshift(current.title);
      current = current.parent ? nodesById.get(String(current.parent)) : null;
    }
    return parts.join(" / ");
  };

  const availableFiles = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    return nodes.filter(
      (n) =>
        n.type === "file" &&
        !pinnedSet.has(String(n.id)) &&
        (!excludeNodeId || String(n.id) !== String(excludeNodeId)) &&
        (!lowerFilter || n.title.toLowerCase().includes(lowerFilter))
    );
  }, [nodes, pinnedSet, excludeNodeId, filter]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const handleAdd = (nodeId) => {
    onChange([...pinnedIds, nodeId]);
    setFilter("");
    searchRef.current?.focus();
  };

  const handleRemove = (nodeId) => {
    onChange(pinnedIds.filter((id) => String(id) !== String(nodeId)));
  };

  return (
    <div className="ctx-picker" ref={containerRef}>
      <div className="ctx-pinned-list">
        {pinnedFiles.map((file) => (
          <div key={file.id} className="ctx-pin">
            <FileIcon />
            <span className="ctx-pin-title">{file.title}</span>
            <button
              className="ctx-pin-remove"
              onClick={() => handleRemove(file.id)}
              aria-label={`Remove ${file.title}`}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
        <button
          className="ctx-add-btn"
          onClick={() => { setIsOpen(!isOpen); setFilter(""); }}
        >
          + Add file
        </button>
      </div>

      {isOpen && (
        <div className="ctx-picker-dropdown">
          <input
            ref={searchRef}
            className="ctx-picker-search"
            type="text"
            placeholder="Filter files..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
                setFilter("");
              }
            }}
          />
          <div className="ctx-picker-list">
            {availableFiles.length === 0 ? (
              <div className="ctx-picker-empty">No files to add</div>
            ) : (
              availableFiles.map((file) => (
                <div
                  key={file.id}
                  className="ctx-picker-item"
                  onClick={() => handleAdd(file.id)}
                >
                  <FileIcon />
                  <span className="ctx-picker-item-title">{file.title}</span>
                  {(() => {
                    const path = getParentPath(file);
                    return path ? <span className="ctx-picker-path">{path}</span> : null;
                  })()}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
