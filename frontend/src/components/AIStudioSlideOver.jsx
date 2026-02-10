export function AIStudioSlideOver({
  isOpen,
  onClose,
  prompt,
  onPromptChange,
  output,
  isStreaming,
  onGenerate,
}) {
  return (
    <>
      {isOpen && <div className="slide-over-backdrop" onClick={onClose} />}
      <div className={`slide-over ${isOpen ? "slide-over-open" : ""}`}>
        <div className="slide-over-header">
          <h2>AI Studio</h2>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="slide-over-body">
          <textarea
            placeholder="Ask the assistant\u2026"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
          <button
            className="primary"
            onClick={onGenerate}
            disabled={isStreaming || !prompt.trim()}
          >
            {isStreaming ? "Generating" : "Generate"}
          </button>
          <div className="assistant-output">
            {output || "The response will appear here."}
          </div>
        </div>
      </div>
    </>
  );
}
