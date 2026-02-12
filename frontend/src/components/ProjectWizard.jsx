import { useState, useRef, useEffect, useCallback } from "react";

const PROJECT_TYPES = [
  { id: "novel", label: "Novel", desc: "Long-form fiction with chapters, characters, and narrative arcs" },
  { id: "short-story", label: "Short Story", desc: "Single narrative, shorter form fiction" },
  { id: "screenplay", label: "Screenplay", desc: "Film script with acts, scenes, and dialogue" },
  { id: "tv-series", label: "TV Series", desc: "Show bible, episode outlines, and season arcs" },
  { id: "youtube", label: "YouTube / Video", desc: "Video scripts, hooks, and production notes" },
  { id: "article", label: "Article / Essay", desc: "Editorial content, blog posts, or long-form essays" },
  { id: "product", label: "Product / Work", desc: "Briefs, research, specs, and roadmaps" },
  { id: "freeform", label: "Freeform", desc: "Empty project — build your own structure" },
];

const DESCRIPTION_PROMPTS = {
  novel: "What's the story? Characters, setting, themes, genre...",
  "short-story": "What's the premise? Setting, characters, the central moment...",
  screenplay: "What's the logline? Genre, tone, setting...",
  "tv-series": "What's the show about? Format, genre, central premise...",
  youtube: "What's the video about? Topic, angle, target audience...",
  article: "What's the topic? Angle, thesis, target reader...",
  product: "What problem does it solve? Who's it for? What's the scope?",
};

const FALLBACK_STRUCTURES = {
  novel: {
    suggestedName: "Untitled Novel",
    structure: [
      { type: "file", title: "Outline" },
      { type: "file", title: "Characters" },
      { type: "file", title: "World Building" },
      { type: "folder", title: "Part I", children: [
        { type: "file", title: "Chapter 1" },
        { type: "file", title: "Chapter 2" },
        { type: "file", title: "Chapter 3" },
      ]},
      { type: "folder", title: "Part II", children: [
        { type: "file", title: "Chapter 4" },
        { type: "file", title: "Chapter 5" },
      ]},
    ],
  },
  "short-story": {
    suggestedName: "Untitled Story",
    structure: [
      { type: "file", title: "Notes" },
      { type: "file", title: "Draft" },
    ],
  },
  screenplay: {
    suggestedName: "Untitled Screenplay",
    structure: [
      { type: "file", title: "Logline & Synopsis" },
      { type: "file", title: "Treatment" },
      { type: "file", title: "Characters" },
      { type: "folder", title: "Script", children: [
        { type: "file", title: "Act I" },
        { type: "file", title: "Act II" },
        { type: "file", title: "Act III" },
      ]},
    ],
  },
  "tv-series": {
    suggestedName: "Untitled Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters" },
      { type: "file", title: "Season Arc" },
      { type: "folder", title: "Season 1", children: [
        { type: "file", title: "Pilot Outline" },
        { type: "file", title: "Episode 2" },
        { type: "file", title: "Episode 3" },
      ]},
    ],
  },
  youtube: {
    suggestedName: "Untitled Video",
    structure: [
      { type: "file", title: "Hook & Outline" },
      { type: "file", title: "Script" },
      { type: "file", title: "Production Notes" },
    ],
  },
  article: {
    suggestedName: "Untitled Article",
    structure: [
      { type: "file", title: "Research Notes" },
      { type: "file", title: "Outline" },
      { type: "file", title: "Draft" },
    ],
  },
  product: {
    suggestedName: "Untitled Project",
    structure: [
      { type: "file", title: "Brief" },
      { type: "file", title: "Research" },
      { type: "file", title: "Roadmap" },
      { type: "file", title: "Specs" },
    ],
  },
  freeform: {
    suggestedName: "",
    structure: [],
  },
};

// --- Helpers ---

let _nextId = 0;

function assignIds(items) {
  return items.map((item) => ({
    ...item,
    _id: _nextId++,
    enabled: item.enabled !== false,
    children: item.children ? assignIds(item.children) : undefined,
  }));
}

function updateItem(items, id, updater) {
  return items.map((item) => {
    if (item._id === id) return updater(item);
    if (item.children) return { ...item, children: updateItem(item.children, id, updater) };
    return item;
  });
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

// --- Icons ---

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

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4.5 1.5h4.586a1 1 0 0 1 .707.293l2.914 2.914a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        fill="none" stroke="currentColor" strokeWidth="1.2"
      />
      <path d="M9 1.5v3a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <path
        d="M2.5 6L5 8.5L9.5 3.5"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M10 3L5 8l5 5"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.27-3.5M13.5 2v3h-3"
        fill="none" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Structure Item ---

function StructureItem({ item, onToggle, onRename }) {
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
    if (val && val !== item.title) {
      onRename(item._id, val);
    }
    setEditing(false);
  };

  return (
    <div
      className="wizard-structure-item"
      style={{
        paddingLeft: `${item.depth * 20 + 4}px`,
        animationDelay: `${item.flatIndex * 40}ms`,
      }}
    >
      <button
        className={`wizard-check ${item.enabled ? "checked" : ""}`}
        onClick={() => onToggle(item._id)}
        aria-label={item.enabled ? "Disable" : "Enable"}
      >
        {item.enabled && <CheckIcon />}
      </button>
      <span className="wizard-item-icon">
        {item.type === "folder" ? <FolderIcon /> : <FileIcon />}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          className="wizard-item-rename"
          defaultValue={item.title}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <span
          className={`wizard-item-title ${!item.enabled ? "disabled" : ""}`}
          onDoubleClick={() => setEditing(true)}
        >
          {item.title}
        </span>
      )}
    </div>
  );
}

// --- Main Component ---

export function ProjectWizard({ onComplete, onCancel, defaultAgent, apiBase }) {
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState(null);
  const [description, setDescription] = useState("");
  const [materialMode, setMaterialMode] = useState(null);
  const [material, setMaterial] = useState("");
  const [structure, setStructure] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const nameInputRef = useRef(null);

  // Focus name input when step 5 appears
  useEffect(() => {
    if (step === 5 && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 260);
    }
  }, [step]);

  // Escape to cancel/back
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (step === 1) {
          onCancel();
        } else {
          handleBack();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [step, projectType]);

  const handleBack = useCallback(() => {
    if (step === 5 && projectType === "freeform") {
      setStep(1);
    } else if (step === 5) {
      setStep(4);
    } else {
      setStep(step - 1);
    }
  }, [step, projectType]);

  const handleTypeSelect = (typeId) => {
    setProjectType(typeId);
    if (typeId === "freeform") {
      setProjectName("");
      setStructure(null);
      setStep(5);
    } else {
      setStep(2);
    }
  };

  const handleDescriptionContinue = () => setStep(3);
  const handleDescriptionSkip = () => {
    setDescription("");
    setStep(3);
  };

  const handleMaterialContinue = () => {
    setStep(4);
    generateStructure();
  };

  const generateStructure = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    const systemPrompt = `You are helping set up a new writing project. Based on the project type, description, and any existing material, generate a project structure.

Output ONLY valid JSON with this exact format — no markdown fences, no explanation, just the JSON object:
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
- Structure should match the project type's conventions
- Include 5-15 items total
- Use folders for logical groupings (acts, parts, seasons, sections)
- First item should be the main planning/outline document
- Suggest a creative, specific working title based on the description (not generic like "Untitled Novel")
- If there's existing material, analyze it and structure around it`;

    const typeLabel = PROJECT_TYPES.find((t) => t.id === projectType)?.label || projectType;
    let userMessage = `Project type: ${typeLabel}`;
    if (description) userMessage += `\n\nDescription: ${description}`;
    if (material) userMessage += `\n\nExisting material:\n${material.slice(0, 3000)}`;

    try {
      const response = await fetch(`${apiBase}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      if (!response.ok || !response.body) {
        throw new Error("AI request failed");
      }

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

      // Parse JSON from the response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setStructure(assignIds(result.structure || []));
        setProjectName(result.suggestedName || "");
      } else {
        throw new Error("Could not parse structure");
      }
    } catch (error) {
      // Fall back to default structure
      const fallback = FALLBACK_STRUCTURES[projectType] || FALLBACK_STRUCTURES.freeform;
      setStructure(assignIds(fallback.structure));
      setProjectName(fallback.suggestedName || "");
      if (error.message !== "AI request failed") {
        setGenerateError("Used default structure — AI wasn't available.");
      } else {
        setGenerateError("Used default structure — AI wasn't available.");
      }
    }

    setIsGenerating(false);
  };

  const handleRegenerate = () => {
    setStructure(null);
    generateStructure();
  };

  const handleToggle = (id) => {
    setStructure((prev) => updateItem(prev, id, (item) => ({ ...item, enabled: !item.enabled })));
  };

  const handleRename = (id, newTitle) => {
    setStructure((prev) => updateItem(prev, id, (item) => ({ ...item, title: newTitle })));
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    const enabledStructure = structure ? filterEnabled(structure) : [];
    await onComplete({
      name: projectName.trim() || "Untitled",
      type: projectType,
      structure: enabledStructure,
    });
    setIsCreating(false);
  };

  const flatItems = structure ? flattenItems(structure) : [];

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
        {/* Step 1 — Project Type */}
        {step === 1 && (
          <div className="wizard-step" key="type">
            <h1 className="wizard-heading">What are you creating?</h1>
            <div className="wizard-type-list">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.id}
                  className="wizard-type-option"
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <span className="wizard-type-label">{type.label}</span>
                  <span className="wizard-type-desc">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Description */}
        {step === 2 && (
          <div className="wizard-step" key="description">
            <button className="wizard-back" onClick={handleBack}>
              <ArrowLeftIcon /> Back
            </button>
            <h1 className="wizard-heading">What's it about?</h1>
            <p className="wizard-subheading">{DESCRIPTION_PROMPTS[projectType]}</p>
            <textarea
              className="wizard-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project in a few sentences..."
              autoFocus
              rows={6}
            />
            <div className="wizard-actions">
              <button className="ghost" onClick={handleDescriptionSkip}>Skip</button>
              <button className="primary" onClick={handleDescriptionContinue}>Continue</button>
            </div>
          </div>
        )}

        {/* Step 3 — Material */}
        {step === 3 && (
          <div className="wizard-step" key="material">
            <button className="wizard-back" onClick={handleBack}>
              <ArrowLeftIcon /> Back
            </button>
            <h1 className="wizard-heading">Do you have material?</h1>
            <div className="wizard-material-list">
              <button
                className={`wizard-material-option ${materialMode === "fresh" ? "selected" : ""}`}
                onClick={() => { setMaterialMode("fresh"); setMaterial(""); }}
              >
                Starting fresh
              </button>
              <button
                className={`wizard-material-option ${materialMode === "notes" ? "selected" : ""}`}
                onClick={() => setMaterialMode("notes")}
              >
                I have notes or ideas
              </button>
              <button
                className={`wizard-material-option ${materialMode === "draft" ? "selected" : ""}`}
                onClick={() => setMaterialMode("draft")}
              >
                I have a draft
              </button>
            </div>

            {(materialMode === "notes" || materialMode === "draft") && (
              <textarea
                className="wizard-textarea"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder={
                  materialMode === "notes"
                    ? "Paste your notes, ideas, or references..."
                    : "Paste your draft content..."
                }
                autoFocus
                rows={8}
              />
            )}

            {materialMode && (
              <div className="wizard-actions">
                <button className="primary" onClick={handleMaterialContinue}>Continue</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Structure */}
        {step === 4 && (
          <div className="wizard-step" key="structure">
            <button className="wizard-back" onClick={handleBack}>
              <ArrowLeftIcon /> Back
            </button>

            {isGenerating ? (
              <div className="wizard-generating">
                <div className="wizard-spinner" />
                <p className="wizard-generating-text">Building your project structure...</p>
              </div>
            ) : (
              <>
                <h1 className="wizard-heading">Your project structure</h1>
                <p className="wizard-subheading">
                  Toggle items on or off. Double-click to rename.
                </p>

                {generateError && (
                  <p className="wizard-notice">{generateError}</p>
                )}

                <div className="wizard-structure-list">
                  {flatItems.map((item) => (
                    <StructureItem
                      key={item._id}
                      item={item}
                      onToggle={handleToggle}
                      onRename={handleRename}
                    />
                  ))}
                </div>

                <div className="wizard-actions">
                  <button className="wizard-regenerate" onClick={handleRegenerate}>
                    <RefreshIcon /> Regenerate
                  </button>
                  <div style={{ flex: 1 }} />
                  <button className="primary" onClick={() => setStep(5)}>Continue</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5 — Name */}
        {step === 5 && (
          <div className="wizard-step" key="name">
            <button className="wizard-back" onClick={handleBack}>
              <ArrowLeftIcon /> Back
            </button>
            <h1 className="wizard-heading">Name your project</h1>
            <input
              ref={nameInputRef}
              className="wizard-name-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Untitled"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <div className="wizard-actions">
              <button
                className="primary"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
