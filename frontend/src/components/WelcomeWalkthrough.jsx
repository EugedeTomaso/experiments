import { useState, useRef, useEffect } from "react";
import { getAuthHeader } from "../api";
import AdaptiveShapes from "./svg/AdaptiveShapes";

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

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Structure Item ── */

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

/* ── Main Component ── */

/*
  Steps:
  0 — Welcome (hero + CTA)
  1 — Shape selection ("What are you working on?")
  2 — Context (name + description)
  3 — Structure (only for shapes with hasStructure)
*/

export function WelcomeWalkthrough({ onComplete, onSkip, defaultAgent, apiBase }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [selectedShape, setSelectedShape] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [structure, setStructure] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const nameInputRef = useRef(null);

  const goForward = (s) => { setDirection("forward"); setStep(s); };
  const goBackward = (s) => { setDirection("backward"); setStep(s); };

  // Dot navigation: steps 1-3 (or 1-2 for non-structure shapes)
  const totalDots = selectedShape?.hasStructure ? 3 : 2;
  const currentDotIndex = step - 1;

  useEffect(() => {
    if (step === 2 && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 260);
    }
  }, [step]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (step === 0) onSkip();
        else if (step === 1) goBackward(0);
        else if (step === 2) goBackward(1);
        else if (step === 3) goBackward(2);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [step, onSkip]);

  const handleShapeSelect = (shape) => {
    setSelectedShape(shape);
    setStructure(null);
    goForward(2);
  };

  const handleContextContinue = () => {
    if (selectedShape?.hasStructure) {
      goForward(3);
      if (!structure) generateStructure();
    } else {
      handleComplete();
    }
  };

  const generateStructure = async () => {
    setIsGenerating(true);
    setStructure(null);
    try {
      const response = await fetch(`${apiBase}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          provider: defaultAgent.provider,
          model: defaultAgent.model,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: `You are helping set up a writing project. Generate a project structure.

Output ONLY valid JSON — no markdown fences, no explanation:
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
- 5-12 items total
- Use folders for logical groupings (acts, parts, chapters, sections)
- First item should be the main planning/outline document
- Suggest a creative working title if one isn't given
- Only use names the user explicitly mentioned — never invent specific content`,
            },
            {
              role: "user",
              content: `Project shape: ${selectedShape.id} (${selectedShape.description})${projectName.trim() ? `\nTitle: ${projectName}` : ""}${description.trim() ? `\nDescription: ${description}` : ""}`,
            },
          ],
        }),
      });

      if (!response.ok || !response.body) throw new Error("fail");

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
            } catch {}
          }
        }
      }

      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setStructure(assignIds(result.structure || []));
        if (result.suggestedName && !projectName.trim()) {
          setProjectName(result.suggestedName);
        }
      } else {
        throw new Error("parse");
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

  const handleComplete = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const enabledStructure = structure ? filterEnabled(structure) : [];
      const flatItems = structure ? flattenItems(structure) : [];
      await onComplete({
        name: projectName.trim() || "Untitled",
        type: selectedShape?.id || "freeform",
        extension: null,
        structure: enabledStructure,
        description,
        structureSummary: flatItems.map((i) => i.title).join(", "),
      });
    } catch {
      setIsCreating(false);
    }
  };

  const stepClass = `welcome-page ${direction === "backward" ? "backward" : ""}`;

  return (
    <div className="welcome">
      <button className="welcome-skip" onClick={onSkip}>
        Skip
      </button>

      <div className="welcome-body">
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className={stepClass} key="welcome">
            <div className="wt-welcome">
              <AdaptiveShapes />
              <h1 className="wt-welcome-heading">
                Mive shapes itself around what you're making.
              </h1>
              <p className="wt-welcome-sub">
                Describe your project and it builds the structure. You change anything, anytime.
              </p>
              <button className="wt-welcome-cta" onClick={() => goForward(1)}>
                Start a project
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Shape selection ── */}
        {step === 1 && (
          <div className={stepClass} key="shape">
            <h2 className="wt-step-heading">What are you working on?</h2>
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

        {/* ── Step 2: Context (name + description) ── */}
        {step === 2 && (
          <div className={stepClass} key="context">
            <h2 className="wt-step-heading">Give it a name and some direction.</h2>
            <input
              ref={nameInputRef}
              className="wt-input"
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleContextContinue();
              }}
            />
            <textarea
              className="wt-textarea"
              placeholder="Describe what this is about — the AI will use this to help you."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <button
              className="welcome-cta wt-pulse"
              onClick={handleContextContinue}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Continue"}
            </button>
          </div>
        )}

        {/* ── Step 3: Structure (only for hasStructure shapes) ── */}
        {step === 3 && selectedShape?.hasStructure && (
          <div className={stepClass} key="structure">
            <h1 className="welcome-heading">
              We'll set up the scaffolding.
            </h1>
            <p className="welcome-text">
              Your assistant sees the whole project — the brief, the outline,
              sibling documents. That's what makes it useful.
            </p>
            {isGenerating ? (
              <div className="welcome-structure-skeleton">
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
                <div className="welcome-actions">
                  <button
                    className="welcome-ghost-btn"
                    onClick={generateStructure}
                  >
                    Regenerate
                  </button>
                  <button
                    className={`welcome-cta ${!isCreating ? "wt-pulse" : ""}`}
                    onClick={handleComplete}
                    disabled={isCreating}
                  >
                    {isCreating ? "Creating..." : "Create project"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom navigation (from step 1+) ── */}
      {step > 0 && (
        <div className="welcome-nav">
          <div className="welcome-nav-side">
            <button
              className="welcome-nav-btn"
              onClick={() => goBackward(step - 1)}
              aria-label="Previous"
            >
              <ChevronLeft />
            </button>
          </div>
          <div className="welcome-nav-dots">
            {Array.from({ length: totalDots }, (_, i) => (
              <div
                key={i}
                className={`welcome-nav-dot${
                  i === currentDotIndex ? " active" : i < currentDotIndex ? " completed" : ""
                }`}
              />
            ))}
          </div>
          <div className="welcome-nav-side" />
        </div>
      )}
    </div>
  );
}
