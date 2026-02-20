import { useEffect, useRef } from "react";

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

export function MentionPicker({ files, nodesById, selectedIndex, onSelect, onHoverIndex }) {
  const listRef = useRef(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const getParentPath = (node) => {
    const parts = [];
    let current = node.parent ? nodesById.get(String(node.parent)) : null;
    while (current) {
      parts.unshift(current.title);
      current = current.parent ? nodesById.get(String(current.parent)) : null;
    }
    return parts.join(" / ");
  };

  return (
    <div className="mention-picker">
      <div className="mention-picker-hint">Files</div>
      <div className="mention-picker-list" ref={listRef}>
        {files.map((file, i) => {
          const path = getParentPath(file);
          return (
            <div
              key={file.id}
              className={`mention-picker-item${i === selectedIndex ? " selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(file);
              }}
              onMouseEnter={() => onHoverIndex(i)}
            >
              <FileIcon />
              <span className="mention-picker-item-title">{file.title}</span>
              {path && <span className="mention-picker-path">{path}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
