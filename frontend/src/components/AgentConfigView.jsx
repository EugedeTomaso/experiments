import { useState, useEffect } from "react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
];

export function AgentConfigView({ agent, onSave, onDelete }) {
  const [name, setName] = useState(agent.name || "");
  const [config, setConfig] = useState({
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    system_prompt: "",
    ...agent.config,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(agent.name || "");
    setConfig({
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      system_prompt: "",
      ...agent.config,
    });
  }, [agent.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ name, config });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="agent-config-view">
      <header className="main-header">
        <div>
          <div className="eyebrow">Assistant</div>
          <h1>{agent.name || "New Assistant"}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={onDelete}>
            Delete
          </button>
          <button className="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving" : "Save"}
          </button>
        </div>
      </header>

      <div className="agent-form">
        <div className="agent-form-section">
          <div className="agent-form-section-label">Identity</div>
          <label className="form-label">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assistant name"
            />
          </label>
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-label">Voice</div>
          <label className="form-label">
            System prompt
            <textarea
              value={config.system_prompt}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))
              }
              placeholder="Instructions for the assistant..."
              rows={8}
            />
          </label>
        </div>

        <div className="agent-form-section">
          <div className="agent-form-section-label">Engine</div>
          <div className="agent-engine-grid">
            <label className="form-label">
              Provider
              <select
                value={config.provider}
                onChange={(e) => setConfig((prev) => ({ ...prev, provider: e.target.value }))}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Model
              <input
                value={config.model}
                onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </label>
            <label className="form-label">
              Temperature
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                }
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
