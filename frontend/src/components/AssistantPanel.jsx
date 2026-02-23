import { useRef, useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { timeAgo } from "../utils";
import { CombinedMentionPicker } from "./CombinedMentionPicker";
import { ReviewTab } from "./ReviewTab";
import { VerifyTab } from "./VerifyTab";
import CritiqueTab from "./CritiqueTab";
import CreateFileCard from "./CreateFileCard";

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.lastIndexOf(" ", max);
  return str.slice(0, cut > 0 ? cut : max) + "\u2026";
}

const FileIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path
      d="M4.5 1.5h4.586a1 1 0 0 1 .707.293l2.914 2.914a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M9 1.5v3a1 1 0 0 0 1 1h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const SUGGESTIONS_WITH_CONTEXT = [
  "Rewrite this",
  "Explain this",
  "Make this clearer",
  "Expand on this",
  "Review selection",
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
  agentMode,
  onAgentModeChange,
  onAgentChange,
  onCreateAgent,
  onEditAgent,
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
  diffStats,
  onToggleDiff,
  onUndoEdit,
  onAcceptEdit,
  nodes,
  mentionedFileIds,
  onMentionedFilesChange,
  mentionedAgentId,
  onMentionedAgentChange,
  memories,
  onCreateMemory,
  onDeleteMemory,
  pendingMemorySuggestion,
  onAcceptMemorySuggestion,
  onDismissMemorySuggestion,
  memoryToast,
  onDismissMemoryToast,
  activeProjectId,
  // Tab system
  activeTab,
  onTabChange,
  // Review/Verify tab data
  reviewTabComments,
  reviewPendingCount,
  reviewAcceptedCount,
  reviewDismissedCount,
  verifyTabComments,
  verifyPendingCount,
  focusedCommentId,
  aiThinkingId,
  getReplies,
  onClickComment,
  onApproveComment,
  onApproveReplyComment,
  onDismissComment,
  onResolveComment,
  onDeleteComment,
  onReplyComment,
  onAskAIComment,
  onLaunchReview,
  onLaunchFactCheck,
  isReviewing,
  isFactChecking,
  factCheckProgress,
  // Critique tab data
  critiques,
  isCritiquing,
  activeCritiqueId,
  critiqueThreadMessages,
  discussingSection,
  onLaunchCritique,
  onDiscussSection,
  onApplyCritiqueMessage,
  onSelectCritique,
  streamingCreateBlocks,
  onCreateFile,
  onCreateFolder,
}) {
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const agentDropdownRef = useRef(null);
  const historyDropdownRef = useRef(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [reviewSubTab, setReviewSubTab] = useState("suggestions");

  // @ mention state
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [isMemoryPopoverOpen, setIsMemoryPopoverOpen] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryScope, setNewMemoryScope] = useState("project");
  const memoryPopoverRef = useRef(null);

  const userMemories = useMemo(
    () => (memories || []).filter((m) => m.scope === "user"),
    [memories]
  );
  const projectMemories = useMemo(
    () => (memories || []).filter((m) => m.scope === "project"),
    [memories]
  );
  const memoryCount = (memories || []).length;

  const nodesById = useMemo(
    () => new Map((nodes || []).map((n) => [String(n.id), n])),
    [nodes]
  );

  const excludeIds = useMemo(
    () => new Set((mentionedFileIds || []).map(String)),
    [mentionedFileIds]
  );

  const filteredMentionNodes = useMemo(() => {
    if (!nodes) return [];
    const lowerFilter = mentionFilter.toLowerCase();
    return nodes.filter(
      (n) =>
        n.type === "file" &&
        !excludeIds.has(String(n.id)) &&
        (!lowerFilter || n.title.toLowerCase().includes(lowerFilter))
    );
  }, [nodes, excludeIds, mentionFilter]);

  const filteredMentionAgents = useMemo(() => {
    if (!agents) return [];
    const lowerFilter = mentionFilter.toLowerCase();
    return agents.filter(
      (a) => !lowerFilter || a.name.toLowerCase().includes(lowerFilter)
    );
  }, [agents, mentionFilter]);

  const totalMentionItems = filteredMentionAgents.length + filteredMentionNodes.length;

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

  // Close memory popover on outside click
  useEffect(() => {
    if (!isMemoryPopoverOpen) return;
    const handler = (e) => {
      if (memoryPopoverRef.current && !memoryPopoverRef.current.contains(e.target)) {
        setIsMemoryPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMemoryPopoverOpen]);

  // Auto-scroll thread
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, streamingContent, isEditingDocument]);

  // Focus input on open or when context is set (e.g. "Ask AI" button)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, pendingContext]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [currentInput]);

  const handleInputChange = (value) => {
    onInputChange(value);

    // Detect @ mention trigger — look for @ followed by optional filter text
    const match = value.match(/@([^\s@]*)$/);
    if (match) {
      setIsMentionOpen(true);
      setMentionFilter(match[1]);
      setMentionIndex(0);
    } else {
      setIsMentionOpen(false);
      setMentionFilter("");
    }
  };

  const handleMentionSelectFile = (node) => {
    if (!node) return;
    onMentionedFilesChange([...(mentionedFileIds || []), node.id]);
    const newValue = currentInput.replace(/@[^\s@]*$/, "");
    onInputChange(newValue);
    setIsMentionOpen(false);
    setMentionFilter("");
    inputRef.current?.focus();
  };

  const handleMentionSelectAgent = (agent) => {
    if (!agent) return;
    onMentionedAgentChange(agent.id);
    const newValue = currentInput.replace(/@[^\s@]*$/, "");
    onInputChange(newValue);
    setIsMentionOpen(false);
    setMentionFilter("");
    inputRef.current?.focus();
  };

  const handleMentionRemove = (nodeId) => {
    onMentionedFilesChange((mentionedFileIds || []).filter((id) => String(id) !== String(nodeId)));
  };

  const handleKeyDown = (e) => {
    // Intercept keyboard when mention picker is open
    if (isMentionOpen && totalMentionItems > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % totalMentionItems);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + totalMentionItems) % totalMentionItems);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const agentCount = filteredMentionAgents.length;
        if (mentionIndex < agentCount) {
          handleMentionSelectAgent(filteredMentionAgents[mentionIndex]);
        } else {
          handleMentionSelectFile(filteredMentionNodes[mentionIndex - agentCount]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }

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

  const agentName = agentMode === "auto"
    ? "Auto"
    : nodeDirectConfig?.agent
      ? agents.find((a) => a.id === nodeDirectConfig.agent)?.name || "Assistant"
      : resolvedAgent?.inherited && resolvedAgent?.agent_name
        ? resolvedAgent.agent_name
        : "Assistant";

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <aside className={`agent-pane${!isOpen ? ' collapsed' : ''}`} style={isOpen && width ? { width } : undefined}>
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
                  <div className="agent-history-empty">Start a conversation with your writing partner.</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="agent-pane-header-right">
          <div className="assistant-agent-wrapper" ref={agentDropdownRef}>
            <button
              className="agent-selector-pill"
              onClick={() => setIsAgentDropdownOpen((prev) => !prev)}
              aria-label="Select agent"
            >
              {agentMode === "auto" && (
                <svg className="auto-agent-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                  <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" />
                  <path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity="0.6" />
                </svg>
              )}
              <span className="agent-selector-pill-name">{agentName}</span>
              {resolvedAgent?.inherited && !nodeDirectConfig?.agent && (
                <span className="agent-selector-pill-inherited">project</span>
              )}
              <svg className="agent-selector-pill-chevron" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isAgentDropdownOpen && (
              <div className="assistant-agent-dropdown">
                <div className="assistant-agent-dropdown-label">Agent</div>
                <button
                  className={`assistant-agent-option${agentMode === "auto" ? " active" : ""}`}
                  onClick={() => {
                    onAgentModeChange("auto");
                    onAgentChange(null);
                    setIsAgentDropdownOpen(false);
                  }}
                >
                  <span className="assistant-agent-option-info">
                    <span className="assistant-agent-option-name">
                      <svg className="auto-agent-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" />
                        <path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity="0.6" />
                      </svg>
                      Auto
                    </span>
                    <span className="assistant-agent-option-meta">picks the best agent per message</span>
                  </span>
                  {agentMode === "auto" && (
                    <svg className="assistant-agent-option-check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <div className="assistant-agent-dropdown-divider" />
                <button
                  className={`assistant-agent-option${agentMode !== "auto" && !nodeDirectConfig?.agent ? " active" : ""}`}
                  onClick={() => { onAgentModeChange("fixed"); onAgentChange(null); setIsAgentDropdownOpen(false); }}
                >
                  <span className="assistant-agent-option-info">
                    <span className="assistant-agent-option-name">
                      {resolvedAgent?.inherited && resolvedAgent?.agent_name
                        ? resolvedAgent.agent_name
                        : "Default"}
                    </span>
                    {resolvedAgent?.inherited && (
                      <span className="assistant-agent-option-meta">inherited from project</span>
                    )}
                  </span>
                  {agentMode !== "auto" && !nodeDirectConfig?.agent && (
                    <svg className="assistant-agent-option-check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {agents.map((a) => {
                  const isActive = nodeDirectConfig?.agent === a.id;
                  return (
                    <button
                      key={a.id}
                      className={`assistant-agent-option${isActive ? " active" : ""}`}
                      onClick={() => { onAgentModeChange("fixed"); onAgentChange(a.id); setIsAgentDropdownOpen(false); }}
                    >
                      <span className="assistant-agent-option-info">
                        <span className="assistant-agent-option-name">{a.name}</span>
                        <span className="assistant-agent-option-meta">{a.config?.model || "default"}</span>
                      </span>
                      <span className="assistant-agent-option-actions">
                        {isActive && (
                          <svg className="assistant-agent-option-check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                            <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <button
                          className="assistant-agent-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAgentDropdownOpen(false);
                            onEditAgent?.(a);
                          }}
                          aria-label={`Edit ${a.name}`}
                        >
                          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                            <path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </span>
                    </button>
                  );
                })}
                <div className="assistant-agent-dropdown-divider" />
                <button
                  className="assistant-agent-option assistant-agent-option-create"
                  onClick={() => { onCreateAgent(); setIsAgentDropdownOpen(false); }}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                  <span>New assistant</span>
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

      {/* Tab bar */}
      <div className="agent-tab-bar">
        <button
          className={`agent-tab${activeTab === "chat" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("chat")}
        >
          Chat
        </button>
        <button
          className={`agent-tab${activeTab === "review" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("review")}
        >
          Review
          {reviewPendingCount > 0 && <span className="agent-tab-badge">{reviewPendingCount}</span>}
        </button>
        <button
          className={`agent-tab${activeTab === "verify" ? " agent-tab--active" : ""}`}
          onClick={() => onTabChange("verify")}
        >
          Verify
          {verifyPendingCount > 0 && <span className="agent-tab-badge">{verifyPendingCount}</span>}
        </button>
      </div>

      {/* Chat tab content */}
      {activeTab === "chat" && <>

      {/* Memory toast */}
      {memoryToast && (
        <div className="memory-toast">
          <span>Saved: "{truncate(memoryToast, 60)}"</span>
          <button className="memory-toast-dismiss" onClick={onDismissMemoryToast}>
            <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
              <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="agent-pane-body" ref={bodyRef}>
        {hasMessages ? (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
                {msg.role === "user" && msg.mentionedFiles?.length > 0 && (
                  <div className="agent-msg-mentions">
                    {msg.mentionedFiles.map((id) => {
                      const node = nodesById.get(String(id));
                      return node ? (
                        <span key={id} className="mention-chip mention-chip-readonly">
                          <FileIcon />
                          <span className="mention-chip-title">{node.title}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {msg.role === "user" && msg.context && (
                  <div className="agent-msg-context">
                    "{truncate(msg.context.text, 120)}"
                  </div>
                )}
                <div className={`agent-msg-content${msg.role === "assistant" ? " chat-content-md" : ""}`}>
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {msg.createBlocks?.map((block, j) => (
                        <CreateFileCard
                          key={j}
                          block={block}
                          onCreateFile={onCreateFile}
                          onCreateFolder={onCreateFolder}
                        />
                      ))}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && msg.routedAgentName && (
                  <button
                    className="agent-msg-routed-badge"
                    onClick={() => {
                      onAgentModeChange("fixed");
                      onAgentChange(msg.routedAgentId);
                    }}
                    title={`Switch to ${msg.routedAgentName}`}
                  >
                    via {msg.routedAgentName}
                  </button>
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
                    {streamingCreateBlocks?.map((block, j) => (
                      <CreateFileCard
                        key={j}
                        block={block}
                        onCreateFile={onCreateFile}
                        onCreateFolder={onCreateFolder}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Memory suggestion nudge */}
            {pendingMemorySuggestion && !isStreaming && (
              <div className="memory-suggestion">
                <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                  <path d="M8 1a5 5 0 0 1 5 5c0 1.8-1 3.3-2.4 4.2-.4.3-.6.7-.6 1.1V12H6v-.7c0-.4-.2-.8-.6-1.1A5 5 0 0 1 8 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M6 13h4M6.5 14.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>Save "{truncate(pendingMemorySuggestion.content, 80)}" as a memory?</span>
                <button
                  className="memory-suggestion-save"
                  onClick={() => onAcceptMemorySuggestion(pendingMemorySuggestion)}
                >
                  Save
                </button>
                <button
                  className="memory-suggestion-dismiss"
                  onClick={onDismissMemorySuggestion}
                  aria-label="Dismiss"
                >
                  <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                    <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
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

      {/* Persistent edit action block — shows whenever diff is available */}
      {diffAvailable && (
        <div className="agent-action-block agent-action-block-sticky">
          <div className="agent-action-block-header">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Document updated</span>
            {diffStats && (
              <span className="agent-action-block-stats">
                {diffStats.modified > 0 && <span>{diffStats.modified} modified</span>}
                {diffStats.added > 0 && <span>{diffStats.added} added</span>}
                {diffStats.deleted > 0 && <span>{diffStats.deleted} removed</span>}
              </span>
            )}
          </div>
          <div className="agent-action-block-buttons">
            <button className="agent-action-btn agent-action-btn-primary" onClick={() => { setConfirmingUndo(false); onAcceptEdit(); }}>
              Accept
            </button>
            <button className="agent-action-btn" onClick={onToggleDiff}>
              {diffVisible ? "Hide changes" : "Show changes"}
            </button>
            {!confirmingUndo ? (
              <button className="agent-action-btn" onClick={() => setConfirmingUndo(true)}>
                Undo
              </button>
            ) : (
              <button className="agent-action-btn agent-action-btn-danger" onClick={() => { setConfirmingUndo(false); onUndoEdit(); }}>
                Confirm undo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className={`agent-composer${pendingContext ? " with-context" : ""}`}>
        {/* Context block — inside composer as blockquote */}
        {pendingContext && (
          <div className="agent-context-block">
            <div className="agent-context-quote">
              <span className="agent-context-text">
                {truncate(pendingContext.text, 140)}
              </span>
            </div>
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
        {/* Mention picker — opens upward */}
        {isMentionOpen && totalMentionItems > 0 && (
          <CombinedMentionPicker
            agents={filteredMentionAgents}
            files={filteredMentionNodes}
            nodesById={nodesById}
            selectedIndex={mentionIndex}
            onSelectAgent={handleMentionSelectAgent}
            onSelectFile={handleMentionSelectFile}
            onHoverIndex={setMentionIndex}
          />
        )}

        {/* Mention chips */}
        {(mentionedFileIds?.length > 0 || mentionedAgentId) && (
          <div className="mention-chips">
            {mentionedAgentId && (() => {
              const agent = agents.find((a) => a.id === mentionedAgentId);
              return agent ? (
                <span className="mention-chip mention-chip-agent">
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" fill="currentColor" />
                  </svg>
                  <span className="mention-chip-title">{agent.name}</span>
                  <button
                    className="mention-chip-remove"
                    onClick={() => onMentionedAgentChange(null)}
                    aria-label="Remove agent"
                  >
                    <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                      <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ) : null;
            })()}
            {(mentionedFileIds || [])
              .map((id) => nodesById.get(String(id)))
              .filter(Boolean)
              .map((file) => (
                <span key={file.id} className="mention-chip">
                  <FileIcon />
                  <span className="mention-chip-title">{file.title}</span>
                  <button
                    className="mention-chip-remove"
                    onClick={() => handleMentionRemove(file.id)}
                    aria-label={`Remove ${file.title}`}
                  >
                    <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                      <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          placeholder={pendingContext ? "Ask about this selection\u2026" : "Ask anything, @ to mention files or agents\u2026"}
          value={currentInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="agent-composer-footer">
          <div className="agent-composer-footer-left">
            <span className="agent-composer-model">
              {mentionedAgentId
                ? agents.find((a) => a.id === mentionedAgentId)?.name || agentName
                : agentName}
            </span>
            <div className="memory-popover-wrapper" ref={memoryPopoverRef}>
              <button
                className={`memory-popover-trigger${isMemoryPopoverOpen ? " active" : ""}`}
                onClick={() => setIsMemoryPopoverOpen((prev) => !prev)}
                aria-label="Memories"
                title="Memories"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M8 1a5 5 0 0 1 5 5c0 1.8-1 3.3-2.4 4.2-.4.3-.6.7-.6 1.1V12H6v-.7c0-.4-.2-.8-.6-1.1A5 5 0 0 1 8 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M6 13h4M6.5 14.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {memoryCount > 0 && <span className="memory-popover-count">{memoryCount}</span>}
              </button>
              {isMemoryPopoverOpen && (
                <div className="memory-popover">
                  {projectMemories.length > 0 && (
                    <>
                      <div className="memory-popover-group-label">This project</div>
                      {projectMemories.map((mem) => (
                        <div key={mem.id} className="memory-popover-item">
                          <span className="memory-popover-item-text">{mem.content}</span>
                          <button
                            className="memory-popover-item-delete"
                            onClick={() => onDeleteMemory(mem.id)}
                            aria-label="Delete"
                          >
                            <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                              <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {userMemories.length > 0 && (
                    <>
                      <div className="memory-popover-group-label">All projects</div>
                      {userMemories.map((mem) => (
                        <div key={mem.id} className="memory-popover-item">
                          <span className="memory-popover-item-text">{mem.content}</span>
                          <button
                            className="memory-popover-item-delete"
                            onClick={() => onDeleteMemory(mem.id)}
                            aria-label="Delete"
                          >
                            <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                              <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {memoryCount === 0 && (
                    <div className="memory-popover-empty">No memories yet</div>
                  )}
                  <div className="memory-popover-add">
                    <input
                      className="memory-popover-add-input"
                      placeholder="Add a memory..."
                      value={newMemoryText}
                      onChange={(e) => setNewMemoryText(e.target.value)}
                      maxLength={200}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMemoryText.trim()) {
                          onCreateMemory(newMemoryText.trim(), newMemoryScope);
                          setNewMemoryText("");
                        }
                        if (e.key === "Escape") {
                          setIsMemoryPopoverOpen(false);
                        }
                      }}
                    />
                    <select
                      className="memory-popover-scope"
                      value={newMemoryScope}
                      onChange={(e) => setNewMemoryScope(e.target.value)}
                    >
                      <option value="project">Project</option>
                      <option value="user">Global</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
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
              disabled={!currentInput.trim() && !(mentionedFileIds?.length > 0)}
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

      </>}

      {/* Review tab content */}
      {activeTab === "review" && (
        <div className="agent-pane-body">
          <div className="review-sub-toggle">
            <button
              className={`review-sub-btn${reviewSubTab === "suggestions" ? " review-sub-btn--active" : ""}`}
              onClick={() => setReviewSubTab("suggestions")}
            >
              Suggestions
            </button>
            <button
              className={`review-sub-btn${reviewSubTab === "critique" ? " review-sub-btn--active" : ""}`}
              onClick={() => setReviewSubTab("critique")}
            >
              Critique
            </button>
          </div>
          {reviewSubTab === "suggestions" ? (
            <ReviewTab
              comments={reviewTabComments}
              pendingCount={reviewPendingCount}
              acceptedCount={reviewAcceptedCount}
              dismissedCount={reviewDismissedCount}
              focusedCommentId={focusedCommentId}
              aiThinkingId={aiThinkingId}
              getReplies={getReplies}
              onClickComment={onClickComment}
              onApprove={onApproveComment}
              onApproveReply={onApproveReplyComment}
              onDismiss={onDismissComment}
              onResolve={onResolveComment}
              onDelete={onDeleteComment}
              onReply={onReplyComment}
              onAskAI={onAskAIComment}
              onLaunchReview={onLaunchReview}
              isReviewing={isReviewing}
              agents={agents}
            />
          ) : (
            <CritiqueTab
              critiques={critiques}
              isCritiquing={isCritiquing}
              threadMessages={critiqueThreadMessages}
              discussingSection={discussingSection}
              onLaunchCritique={onLaunchCritique}
              onDiscussSection={onDiscussSection}
              onApplyMessage={onApplyCritiqueMessage}
              onSelectCritique={onSelectCritique}
              activeCritiqueId={activeCritiqueId}
              agents={agents}
            />
          )}
        </div>
      )}

      {/* Verify tab content */}
      {activeTab === "verify" && (
        <div className="agent-pane-body">
          <VerifyTab
            comments={verifyTabComments}
            pendingCount={verifyPendingCount}
            focusedCommentId={focusedCommentId}
            onClickComment={onClickComment}
            onAccept={onApproveComment}
            onDismiss={onDismissComment}
            onLaunchFactCheck={onLaunchFactCheck}
            isFactChecking={isFactChecking}
            factCheckProgress={factCheckProgress}
          />
        </div>
      )}
    </aside>
  );
}
