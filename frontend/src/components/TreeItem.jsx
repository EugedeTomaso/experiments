import { useEffect, useRef, useState } from "react";

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
  draggingId,
  agentNodeIds,
}) {
  const isDropTarget = String(dropTargetId) === String(node.id);
  const isDragging = String(draggingId) === String(node.id);
  const hasAgent = agentNodeIds?.has(String(node.id));

  const isFolder = node.type === "folder";
  const hasChildren = node.children?.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(node.title);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  return (
    <div className={`tree-item ${node.type} ${isDropTarget ? "drop-target" : ""}`}>
      <div
        className={`tree-button ${activeNodeId === node.id ? "active" : ""} ${
          isDragging ? "dragging" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isEditing && onSelect(node)}
        draggable={!isEditing}
        onDragStart={(event) => onDragStart(event, node)}
        onDragOver={(event) => onDragOver(event, node)}
        onDrop={(event) => onDrop(event, node)}
        onDragEnd={onDragEnd}
      >
        {isFolder ? (
          <span
            className={`tree-chevron ${isExpanded ? "expanded" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
          >
            &#x25B8;
          </span>
        ) : (
          <span className="tree-icon">&#x270E;</span>
        )}
        {isEditing ? (
          <input
            ref={inputRef}
            className="tree-rename-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tree-label" onDoubleClick={handleDoubleClick}>
            {node.title}
          </span>
        )}
        {hasAgent && <span className="agent-dot" />}
        {!isEditing && (
          <button
            className="tree-delete-btn"
            onClick={handleDelete}
            title="Delete"
            aria-label={`Delete ${node.title}`}
          >
            &times;
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="tree-children">
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
              draggingId={draggingId}
              agentNodeIds={agentNodeIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
