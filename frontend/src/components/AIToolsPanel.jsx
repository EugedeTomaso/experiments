import { useCallback, useState } from "react";
import { api } from "../api";

const TOOLS = [
  { id: "structure", label: "Analyze Structure", icon: "\u{1F3D7}\u{FE0F}", scope: "project" },
  { id: "prose", label: "Evaluate Prose", icon: "\u{270D}\u{FE0F}", scope: "node" },
  { id: "inconsistencies", label: "Find Inconsistencies", icon: "\u{1F50D}", scope: "project" },
  { id: "summaries", label: "Chapter Summaries", icon: "\u{1F4CB}", scope: "project" },
  { id: "characters", label: "Character Map", icon: "\u{1F465}", scope: "project" },
  { id: "genre", label: "Compare to Genre", icon: "\u{1F4CA}", scope: "project" },
];

export function AIToolsPanel({ reviewId, nodeId }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const runTool = useCallback(async (tool) => {
    setLoading((prev) => ({ ...prev, [tool.id]: true }));
    try {
      const res = await api.analyzeForReview(
        reviewId,
        tool.id,
        tool.scope === "node" ? nodeId : null
      );
      setResults((prev) => ({ ...prev, [tool.id]: res.result || res.detail || JSON.stringify(res) }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [tool.id]: `Error: ${err.message}` }));
    } finally {
      setLoading((prev) => ({ ...prev, [tool.id]: false }));
    }
  }, [reviewId, nodeId]);

  return (
    <div className="ai-tools-panel">
      <div className="ai-tools-panel__grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="ai-tools-panel__btn"
            onClick={() => runTool(tool)}
            disabled={loading[tool.id]}
          >
            <span className="ai-tools-panel__icon">{tool.icon}</span>
            <span className="ai-tools-panel__label">{tool.label}</span>
            {tool.scope === "node" && <span className="ai-tools-panel__scope">current chapter</span>}
          </button>
        ))}
      </div>
      {Object.entries(results).map(([toolId, result]) => (
        <div key={toolId} className="ai-tools-panel__result">
          <h4>{TOOLS.find((t) => t.id === toolId)?.label}</h4>
          <div className="ai-tools-panel__result-body">{result}</div>
        </div>
      ))}
    </div>
  );
}
