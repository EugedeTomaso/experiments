import { useState, useRef } from "react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
];

const GENERATION_PROMPT = `You are helping a user create a writing assistant for a markdown editor called Marvin. Based on their description, generate a JSON object with these fields:

- "name": A short, memorable name for the assistant (1-3 words)
- "system_prompt": A detailed system prompt that captures the described personality, writing style, and behavior. Write it as direct instructions to the AI. Be specific and actionable.
- "provider": One of "openai", "anthropic", "openrouter", "deepseek", "cerebras", "groq" — pick the best fit for the described use case, defaulting to "openai"
- "model": The best model for this assistant's purpose. Use "gpt-4o-mini" for general tasks, "gpt-4o" for complex writing, or suggest an appropriate model for the chosen provider.
- "temperature": A number between 0 and 2. Lower (0.2-0.5) for precise/editorial tasks, medium (0.6-0.8) for balanced writing, higher (0.9-1.2) for creative tasks.

Respond with ONLY the JSON object, no markdown fencing, no explanation.`;

export function AgentCreatorSlideOver({
  isOpen,
  onClose,
  onCreate,
  apiBase,
}) {
  const [step, setStep] = useState("describe"); // describe | generating | review
  const [description, setDescription] = useState("");
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const abortRef = useRef(null);

  const reset = () => {
    setStep("describe");
    setDescription("");
    setGenerated(null);
    setError("");
    setIsCreating(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setStep("generating");
    setError("");

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${apiBase}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            { role: "system", content: GENERATION_PROMPT },
            { role: "user", content: description },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Generation failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullOutput = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const lines = event.split("\n");
          const dataLines = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (!dataLines.length) continue;
          const data = dataLines.join("\n");
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) fullOutput += parsed.delta;
          } catch (_) {}
        }
      }

      // Parse the generated JSON
      const cleaned = fullOutput.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const config = JSON.parse(cleaned);

      setGenerated({
        name: config.name || "New Assistant",
        provider: config.provider || "openai",
        model: config.model || "gpt-4o-mini",
        temperature: config.temperature ?? 0.7,
        system_prompt: config.system_prompt || "",
      });
      setStep("review");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to generate assistant configuration.");
      setStep("describe");
    } finally {
      abortRef.current = null;
    }
  };

  const handleCreate = async () => {
    if (!generated) return;
    setIsCreating(true);
    try {
      const { name, ...config } = generated;
      await onCreate({ name, config });
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to create assistant.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipToManual = () => {
    setGenerated({
      name: "",
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      system_prompt: "",
    });
    setStep("review");
  };

  const updateField = (field, value) => {
    setGenerated((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {isOpen && <div className="slide-over-backdrop" onClick={handleClose} />}
      <div className={`slide-over agent-creator-slide-over ${isOpen ? "slide-over-open" : ""}`}>
        <div className="slide-over-header">
          <h2>New Assistant</h2>
          <button className="ghost" onClick={handleClose}>Close</button>
        </div>

        <div className="slide-over-body">
          {step === "describe" && (
            <div className="creator-step">
              <div className="creator-intro">
                <p className="creator-heading">Describe the assistant you need</p>
                <p className="creator-hint">
                  What should it do? What tone or style? What kind of writing?
                </p>
              </div>
              <textarea
                className="creator-textarea"
                placeholder="A strict editor that tightens prose, removes adverbs, and favors short sentences. Hemingway-like."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              {error && <div className="creator-error">{error}</div>}
              <div className="creator-actions">
                <button
                  className="primary"
                  onClick={handleGenerate}
                  disabled={!description.trim()}
                >
                  Generate
                </button>
                <button className="ghost" onClick={handleSkipToManual}>
                  Configure manually
                </button>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="creator-step creator-generating">
              <div className="creator-spinner" />
              <p className="creator-generating-text">Crafting your assistant...</p>
              <p className="creator-generating-hint">
                Generating name, personality, and configuration
              </p>
            </div>
          )}

          {step === "review" && generated && (
            <div className="creator-step">
              <div className="creator-intro">
                <p className="creator-heading">Review & customize</p>
                <p className="creator-hint">
                  Adjust anything before creating the assistant.
                </p>
              </div>

              <div className="creator-section">
                <div className="creator-section-label">Identity</div>
                <label className="form-label">
                  Name
                  <input
                    value={generated.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Assistant name"
                  />
                </label>
              </div>

              <div className="creator-section">
                <div className="creator-section-label">Voice</div>
                <label className="form-label">
                  System prompt
                  <textarea
                    value={generated.system_prompt}
                    onChange={(e) => updateField("system_prompt", e.target.value)}
                    placeholder="Instructions for the assistant..."
                    rows={8}
                  />
                </label>
              </div>

              <div className="creator-section">
                <div className="creator-section-label">Engine</div>
                <div className="creator-engine-grid">
                  <label className="form-label">
                    Provider
                    <select
                      value={generated.provider}
                      onChange={(e) => updateField("provider", e.target.value)}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-label">
                    Model
                    <input
                      value={generated.model}
                      onChange={(e) => updateField("model", e.target.value)}
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
                      value={generated.temperature}
                      onChange={(e) => updateField("temperature", Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>

              {error && <div className="creator-error">{error}</div>}

              <div className="creator-actions">
                <button
                  className="primary"
                  onClick={handleCreate}
                  disabled={isCreating || !generated.name?.trim()}
                >
                  {isCreating ? "Creating..." : "Create assistant"}
                </button>
                <button className="ghost" onClick={() => { setStep("describe"); setError(""); }}>
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
