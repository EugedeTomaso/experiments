import { createPortal } from "react-dom";
import { useEffect, useState, useCallback } from "react";
import { AgentMentionPicker } from "./AgentMentionPicker";

export function PortalMentionPicker({ triggerRef, agents, selectedIndex, onSelect, onHoverIndex }) {
  const [position, setPosition] = useState(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
      width: rect.width,
    });
  }, [triggerRef]);

  useEffect(() => {
    updatePosition();
    const scrollParent = triggerRef.current?.closest(".agent-pane-body");
    if (scrollParent) {
      scrollParent.addEventListener("scroll", updatePosition, { passive: true });
      return () => scrollParent.removeEventListener("scroll", updatePosition);
    }
  }, [updatePosition, triggerRef]);

  if (!position) return null;

  return createPortal(
    <div
      className="mention-picker-portal"
      style={{
        position: "fixed",
        left: position.left,
        bottom: position.bottom,
        width: position.width,
        zIndex: 9999,
      }}
    >
      <AgentMentionPicker
        agents={agents}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onHoverIndex={onHoverIndex}
      />
    </div>,
    document.body
  );
}
