const DIMENSIONS = [
  { key: "prose_quality", label: "Prose Quality" },
  { key: "structure", label: "Structure" },
  { key: "consistency", label: "Consistency" },
  { key: "completeness", label: "Completeness" },
];

function barColor(value) {
  if (value >= 7) return "#4caf50";
  if (value >= 4) return "#ff9800";
  return "#f44336";
}

export function ScoreRadar({ aiScore }) {
  if (!aiScore || !aiScore.overall) return null;

  return (
    <div className="score-radar">
      <div className="score-radar__overall">
        <span className="score-radar__overall-value">{aiScore.overall.toFixed(1)}</span>
        <span className="score-radar__overall-label">Overall Score</span>
      </div>
      <div className="score-radar__bars">
        {DIMENSIONS.map(({ key, label }) => {
          const val = aiScore[key] || 0;
          return (
            <div key={key} className="score-radar__row">
              <span className="score-radar__label">{label}</span>
              <div className="score-radar__track">
                <div
                  className="score-radar__fill"
                  style={{ width: `${(val / 10) * 100}%`, background: barColor(val) }}
                />
              </div>
              <span className="score-radar__value">{val.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      {aiScore.summary && (
        <p className="score-radar__summary">{aiScore.summary}</p>
      )}
    </div>
  );
}
