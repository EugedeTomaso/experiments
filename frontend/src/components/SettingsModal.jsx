import { useState } from "react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
];

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "providers", label: "Provider Keys" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI Defaults" },
  { id: "memory", label: "Memory" },
];

export function SettingsModal({
  isOpen,
  onClose,
  providerKeyMap,
  onSaveProviderKey,
  onClearProviderKey,
  autosaveDelay,
  onAutosaveDelayChange,
  defaultAgent,
  onDefaultAgentChange,
  memories,
  onCreateMemory,
  onDeleteMemory,
  onUpdateMemory,
  collabSession,
  theme,
  onThemeChange,
  aiIntensity,
  onAiIntensityChange,
}) {
  const [activeSection, setActiveSection] = useState("appearance");
  const [keyForm, setKeyForm] = useState({ provider: "openai", api_key: "" });
  const [keyMessage, setKeyMessage] = useState("");
  const [newMemoryText, setNewMemoryText] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");

  if (!isOpen) return null;

  const handleSaveKey = async () => {
    if (!keyForm.api_key.trim()) {
      setKeyMessage("Enter a key before saving.");
      return;
    }
    try {
      await onSaveProviderKey(keyForm.provider, keyForm.api_key.trim());
      setKeyForm((prev) => ({ ...prev, api_key: "" }));
      setKeyMessage("Key saved.");
    } catch {
      setKeyMessage("Failed to save key.");
    }
  };

  const handleClearKey = async () => {
    try {
      await onClearProviderKey(keyForm.provider);
      setKeyMessage("Key cleared.");
    } catch {
      setKeyMessage("No key to clear.");
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          <div className="settings-nav-header">Settings</div>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`settings-nav-item ${activeSection === section.id ? "active" : ""}`}
              onClick={() => {
                setActiveSection(section.id);
                setKeyMessage("");
              }}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-content-header">
            <h2>{SECTIONS.find((s) => s.id === activeSection)?.label}</h2>
            <button className="settings-close" onClick={onClose} aria-label="Close settings">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {activeSection === "appearance" && (
            <div className="settings-section">
              <p className="settings-description">
                Choose your writing environment.
              </p>

              <div className="settings-field">
                <label className="settings-label">Theme</label>
                <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="settings-field" style={{ marginTop: 16 }}>
                <label className="settings-label">AI Presence</label>
                <select value={aiIntensity} onChange={(e) => onAiIntensityChange(e.target.value)}>
                  <option value="silent">Silent — only when asked</option>
                  <option value="active">Active — subtle suggestions</option>
                  <option value="coauthor">Co-author — maximum collaboration</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === "providers" && (
            <div className="settings-section">
              <p className="settings-description">
                Add API keys for the AI providers you want to use. Keys are stored on your server and never sent to the browser.
              </p>

              <div className="settings-field">
                <label className="settings-label">Provider</label>
                <select
                  value={keyForm.provider}
                  onChange={(e) => setKeyForm((prev) => ({ ...prev, provider: e.target.value }))}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label className="settings-label">API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={keyForm.api_key}
                  onChange={(e) => setKeyForm((prev) => ({ ...prev, api_key: e.target.value }))}
                />
              </div>

              <div className="settings-field-actions">
                <button className="primary" onClick={handleSaveKey}>Save key</button>
                <button className="ghost" onClick={handleClearKey}>Clear key</button>
              </div>

              {keyMessage && <div className="helper">{keyMessage}</div>}

              <div className="settings-divider" />

              <div className="settings-provider-list">
                {PROVIDERS.map((p) => {
                  const hasKey = providerKeyMap.get(p.value)?.has_key;
                  return (
                    <div className="settings-provider-row" key={p.value}>
                      <span className="settings-provider-name">{p.label}</span>
                      <span className={`status ${hasKey ? "ok" : ""}`}>
                        {hasKey ? "Configured" : "Missing"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === "editor" && (
            <div className="settings-section">
              <p className="settings-description">
                Configure how the editor behaves while you write.
              </p>

              <div className="settings-field">
                <label className="settings-label">
                  Autosave delay
                  <span className="settings-label-value">{(autosaveDelay / 1000).toFixed(1)}s</span>
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={autosaveDelay}
                  onChange={(e) => onAutosaveDelayChange(Number(e.target.value))}
                />
                <div className="settings-range-labels">
                  <span>0.5s</span>
                  <span>5s</span>
                </div>
              </div>

              {collabSession && (
                <>
                  <div className="settings-divider" />
                  <div className="settings-field">
                    <label className="settings-label settings-toggle-label">
                      <input
                        type="checkbox"
                        checked={localStorage.getItem("mive:ai-visible") === "true"}
                        onChange={(e) => {
                          localStorage.setItem("mive:ai-visible", e.target.checked);
                          collabSession.setAiVisible(e.target.checked);
                        }}
                      />
                      Share AI suggestions with collaborators
                    </label>
                    <p className="settings-description" style={{ marginTop: 4 }}>
                      When enabled, AI-generated edits are visible to everyone in the session.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === "ai" && (
            <div className="settings-section">
              <p className="settings-description">
                Default AI configuration for new conversations. Individual nodes can override these through agent assignments.
              </p>

              <div className="settings-field">
                <label className="settings-label">Provider</label>
                <select
                  value={defaultAgent.provider}
                  onChange={(e) => onDefaultAgentChange({ ...defaultAgent, provider: e.target.value })}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label className="settings-label">Model</label>
                <input
                  type="text"
                  value={defaultAgent.model}
                  onChange={(e) => onDefaultAgentChange({ ...defaultAgent, model: e.target.value })}
                  placeholder="e.g. deepseek-chat"
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">
                  Temperature
                  <span className="settings-label-value">{defaultAgent.temperature}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={defaultAgent.temperature}
                  onChange={(e) => onDefaultAgentChange({ ...defaultAgent, temperature: Number(e.target.value) })}
                />
                <div className="settings-range-labels">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === "memory" && (
            <div className="settings-section">
              <p className="settings-description">
                Global preferences the AI remembers across all projects. Project-specific memories can be managed from each project's overview.
              </p>

              <div className="memory-add-form">
                <input
                  type="text"
                  placeholder="e.g., Never use cliches. Prefer active voice."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMemoryText.trim()) {
                      onCreateMemory(newMemoryText.trim(), "user");
                      setNewMemoryText("");
                    }
                  }}
                />
                <button
                  className="primary"
                  onClick={() => {
                    if (!newMemoryText.trim()) return;
                    onCreateMemory(newMemoryText.trim(), "user");
                    setNewMemoryText("");
                  }}
                  disabled={!newMemoryText.trim()}
                >
                  Add
                </button>
              </div>

              <div className="settings-memory-list">
                {(memories || [])
                  .filter((m) => m.scope === "user")
                  .map((mem) => (
                    <div key={mem.id} className="settings-memory-item">
                      {editingMemoryId === mem.id ? (
                        <input
                          className="settings-memory-edit-input"
                          value={editingMemoryText}
                          onChange={(e) => setEditingMemoryText(e.target.value)}
                          maxLength={200}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onUpdateMemory(mem.id, { content: editingMemoryText });
                              setEditingMemoryId(null);
                            }
                            if (e.key === "Escape") setEditingMemoryId(null);
                          }}
                          onBlur={() => {
                            if (editingMemoryText.trim() && editingMemoryText !== mem.content) {
                              onUpdateMemory(mem.id, { content: editingMemoryText });
                            }
                            setEditingMemoryId(null);
                          }}
                        />
                      ) : (
                        <span
                          className="settings-memory-text"
                          onClick={() => {
                            setEditingMemoryId(mem.id);
                            setEditingMemoryText(mem.content);
                          }}
                        >
                          {mem.content}
                        </span>
                      )}
                      {mem.source === "ai_suggested" && (
                        <span className="settings-memory-source">AI</span>
                      )}
                      <button
                        className="settings-memory-delete"
                        onClick={() => onDeleteMemory(mem.id)}
                        aria-label="Delete"
                      >
                        <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                          <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                {(memories || []).filter((m) => m.scope === "user").length === 0 && (
                  <div className="settings-memory-empty">
                    No global memories yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
