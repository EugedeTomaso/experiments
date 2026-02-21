import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { PortalMentionPicker } from "./PortalMentionPicker";

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
  onApplyMessage,
  isDiscussing,
  agents,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const composerRef = useRef(null);

  const filteredAgents = useMemo(() => {
    if (mentionQuery === null || !agents) return [];
    const q = mentionQuery.toLowerCase();
    return agents.filter((a) => a.name.toLowerCase().startsWith(q));
  }, [agents, mentionQuery]);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    let mentionedAgent = null;
    if (agents && agents.length) {
      for (const a of agents) {
        if (text.includes(`@${a.name}`)) {
          mentionedAgent = a;
          break;
        }
      }
    }

    setInput("");
    setMentionQuery(null);
    onDiscuss(section.id, text, mentionedAgent?.id);
  };

  const handleSelectAgent = (agent) => {
    const textarea = inputRef.current;
    const cursorPos = textarea?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    const newBefore = textBeforeCursor.replace(/@\w*$/, `@${agent.name} `);
    setInput(newBefore + textAfterCursor);
    setMentionQuery(null);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredAgents.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSelectAgent(filteredAgents[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
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
              <div className={`critique-msg-content${msg.role === "assistant" ? " chat-content-md" : ""}`}>
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "assistant" && onApplyMessage && (
                <div className="critique-msg-actions">
                  <button
                    className="critique-apply-btn"
                    onClick={() => onApplyMessage(msg.content)}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          ))}
          {isDiscussing && (
            <div className="critique-msg-thinking">
              <span className="critique-thinking-spinner" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
          <div className="critique-section-composer" ref={composerRef}>
            {mentionQuery !== null && filteredAgents.length > 0 && (
              <PortalMentionPicker
                triggerRef={composerRef}
                agents={filteredAgents}
                selectedIndex={mentionIndex}
                onSelect={handleSelectAgent}
                onHoverIndex={setMentionIndex}
              />
            )}
            <textarea
              ref={inputRef}
              className="critique-section-input"
              rows={2}
              placeholder="Ask about this section…"
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                const cursorPos = e.target.selectionStart;
                const textBeforeCursor = val.slice(0, cursorPos);
                const atMatch = textBeforeCursor.match(/@(\w*)$/);
                if (atMatch) {
                  setMentionQuery(atMatch[1]);
                  setMentionIndex(0);
                } else {
                  setMentionQuery(null);
                }
              }}
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
