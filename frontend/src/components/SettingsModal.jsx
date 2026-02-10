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
  { id: "providers", label: "Provider Keys" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI Defaults" },
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
}) {
  const [activeSection, setActiveSection] = useState("providers");
  const [keyForm, setKeyForm] = useState({ provider: "openai", api_key: "" });
  const [keyMessage, setKeyMessage] = useState("");

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
        </div>
      </div>
    </div>
  );
}
