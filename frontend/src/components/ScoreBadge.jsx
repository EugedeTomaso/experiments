export function ScoreBadge({ score, size = "default" }) {
  if (score == null) return null;
  const num = typeof score === "number" ? score : parseFloat(score);
  if (isNaN(num)) return null;
  const level = num >= 7 ? "high" : num >= 4 ? "mid" : "low";
  return (
    <span className={`score-badge score-badge--${size} score-badge--${level}`}>
      {num.toFixed(1)}
    </span>
  );
}
