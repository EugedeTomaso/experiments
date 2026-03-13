import { useEffect, useRef } from "react";

const AgentIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
      fill="currentColor"
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

export function CombinedMentionPicker({
  agents,
  files,
  nodesById,
  selectedIndex,
  onSelectAgent,
  onSelectFile,
  onHoverIndex,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".mention-picker-item");
    const item = items[selectedIndex];
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

  const hasAgents = agents.length > 0;
  const hasFiles = files.length > 0;

  if (!hasAgents && !hasFiles) return null;

  return (
    <div className="mention-picker" ref={listRef}>
      {hasAgents && (
        <>
          <div className="mention-picker-hint">Agents</div>
          <div className="mention-picker-list">
            {agents.map((agent, i) => (
              <div
                key={`agent-${agent.id}`}
                className={`mention-picker-item${i === selectedIndex ? " selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectAgent(agent);
                }}
                onMouseEnter={() => onHoverIndex(i)}
              >
                <AgentIcon />
                <span className="mention-picker-item-title">{agent.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {hasAgents && hasFiles && <div className="mention-picker-divider" />}
      {hasFiles && (
        <>
          <div className="mention-picker-hint">Files</div>
          <div className="mention-picker-list">
            {files.map((file, i) => {
              const globalIndex = agents.length + i;
              const path = getParentPath(file);
              return (
                <div
                  key={`file-${file.id}`}
                  className={`mention-picker-item${globalIndex === selectedIndex ? " selected" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectFile(file);
                  }}
                  onMouseEnter={() => onHoverIndex(globalIndex)}
                >
                  <FileIcon />
                  <span className="mention-picker-item-title">{file.title}</span>
                  {path && <span className="mention-picker-path">{path}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
