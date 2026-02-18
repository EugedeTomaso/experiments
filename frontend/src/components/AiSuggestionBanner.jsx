import { useState, useEffect } from "react";

export default function AiSuggestionBanner({ aiSuggestions, currentUserId, onViewDiff, onAccept, onReject }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!aiSuggestions) return;

    function update() {
      const items = [];
      aiSuggestions.forEach((value, key) => {
        if (key !== String(currentUserId) && value.status === "done") {
          items.push({ userId: key, ...value });
        }
      });
      setSuggestions(items);
    }

    aiSuggestions.observe(update);
    update();
    return () => aiSuggestions.unobserve(update);
  }, [aiSuggestions, currentUserId]);

  if (suggestions.length === 0) return null;

  return (
    <div className="ai-suggestion-banners">
      {suggestions.map((s) => (
        <div key={s.userId} className="ai-suggestion-banner">
          <span>Un colaborador sugiere cambios via IA</span>
          <button onClick={() => onViewDiff(s)}>Ver diff</button>
          <button onClick={() => onAccept(s)}>Aceptar</button>
          <button onClick={() => onReject(s)}>Rechazar</button>
        </div>
      ))}
    </div>
  );
}
