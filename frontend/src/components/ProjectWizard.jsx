import { useState, useRef, useEffect } from "react";
import { getAuthHeader } from "../api";
import { GhostTextarea } from "./GhostTextarea";

/* ── Shapes ── */

const PROJECT_SHAPES = [
  {
    id: 'document',
    name: 'Document',
    description: 'A single text, start to finish',
    examples: 'Essays, specs, memos, posts',
    hasStructure: false,
  },
  {
    id: 'project',
    name: 'Project',
    description: 'Multiple documents organized in a tree',
    examples: 'Books, documentation, courses',
    hasStructure: true,
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Collect, analyze, synthesize sources',
    examples: 'Papers, investigations, analysis',
    hasStructure: true,
  },
  {
    id: 'script',
    name: 'Script',
    description: 'Structured format with scenes and acts',
    examples: 'Screenplays, podcasts, videos',
    hasStructure: false,
  },
  {
    id: 'freeform',
    name: 'Freeform',
    description: 'Blank space, no predefined structure',
    examples: 'Brainstorms, notes, journals',
    hasStructure: false,
  },
];

const FALLBACK_STRUCTURES = {
  project: [
    { type: 'folder', title: 'Outline', children: [] },
    { type: 'folder', title: 'Draft', children: [
      { type: 'file', title: 'Introduction' },
      { type: 'file', title: 'Section 1' },
      { type: 'file', title: 'Section 2' },
    ]},
    { type: 'file', title: 'Notes' },
  ],
  research: [
    { type: 'file', title: 'Literature Review' },
    { type: 'file', title: 'Methodology' },
    { type: 'file', title: 'Analysis' },
    { type: 'file', title: 'Findings' },
    { type: 'file', title: 'References' },
  ],
};

/* ── Helpers ── */

let _nextId = 0;

function assignIds(items) {
  return items.map((item) => ({
    ...item,
    _id: _nextId++,
    enabled: true,
    children: item.children ? assignIds(item.children) : undefined,
  }));
}

function flattenItems(items, depth = 0) {
  const result = [];
  const walk = (list, d) => {
    list.forEach((item) => {
      result.push({ ...item, depth: d, flatIndex: result.length });
      if (item.children) walk(item.children, d + 1);
    });
  };
  walk(items, depth);
  return result;
}

function filterEnabled(items) {
  if (!items) return [];
  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      type: item.type,
      title: item.title,
      children: item.children ? filterEnabled(item.children) : undefined,
    }))
    .filter((item) => item.type === "file" || (item.children && item.children.length > 0));
}

function updateItem(items, id, updater) {
  return items.map((item) => {
    if (item._id === id) return updater(item);
    if (item.children) return { ...item, children: updateItem(item.children, id, updater) };
    return item;
  });
}

/* ── Icons ── */

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M1.5 3.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.5 4.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
        fill="none" stroke="currentColor" strokeWidth="1.2"
      />
    </svg>
  );
}

/* ── Structure Components ── */

function StructurePill({ item, onToggle, onRename, delay = 0 }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleRenameSubmit = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== item.title) onRename(item._id, val);
    setEditing(false);
  };

  return (
    <button
      className={`scaffold-pill${item.enabled ? "" : " disabled"}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => onToggle(item._id)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="scaffold-pill-rename"
          defaultValue={item.title}
          onClick={(e) => e.stopPropagation()}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setEditing(false);
            e.stopPropagation();
          }}
        />
      ) : (
        <span className="scaffold-pill-text">{item.title}</span>
      )}
    </button>
  );
}

function StructureCards({ structure, onToggle, onRename }) {
  if (!structure) return null;
  let delayCounter = 0;
  return (
    <div className="scaffold-cards">
      {structure.map((item) => {
        if (item.type === "folder") {
          const groupDelay = delayCounter * 60;
          delayCounter++;
          return (
            <div key={item._id} className="scaffold-group" style={{ animationDelay: `${groupDelay}ms` }}>
              <div className="scaffold-group-header">
                <FolderIcon />
                <span className="scaffold-group-title">{item.title}</span>
                <button
                  className={`scaffold-group-toggle${item.enabled ? "" : " off"}`}
                  onClick={() => onToggle(item._id)}
                  aria-label={item.enabled ? "Disable group" : "Enable group"}
                >
                  {item.enabled ? "On" : "Off"}
                </button>
              </div>
              {item.children && item.children.length > 0 && (
                <div className="scaffold-group-pills">
                  {item.children.map((child) => {
                    const d = delayCounter * 40;
                    delayCounter++;
                    return (
                      <StructurePill key={child._id} item={child} onToggle={onToggle} onRename={onRename} delay={d} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        const d = delayCounter * 40;
        delayCounter++;
        return <StructurePill key={item._id} item={item} onToggle={onToggle} onRename={onRename} delay={d} />;
      })}
    </div>
  );
}

// --- SSE stream reader helper ---

async function readSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      for (const data of dataLines) {
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.delta) fullContent += parsed.delta;
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          if (e.message && !e.message.startsWith("Unexpected") && e.message !== data) throw e;
        }
      }
    }
  }

  return fullContent;
}

// --- Main Component ---

/*
  Screens:
  "shape"     — Pick a project shape
  "context"   — Name + description
  "structure" — Structure generation/editing (only for hasStructure shapes)
*/

export function ProjectWizard({ onComplete, onCancel, defaultAgent, apiBase }) {
  const [screen, setScreen] = useState("shape");
  const [direction, setDirection] = useState("forward");

  // Data
  const [selectedShape, setSelectedShape] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [structure, setStructure] = useState(null);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const nameInputRef = useRef(null);

  const goForward = (s) => { setDirection("forward"); setScreen(s); };
  const goBackward = (s) => { setDirection("backward"); setScreen(s); };

  // --- Keyboard Navigation ---
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (screen === "shape") onCancel();
        else if (screen === "context") goBackward("shape");
        else if (screen === "structure") goBackward("context");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [screen, onCancel]);

  // Focus name input when reaching context screen
  useEffect(() => {
    if (screen === "context" && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 260);
    }
  }, [screen]);

  // --- Shape selection ---
  const handleShapeSelect = (shape) => {
    setSelectedShape(shape);
    setStructure(null);
    goForward("context");
  };

  // --- Context continue ---
  const handleContextContinue = () => {
    if (selectedShape?.hasStructure) {
      goForward("structure");
      generateStructure();
    } else {
      handleCreate();
    }
  };

  // --- AI Helper: Generate Structure ---
  const generateStructure = async () => {
    setIsGenerating(true);
    setStructure(null);
    try {
      const systemPrompt = `You are helping set up a writing project. Based on the project description, generate a project structure.

Output ONLY valid JSON with this exact format — no markdown fences, no explanation:
{
  "suggestedName": "A working title for the project",
  "structure": [
    { "type": "file", "title": "Document Name" },
    { "type": "folder", "title": "Folder Name", "children": [
      { "type": "file", "title": "Child Document" }
    ]}
  ]
}

Rules:
- Include 5-12 items total
- Use folders for logical groupings (acts, parts, sections, chapters)
- First item should be the main planning/outline document
- Suggest a creative, specific working title based on the description
- IMPORTANT: Only use specific names/topics the user explicitly mentioned. Never invent content.`;

      const userMessage = `Project shape: ${selectedShape.id} (${selectedShape.description})${projectName.trim() ? `\nTitle: ${projectName}` : ""}${description.trim() ? `\nDescription: ${description}` : ""}`;

      const response = await fetch(`${apiBase}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          provider: defaultAgent.provider,
          model: defaultAgent.model,
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok || !response.body) throw new Error("AI request failed");

      const fullContent = await readSSEStream(response);
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setStructure(assignIds(result.structure || []));
        if (result.suggestedName && !projectName.trim()) {
          setProjectName(result.suggestedName);
        }
      } else {
        throw new Error("Could not parse structure");
      }
    } catch {
      setStructure(assignIds(FALLBACK_STRUCTURES[selectedShape?.id] || []));
    }
    setIsGenerating(false);
  };

  const handleToggle = (id) => {
    setStructure((prev) =>
      updateItem(prev, id, (item) => ({ ...item, enabled: !item.enabled }))
    );
  };

  const handleRename = (id, newTitle) => {
    setStructure((prev) =>
      updateItem(prev, id, (item) => ({ ...item, title: newTitle }))
    );
  };

  // --- Create project ---
  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setShowSuccess(true);

    const enabledStructure = structure ? filterEnabled(structure) : [];
    const flatItems = structure ? flattenItems(structure) : [];

    await new Promise((r) => setTimeout(r, 600)); // success animation
    await onComplete({
      name: projectName.trim() || "Untitled",
      type: selectedShape?.id || "freeform",
      extension: null,
      structure: enabledStructure,
      description,
      structureSummary: flatItems.map((i) => i.title).join(", "),
    });
    setIsCreating(false);
  };

  // --- Back Navigation ---
  const handleBack = () => {
    if (screen === "context") goBackward("shape");
    else if (screen === "structure") goBackward("context");
  };

  const screenClass = `wizard-screen ${direction === "backward" ? "slide-down" : "slide-up"}`;

  return (
    <div className="wizard">
      <div className="wizard-close-wrapper">
        <button className="wizard-close-btn" onClick={onCancel} aria-label="Cancel">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="wizard-body">

        {/* Screen: Shape selection */}
        {screen === "shape" && (
          <div className={screenClass} key="shape">
            <h1 className="wizard-heading">What are you creating?</h1>
            <p className="wizard-subheading">Pick a shape and we'll set up the right structure.</p>
            <div className="wt-shapes">
              {PROJECT_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  className={`wt-shape-card ${selectedShape?.id === shape.id ? 'wt-shape-selected' : ''}`}
                  onClick={() => handleShapeSelect(shape)}
                >
                  <span className="wt-shape-name">{shape.name}</span>
                  <span className="wt-shape-desc">{shape.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Screen: Context (name + description) */}
        {screen === "context" && (
          <div className={screenClass} key="context">
            {showSuccess ? (
              <div className="wizard-success">
                <div className="wizard-success-circle">
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path d="M5 12l5 5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="wizard-success-text">Creating project...</p>
              </div>
            ) : (
              <>
                <button className="wizard-back" onClick={handleBack}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {" "}Back
                </button>
                <h1 className="wizard-heading">Give it a name and some direction.</h1>
                <input
                  ref={nameInputRef}
                  className="wizard-name-input"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContextContinue();
                  }}
                />
                <GhostTextarea
                  value={description}
                  onChange={setDescription}
                  context="project_description"
                  className="wizard-textarea"
                  placeholder="Describe what this is about — the AI will use this to help you."
                  rows={3}
                  style={{ minHeight: "auto" }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      handleContextContinue();
                    }
                  }}
                />
                <div className="wizard-actions">
                  <button
                    className="primary"
                    onClick={handleContextContinue}
                    disabled={isCreating}
                  >
                    {selectedShape?.hasStructure ? "Continue" : "Create project"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Screen: Structure (only for hasStructure shapes) */}
        {screen === "structure" && (
          <div className={screenClass} key="structure">
            {showSuccess ? (
              <div className="wizard-success">
                <div className="wizard-success-circle">
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path d="M5 12l5 5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="wizard-success-text">Creating project...</p>
              </div>
            ) : (
              <>
                <button className="wizard-back" onClick={handleBack}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {" "}Back
                </button>
                <h1 className="wizard-heading">We'll set up the scaffolding.</h1>
                <p className="wizard-subheading">
                  Your assistant sees the whole project — the brief, the outline,
                  sibling documents. That's what makes it useful.
                </p>
                {isGenerating ? (
                  <div className="wizard-evaluating">
                    <div className="wizard-skeleton">
                      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className="wizard-skeleton-item" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <StructureCards
                      structure={structure}
                      onToggle={handleToggle}
                      onRename={handleRename}
                    />
                    <div className="wizard-actions" style={{ gap: "12px" }}>
                      <button
                        className="wizard-back"
                        onClick={generateStructure}
                        style={{ position: "static" }}
                      >
                        Regenerate
                      </button>
                      <button
                        className="primary"
                        onClick={handleCreate}
                        disabled={isCreating}
                      >
                        Create project
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
