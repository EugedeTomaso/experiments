import { useCallback, useState } from "react";
import { api } from "../api";
import { ReviewerMarkdown } from "./ReviewerMarkdown";
import { ReviewerThinkingState } from "./ReviewerThinkingState";

export function ReviewerChatPanel({ reviewId, nodeId, nodeTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chatForReview(reviewId, userMsg.content, nodeId);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply || res.detail || JSON.stringify(res) }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, reviewId, nodeId]);

  return (
    <div className="reviewer-chat">
      <div className="reviewer-chat__messages">
        {messages.length === 0 && (
          <div className="reviewer-chat__empty">
            Ask anything about this manuscript.
            {nodeTitle && <span> Currently viewing: {nodeTitle}</span>}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`reviewer-chat__msg reviewer-chat__msg--${msg.role}`}>
            <div className="reviewer-chat__msg-content">
              {msg.role === "assistant" ? (
                <ReviewerMarkdown compact content={msg.content} />
              ) : (
                <div className="reviewer-chat__plain">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="reviewer-chat__msg reviewer-chat__msg--assistant">
            <div className="reviewer-chat__msg-content reviewer-chat__msg-content--thinking">
              <ReviewerThinkingState
                kind="chat"
                title="AI is thinking"
                context={nodeTitle || "full manuscript"}
                compact
              />
            </div>
          </div>
        )}
      </div>
      <div className="reviewer-chat__input-row">
        <input
          type="text"
          className="reviewer-chat__input"
          placeholder="Ask about the manuscript..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
        />
        <button
          className="reviewer-chat__send"
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
