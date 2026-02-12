import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { timeAgo } from "../utils";

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.lastIndexOf(" ", max);
  return str.slice(0, cut > 0 ? cut : max) + "\u2026";
}

const SUGGESTIONS_WITH_CONTEXT = [
  "Rewrite this",
  "Explain this",
  "Make this clearer",
  "Expand on this",
];

const SUGGESTIONS_WITH_CONTENT = [
  "Summarize",
  "Improve writing",
  "Find issues",
  "Make shorter",
  "Continue writing",
];

const SUGGESTIONS_EMPTY = [
  "Help me get started",
  "Write an outline",
  "Brainstorm ideas",
];

function EmptyState({ pendingContext, canSummarize, onSuggestionAction, isStreaming }) {
  const suggestions = pendingContext
    ? SUGGESTIONS_WITH_CONTEXT
    : canSummarize
      ? SUGGESTIONS_WITH_CONTENT
      : SUGGESTIONS_EMPTY;

  return (
    <div className="agent-empty-state">
      <div className="agent-empty-heading">
        {pendingContext ? "Ask about your selection" : "What can I help with?"}
      </div>
      <div className="suggestion-grid">
        {suggestions.map((label) => (
          <button
            key={label}
            className="agent-suggestion-chip"
            onClick={() => onSuggestionAction?.(label)}
            disabled={isStreaming}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  onSuggestionAction,
  canSummarize,
  isEditingDocument,
  width,
  conversations,
  activeConversationId,
  onSelectConversation,
  onBackToList,
  onDeleteConversation,
  onRenameConversation,
  onEscapeComposer,
  pendingContext,
  onClearContext,
  onStop,
  diffVisible,
  diffAvailable,
  onToggleDiff,
  onUndoEdit,
}) {
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const agentDropdownRef = useRef(null);
  const historyDropdownRef = useRef(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Close agent dropdown on outside click
  useEffect(() => {
    if (!isAgentDropdownOpen) return;
    const handler = (e) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target)) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAgentDropdownOpen]);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!isHistoryOpen) return;
    const handler = (e) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target)) {
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isHistoryOpen]);

  // Auto-scroll thread
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, streamingContent, isEditingDocument]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [currentInput]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onEscapeComposer?.();
    }
  };

  const handleNewThread = () => {
    onBackToList();
    setIsHistoryOpen(false);
  };

  const handleSelectFromHistory = (convId) => {
    onSelectConversation(convId);
    setIsHistoryOpen(false);
  };

  const handleDeleteFromHistory = (e, convId) => {
    e.stopPropagation();
    onDeleteConversation(convId);
  };

  if (!isOpen) return null;

  const agentName = nodeDirectConfig?.agent
    ? agents.find((a) => a.id === nodeDirectConfig.agent)?.name || "Assistant"
    : resolvedAgent?.inherited && resolvedAgent?.agent_name
      ? resolvedAgent.agent_name
      : "Assistant";

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <aside className="agent-pane" style={width ? { width } : undefined}>
      {/* Header */}
      <div className="agent-pane-header">
        <div className="agent-pane-header-left">
          <button
            className="agent-header-btn"
            onClick={handleNewThread}
            aria-label="New thread"
            title="New thread"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="agent-history-wrapper" ref={historyDropdownRef}>
            <button
              className="agent-header-btn"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              aria-label="Conversation history"
              title="History"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isHistoryOpen && (
              <div className="agent-history-dropdown">
                {conversations && conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      className={`agent-history-item${String(conv.id) === String(activeConversationId) ? " active" : ""}`}
                      onClick={() => handleSelectFromHistory(conv.id)}
                    >
                      <span className="agent-history-item-title">
                        {conv.title || "Untitled"}
                      </span>
                      <span className="agent-history-item-time">
                        {timeAgo(conv.updated_at)}
                      </span>
                      <button
                        className="agent-history-item-delete"
                        onClick={(e) => handleDeleteFromHistory(e, conv.id)}
                        aria-label="Delete conversation"
                      >
                        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </button>
                  ))
                ) : (
                  <div className="agent-history-empty">No conversations yet</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="agent-pane-header-right">
          <div className="assistant-agent-wrapper" ref={agentDropdownRef}>
            <button
              className="agent-header-btn"
              onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
              aria-label="Agent settings"
              title="Agent settings"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53a7.76 7.76 0 0 0 .07-1 7.76 7.76 0 0 0-.07-.97l2.11-1.63a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.15 7.15 0 0 0-1.65-.96l-.37-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65a7.68 7.68 0 0 0-1.65.96l-2.49-1a.49.49 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64L4.57 11a8.3 8.3 0 0 0-.07.97 8.3 8.3 0 0 0 .07 1l-2.11 1.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1a7.15 7.15 0 0 0 1.65.96l.37 2.65a.5.5 0 0 0 .5.47h4a.5.5 0 0 0 .49-.42l.38-2.65a7.68 7.68 0 0 0 1.65-.96l2.49 1a.49.49 0 0 0 .61-.22l2-3.46a.49.49 0 0 0-.12-.64Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {isAgentDropdownOpen && (
              <div className="assistant-agent-dropdown">
                <div className="assistant-agent-dropdown-label">Agent</div>
                <button
                  className={`assistant-agent-option${!nodeDirectConfig?.agent ? " active" : ""}`}
                  onClick={() => { onAgentChange(null); setIsAgentDropdownOpen(false); }}
                >
                  {resolvedAgent?.inherited && resolvedAgent?.agent_name
                    ? resolvedAgent.agent_name
                    : "Default"}
                </button>
                {agents.map((a) => (
                  <button
                    key={a.id}
                    className={`assistant-agent-option${nodeDirectConfig?.agent === a.id ? " active" : ""}`}
                    onClick={() => { onAgentChange(a.id); setIsAgentDropdownOpen(false); }}
                  >
                    {a.name}
                  </button>
                ))}
                <div className="assistant-agent-dropdown-divider" />
                <button
                  className="assistant-agent-option"
                  onClick={() => { onCreateAgent(); setIsAgentDropdownOpen(false); }}
                >
                  + Create new…
                </button>
              </div>
            )}
          </div>
          <button
            className="agent-header-btn"
            onClick={onClose}
            aria-label="Close"
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

      {/* Body */}
      <div className="agent-pane-body" ref={bodyRef}>
        {hasMessages ? (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
                {msg.role === "user" && msg.context && (
                  <div className="agent-msg-context">
                    "{truncate(msg.context.text, 120)}"
                  </div>
                )}
                <div className={`agent-msg-content${msg.role === "assistant" ? " chat-content-md" : ""}`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && msg.isDocumentEdit && diffAvailable && i === messages.length - 1 && (
                  <div className="agent-action-block">
                    <div className="agent-action-block-header">
                      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Document updated</span>
                    </div>
                    <div className="agent-action-block-buttons">
                      <button className="agent-action-btn" onClick={onToggleDiff}>
                        {diffVisible ? "Hide changes" : "Show changes"}
                      </button>
                      <button className="agent-action-btn agent-action-btn-danger" onClick={onUndoEdit}>
                        Undo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming states */}
            {isStreaming && (
              <div className="agent-msg agent-msg-assistant">
                <div className="agent-steps">
                  {!streamingContent && !isEditingDocument && (
                    <div className="agent-step agent-step-active">
                      <span className="agent-step-spinner" />
                      <span className="agent-step-label">Thinking</span>
                    </div>
                  )}
                  {isEditingDocument && (
                    <div className="agent-step agent-step-active">
                      <span className="agent-step-spinner" />
                      <span className="agent-step-label">Editing document</span>
                    </div>
                  )}
                </div>
                {streamingContent && (
                  <div className="agent-msg-content chat-content-md">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            pendingContext={pendingContext}
            canSummarize={canSummarize}
            onSuggestionAction={onSuggestionAction}
            isStreaming={isStreaming}
          />
        )}
      </div>

      {/* Context block — above composer */}
      {pendingContext && (
        <div className="agent-context-block">
          <span className="agent-context-label">Selection</span>
          <span className="agent-context-text">
            "{truncate(pendingContext.text, 120)}"
          </span>
          <button
            className="agent-context-dismiss"
            onClick={onClearContext}
            aria-label="Remove context"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Composer */}
      <div className={`agent-composer${pendingContext ? " with-context" : ""}`}>
        <textarea
          ref={inputRef}
          placeholder={pendingContext ? "Ask about this selection\u2026" : "Ask anything\u2026"}
          value={currentInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="agent-composer-footer">
          <span className="agent-composer-model">{agentName}</span>
          {isStreaming ? (
            <button
              className="agent-composer-stop"
              onClick={onStop}
              aria-label="Stop"
            >
              <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              className="agent-composer-send"
              onClick={onSend}
              disabled={!currentInput.trim()}
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
