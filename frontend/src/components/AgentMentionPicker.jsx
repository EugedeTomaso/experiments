import { useEffect, useRef } from "react";

const AgentIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
      fill="currentColor"
    />
  </svg>
);

export function AgentMentionPicker({ agents, selectedIndex, onSelect, onHoverIndex }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex];
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!agents.length) return null;

  return (
    <div className="mention-picker agent-mention-picker">
      <div className="mention-picker-hint">Agents</div>
      <div className="mention-picker-list" ref={listRef}>
        {agents.map((agent, i) => (
          <div
            key={agent.id}
            className={`mention-picker-item${i === selectedIndex ? " selected" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(agent);
            }}
            onMouseEnter={() => onHoverIndex(i)}
          >
            <AgentIcon />
            <span className="mention-picker-item-title">{agent.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
