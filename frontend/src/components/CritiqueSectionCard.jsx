import { useState, useRef, useEffect } from "react";

function scoreColor(score) {
  if (score >= 8) return "var(--green-text, #2d7d46)";
  if (score >= 5) return "var(--amber-text, #9a6700)";
  return "var(--red-text, #c4432b)";
}

function scoreBg(score) {
  if (score >= 8) return "var(--green-bg, #dafbe1)";
  if (score >= 5) return "var(--amber-bg, #fff8c5)";
  return "var(--red-bg, #ffebe9)";
}

export default function CritiqueSectionCard({
  section,
  messages,
  onDiscuss,
  isDiscussing,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    onDiscuss(section.id, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="critique-section-card">
      <div className="critique-section-header">
        <span className="critique-section-title">{section.title}</span>
        <span
          className="critique-section-score"
          style={{ color: scoreColor(section.score), backgroundColor: scoreBg(section.score) }}
        >
          {section.score}/10
        </span>
      </div>
      <p className="critique-section-body">{section.body}</p>
      <div className="critique-section-actions">
        <button
          className="critique-section-discuss-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "Close" : "Discuss"}
        </button>
      </div>
      {isOpen && (
        <div className="critique-section-thread">
          {messages.map((msg) => (
            <div key={msg.id} className={`critique-msg critique-msg--${msg.role}`}>
              <span className="critique-msg-role">
                {msg.role === "user" ? "You" : "Critic"}
              </span>
              <p className="critique-msg-content">{msg.content}</p>
            </div>
          ))}
          {isDiscussing && (
            <div className="critique-msg-thinking">
              <span className="critique-thinking-spinner" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
          <div className="critique-section-composer">
            <textarea
              className="critique-section-input"
              rows={2}
              placeholder="Ask about this section…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="critique-section-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isDiscussing}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
