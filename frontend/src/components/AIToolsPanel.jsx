import { useCallback, useState } from "react";
import { api } from "../api";
import { ReviewerIcon } from "./ReviewerIcon";
import { ReviewerMarkdown } from "./ReviewerMarkdown";
import { ReviewerThinkingState } from "./ReviewerThinkingState";
import { REVIEWER_TOOLS, getReviewerTool } from "./reviewerPanelConfig";

export function AIToolsPanel({ reviewId, nodeId }) {
  const [results, setResults] = useState({});
  const [resultOrder, setResultOrder] = useState([]);
  const [loadingToolId, setLoadingToolId] = useState(null);

  const runTool = useCallback(async (tool) => {
    if (loadingToolId) return;
    setLoadingToolId(tool.id);
    try {
      const res = await api.analyzeForReview(
        reviewId,
        tool.id,
        tool.scope === "node" ? nodeId : null
      );
      setResults((prev) => ({
        ...prev,
        [tool.id]: res.result || res.detail || JSON.stringify(res),
      }));
      setResultOrder((prev) => [tool.id, ...prev.filter((id) => id !== tool.id)]);
    } catch (err) {
      setResults((prev) => ({ ...prev, [tool.id]: `Error: ${err.message}` }));
      setResultOrder((prev) => [tool.id, ...prev.filter((id) => id !== tool.id)]);
    } finally {
      setLoadingToolId(null);
    }
  }, [loadingToolId, reviewId, nodeId]);

  return (
    <div className="ai-tools-panel">
      <div className="ai-tools-panel__grid">
        {REVIEWER_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`ai-tools-panel__btn${loadingToolId === tool.id ? " ai-tools-panel__btn--thinking" : ""}`}
            onClick={() => runTool(tool)}
            disabled={Boolean(loadingToolId)}
          >
            <span className="ai-tools-panel__icon-wrap">
              <ReviewerIcon name={tool.icon} className="ai-tools-panel__icon" size={20} />
            </span>
            <span className="ai-tools-panel__label">{tool.label}</span>
            {tool.scope === "node" && <span className="ai-tools-panel__scope">current chapter</span>}
          </button>
        ))}
      </div>

      {loadingToolId && (
        <div className="ai-tools-panel__result ai-tools-panel__result--thinking">
          <div className="ai-tools-panel__result-head">
            <div className="ai-tools-panel__result-title">
              <ReviewerIcon name={getReviewerTool(loadingToolId)?.icon} size={16} />
              <span>{getReviewerTool(loadingToolId)?.label || "Analyzing"}</span>
            </div>
            <span className="ai-tools-panel__result-badge">Live</span>
          </div>
          <ReviewerThinkingState
            kind="tool"
            toolId={loadingToolId}
            title="AI is reading the manuscript"
          />
        </div>
      )}

      {resultOrder.map((toolId) => (
        <div key={toolId} className="ai-tools-panel__result">
          <div className="ai-tools-panel__result-head">
            <div className="ai-tools-panel__result-title">
              <ReviewerIcon name={getReviewerTool(toolId)?.icon} size={16} />
              <span>{getReviewerTool(toolId)?.label}</span>
            </div>
          </div>
          <ReviewerMarkdown className="ai-tools-panel__result-body" content={results[toolId]} />
        </div>
      ))}
    </div>
  );
}
