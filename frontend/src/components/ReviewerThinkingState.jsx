import { useEffect, useState } from "react";

import { getChatThinkingMessage, getToolThinkingMessage } from "./reviewerPanelConfig";

export function ReviewerThinkingState({
  kind = "tool",
  toolId = null,
  title = "Thinking",
  context = "",
  compact = false,
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const message =
    kind === "chat" ? getChatThinkingMessage(tick) : getToolThinkingMessage(toolId, tick);

  return (
    <div className={`reviewer-thinking${compact ? " reviewer-thinking--compact" : ""}`}>
      <div className="reviewer-thinking__header">
        <div className="reviewer-thinking__spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="reviewer-thinking__title-group">
          <div className="reviewer-thinking__title">{title}</div>
          <div className="reviewer-thinking__message">
            {message}
            {context ? <span className="reviewer-thinking__context"> · {context}</span> : null}
          </div>
        </div>
      </div>
      <div className="reviewer-thinking__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
