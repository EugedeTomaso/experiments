import { useEffect, useRef, useState } from "react";
import { buildSnippet, timeAgo, wordCount } from "../utils";

// SVG Icons — 16px grid, consistent with topbar
const ChevronIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path
      d="M6 3.5L10.5 8 6 12.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

const MoreIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="3.5" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="12.5" r="1.2" fill="currentColor" />
  </svg>
);

export function TreeItem({
  node,
  depth,
  activeNodeId,
  onSelect,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTargetId,
  dropPosition,
  draggingId,
  agentNodeIds,
  focusedNodeId,
  onFocusNode,
  onExpandNode,
  onCollapseNode,
  expandedFolders,
  filterText,
  showMeta,
  onHoverStart,
  onHoverEnd,
}) {
  const isDropTarget = String(dropTargetId) === String(node.id);
  const isDragging = String(draggingId) === String(node.id);
  const hasAgent = agentNodeIds?.has(String(node.id));
  const isActive = String(activeNodeId) === String(node.id);
  const isFocused = String(focusedNodeId) === String(node.id);

  const isFolder = node.type === "folder";
  const hasChildren = node.children?.length > 0;
  const isExpanded = expandedFolders ? expandedFolders.has(String(node.id)) : true;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const itemRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Scroll into view when this item becomes active
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  // Focus management for keyboard nav
  useEffect(() => {
    if (isFocused && itemRef.current && !isEditing) {
      itemRef.current.focus({ preventScroll: false });
    }
  }, [isFocused, isEditing]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditValue(node.title);
    setIsEditing(true);
  };

  const commitRename = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue.trim() !== node.title) {
      onRename(node.id, editValue.trim());
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(node.title);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete(node.id);
  };

  const handleRenameFromMenu = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    setEditValue(node.title);
    setIsEditing(true);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    if (isExpanded) {
      onCollapseNode?.(String(node.id));
    } else {
      onExpandNode?.(String(node.id));
    }
  };

  // Keyboard navigation on the tree item
  const handleKeyDown = (e) => {
    if (isEditing) return;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        onSelect(node);
        break;
      case "F2":
        e.preventDefault();
        setEditValue(node.title);
        setIsEditing(true);
        break;
      case "Delete":
      case "Backspace":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onDelete(node.id);
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (isFolder && !isExpanded) {
          onExpandNode?.(String(node.id));
        } else if (isFolder && isExpanded && hasChildren) {
          // Move focus to first child
          const firstChild = node.children[0];
          if (firstChild) onFocusNode?.(String(firstChild.id));
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (isFolder && isExpanded) {
          onCollapseNode?.(String(node.id));
        }
        // Parent focus is handled by the tree container
        break;
      default:
        break;
    }
  };

  const dropClass =
    isDropTarget && dropPosition === "inside"
      ? "drop-inside"
      : isDropTarget && dropPosition === "before"
      ? "drop-before"
      : isDropTarget && dropPosition === "after"
      ? "drop-after"
      : "";

  // Filter: if filterText is set, only show matching items
  const matchesFilter = !filterText || node.title.toLowerCase().includes(filterText.toLowerCase());
  const childrenMatchFilter = filterText && node.children?.some(function checkMatch(child) {
    if (child.title.toLowerCase().includes(filterText.toLowerCase())) return true;
    return child.children?.some(checkMatch) || false;
  });

  if (filterText && !matchesFilter && !childrenMatchFilter) return null;

  // Build metadata line content
  const metaParts = [];
  if (showMeta && !isEditing) {
    if (isFolder) {
      const count = node.children?.length || 0;
      if (count > 0) metaParts.push(`${count} item${count !== 1 ? "s" : ""}`);
    } else {
      const snippet = buildSnippet(node.summary || "", 50);
      if (snippet) metaParts.push(snippet);
      const wc = wordCount(node.content_md);
      if (wc > 0) metaParts.push(`${wc}w`);
      else metaParts.push("Empty");
    }
    if (node.updated_at) metaParts.push(timeAgo(node.updated_at));
  }

  return (
    <div
      className={`tree-item ${node.type} ${dropClass}`}
      role="treeitem"
      aria-expanded={isFolder ? isExpanded : undefined}
      aria-selected={isActive}
    >
      <div
        ref={itemRef}
        className={`tree-button ${isActive ? "active" : ""} ${isDragging ? "dragging" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isEditing && onSelect(node)}
        onKeyDown={handleKeyDown}
        tabIndex={isFocused ? 0 : -1}
        draggable={!isEditing}
        onDragStart={(event) => onDragStart(event, node)}
        onDragOver={(event) => onDragOver(event, node)}
        onDrop={(event) => onDrop(event, node)}
        onDragEnd={onDragEnd}
        onMouseEnter={(e) => {
          if (onHoverStart && !isEditing && !isDragging) {
            onHoverStart(node, e.currentTarget.getBoundingClientRect());
          }
        }}
        onMouseLeave={() => onHoverEnd?.()}
      >
        {isFolder ? (
          <span
            className={`tree-chevron ${isExpanded ? "expanded" : ""}`}
            onClick={handleToggleExpand}
          >
            <ChevronIcon />
          </span>
        ) : (
          <span className="tree-icon">
            <FileIcon />
          </span>
        )}
        <div className="tree-button-content">
          {isEditing ? (
            <input
              ref={inputRef}
              className="tree-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-label" onDoubleClick={handleDoubleClick}>
              {node.title}
            </span>
          )}
          {metaParts.length > 0 && (
            <div className="tree-meta">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="tree-meta-dot" />}
                  <span>{part}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {hasAgent && <span className="agent-dot" />}
        {!isEditing && (
          <div className="tree-more-wrapper" ref={menuRef}>
            <button
              className="tree-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label={`Actions for ${node.title}`}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <div className="tree-context-menu">
                <button className="tree-context-item" onClick={handleRenameFromMenu}>
                  Rename
                </button>
                <div className="tree-context-divider" />
                <button className="tree-context-item danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {hasChildren && (isExpanded || (filterText && childrenMatchFilter)) && (
        <div className="tree-children" role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dropTargetId={dropTargetId}
              dropPosition={dropPosition}
              draggingId={draggingId}
              agentNodeIds={agentNodeIds}
              focusedNodeId={focusedNodeId}
              onFocusNode={onFocusNode}
              onExpandNode={onExpandNode}
              onCollapseNode={onCollapseNode}
              expandedFolders={expandedFolders}
              filterText={filterText}
              showMeta={showMeta}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
