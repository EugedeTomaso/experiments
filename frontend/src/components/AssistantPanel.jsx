import { useRef, useEffect } from "react";

export function AssistantPanel({
  isOpen,
  onClose,
  messages,
  streamingContent,
  currentInput,
  onInputChange,
  onSend,
  isStreaming,
  agents,
  resolvedAgent,
  nodeDirectConfig,
  onAgentChange,
  onCreateAgent,
  onSummarize,
  canSummarize,
  isEditingDocument,
}) {
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, streamingContent, isEditingDocument]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <h2>Assistant</h2>
        <div className="assistant-header-actions">
          <button
            className="assistant-close"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="assistant-agent-bar">
        <select
          className="assistant-agent-select"
          value={nodeDirectConfig?.agent || ""}
          onChange={(e) =>
            onAgentChange(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">
            {resolvedAgent?.inherited && resolvedAgent?.agent_name
              ? `Inherited: ${resolvedAgent.agent_name}`
              : "Default"}
          </option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          className="ghost assistant-new-agent"
          onClick={onCreateAgent}
          aria-label="Create agent"
        >
          +
        </button>
      </div>

      {canSummarize && (
        <div className="assistant-summarize-bar">
          <button
            className="assistant-summarize-btn"
            onClick={onSummarize}
            disabled={isStreaming}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Summarize chapter
          </button>
        </div>
      )}

      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 && !streamingContent && (
          <div className="chat-empty">
            Ask anything about your document. The assistant sees your current
            text.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-${msg.role}`}>
            <div className="chat-role">
              {msg.role === "user" ? "You" : "Assistant"}
            </div>
            <div className="chat-content">{msg.content}</div>
          </div>
        ))}
        {isEditingDocument && !streamingContent && (
          <div className="chat-message chat-assistant">
            <div className="chat-content editing-status">
              <span className="editing-dot" />
              Writing to document...
            </div>
          </div>
        )}
        {streamingContent && (
          <div className="chat-message chat-assistant">
            <div className="chat-role">Assistant</div>
            <div className="chat-content">{streamingContent}</div>
          </div>
        )}
      </div>

      <div className="assistant-input-area">
        <textarea
          ref={inputRef}
          className="assistant-input"
          placeholder="Ask about your document…"
          value={currentInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          className="assistant-send"
          onClick={onSend}
          disabled={isStreaming || !currentInput.trim()}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M5 12h14M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
