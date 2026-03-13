import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

export default function InlinePrompt({ position, selectedText, agents, defaultAgent, onAccept, onClose, streamAI }) {
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content }
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null); // null = use defaultAgent
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const agentDropdownRef = useRef(null);

  const activeAgent = selectedAgent || defaultAgent;
  const activeAgentName = selectedAgent
    ? agents.find(a => a.id === selectedAgent.id)?.name || selectedAgent.name
    : 'Default';

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Escape to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isAgentOpen) {
          setIsAgentOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose, isAgentOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close agent dropdown when clicking outside it
  useEffect(() => {
    if (!isAgentOpen) return;
    const handleClick = (e) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target)) {
        setIsAgentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAgentOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(async () => {
    const instruction = input.trim();
    if (!instruction || isStreaming) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: instruction }]);
    setIsStreaming(true);

    // Build conversation context for the AI
    const systemMsg = selectedText
      ? 'You are a precise writing assistant. The user has selected text and wants you to modify it. Return ONLY the modified text, nothing else. No markdown fences, no explanation, no labels.'
      : 'You are a precise writing assistant. Return ONLY the requested text, nothing else. No markdown fences, no explanation, no labels.';

    const conversationMessages = [];

    // Include selected text context in first user message
    const allMsgs = [...messages, { role: 'user', content: instruction }];
    for (let i = 0; i < allMsgs.length; i++) {
      const msg = allMsgs[i];
      if (msg.role === 'user' && i === 0 && selectedText) {
        conversationMessages.push({
          role: 'user',
          content: `Apply this instruction to the selected text. Return ONLY the modified text, nothing else.\n\nInstruction: ${msg.content}\n\nSelected text:\n${selectedText}`,
        });
      } else if (msg.role === 'user' && i > 0 && selectedText) {
        // Follow-up: reference previous AI output
        const lastAI = allMsgs.slice(0, i).reverse().find(m => m.role === 'assistant');
        conversationMessages.push({
          role: 'user',
          content: `Apply this instruction to the text. Return ONLY the modified text, nothing else.\n\nInstruction: ${msg.content}\n\nText:\n${lastAI?.content || selectedText}`,
        });
      } else {
        conversationMessages.push(msg);
      }
    }

    // Add placeholder for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamAI(systemMsg, conversationMessages, (delta) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + delta };
          }
          return updated;
        });
      }, activeAgent);
    } catch (err) {
      console.error('Inline AI failed:', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: 'Failed to get response.' };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, isStreaming, messages, selectedText, streamAI, activeAgent]);

  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.content);

  return (
    <div
      ref={containerRef}
      className="inline-prompt"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
      }}
    >
      {/* Selected text context */}
      {selectedText && (
        <div className="inline-prompt-context">
          <span className="inline-prompt-context-label">Selection</span>
          <span className="inline-prompt-context-text">
            {selectedText.length > 120 ? selectedText.slice(0, 120) + '...' : selectedText}
          </span>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="inline-prompt-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`inline-prompt-msg inline-prompt-msg-${msg.role}`}>
              {msg.role === 'assistant' && !msg.content && isStreaming ? (
                <span className="inline-prompt-typing">
                  <span></span><span></span><span></span>
                </span>
              ) : msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input row */}
      <div className="inline-prompt-input-row">
        <div className="inline-prompt-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={messages.length === 0 ? 'Ask AI anything...' : 'Follow up...'}
          disabled={isStreaming}
        />
      </div>

      {/* Footer: agent picker + actions */}
      <div className="inline-prompt-footer">
        <div className="inline-prompt-agent-picker" ref={agentDropdownRef}>
          <button
            className="inline-prompt-agent-btn"
            onClick={() => setIsAgentOpen(prev => !prev)}
            disabled={isStreaming}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" />
            </svg>
            <span>{activeAgentName}</span>
            <svg width="8" height="8" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isAgentOpen && (
            <div className="inline-prompt-agent-dropdown">
              <button
                className={`inline-prompt-agent-option${!selectedAgent ? ' active' : ''}`}
                onClick={() => { setSelectedAgent(null); setIsAgentOpen(false); }}
              >
                Default
                {!selectedAgent && (
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {agents.map(a => {
                const isActive = selectedAgent?.id === a.id;
                return (
                  <button
                    key={a.id}
                    className={`inline-prompt-agent-option${isActive ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedAgent({ id: a.id, name: a.name, provider: a.config?.provider, model: a.config?.model });
                      setIsAgentOpen(false);
                    }}
                  >
                    <span className="inline-prompt-agent-option-info">
                      <span>{a.name}</span>
                      {a.config?.model && <span className="inline-prompt-agent-option-model">{a.config.model}</span>}
                    </span>
                    {isActive && (
                      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Accept/Dismiss after AI response */}
        {lastAssistantMessage && !isStreaming && (
          <div className="inline-prompt-actions">
            <button
              className="inline-prompt-btn inline-prompt-btn-dismiss"
              onClick={onClose}
            >
              Dismiss
            </button>
            <button
              className="inline-prompt-btn inline-prompt-btn-accept"
              onClick={() => onAccept(lastAssistantMessage.content)}
            >
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
