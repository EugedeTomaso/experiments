import { useState, useRef, useEffect } from "react";
import { getAuthHeader } from "../api";

/* ── Types ── */

const PROJECT_TYPES = [
  { id: "product", label: "Product / Work", desc: "Briefs, specs, and roadmaps", icon: "M2.5 3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Zm2.5 3h2m-2 2.5h6m-6 2.5h4" },
  { id: "marketing", label: "Marketing", desc: "Landing pages, campaigns, and brand copy", icon: "M2 3h12v9H2Zm0 3h12M5 9h6" },
  { id: "article", label: "Article / Essay", desc: "Editorial or long-form essays", icon: "M3 2.5h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm1.5 3h7m-7 2.5h7m-7 2.5h4" },
  { id: "newsletter", label: "Newsletter", desc: "Issues, digests, and series", icon: "M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Zm0 0l6 4 6-4" },
  { id: "academic", label: "Academic", desc: "Thesis, papers, and research", icon: "M8 2L2 5l6 3 6-3Zm-6 5v4l6 3 6-3V7" },
  { id: "legal", label: "Legal", desc: "Contracts, briefs, and policy docs", icon: "M4 2h8l1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3Zm2 4h4m-4 2h4m-4 2h2" },
  { id: "novel", label: "Novel", desc: "Long-form fiction with chapters and arcs", icon: "M4 2.5h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a.5.5 0 0 1-.5-.5v-14A.5.5 0 0 1 4 2.5Zm0 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2" },
  { id: "short-story", label: "Short Story", desc: "Single narrative, shorter form", icon: "M3.5 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm2 4h5m-5 3h5m-5 3h3" },
  { id: "screenplay", label: "Screenplay", desc: "Film or theater script", icon: "M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1H2Zm0 3h12m-12 3h12m0-6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4" },
  { id: "tv-series", label: "TV Series", desc: "Show bible and episode outlines", icon: "M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Zm3 10h6m-3 0v2" },
  { id: "youtube", label: "YouTube / Video", desc: "Video scripts and production notes", icon: "M2.5 4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Zm4 2l3.5 2-3.5 2Z" },
  { id: "podcast", label: "Podcast", desc: "Episodes, interviews, and show notes", icon: "M8 2a3 3 0 0 0-3 3v3a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM4 8a4 4 0 0 0 8 0M8 12v3m-2 0h4" },
  { id: "social-media", label: "Social Media", desc: "Threads, campaigns, and calendars", icon: "M3 3h4v4H3Zm6 0h4v4H9ZM3 9h4v4H3Zm6 1h4m-4 2h3" },
  { id: "freeform", label: "Freeform", desc: "Empty project — start from scratch", icon: "M12 3l1 1-8 8-2.5.5.5-2.5 8-8ZM10.5 4.5l1 1" },
];

const SUBCATEGORIES = {
  product: [
    { id: "brief", label: "Brief", desc: "Problem statement, solution, requirements" },
    { id: "full-product", label: "Full Product", desc: "Research, strategy, and specs" },
    { id: "research-project", label: "Research Project", desc: "Data collection and synthesis" },
  ],
  marketing: [
    { id: "landing-page", label: "Landing Page", desc: "Copy, structure, and messaging" },
    { id: "campaign-brief", label: "Campaign Brief", desc: "Goals, audience, channels, creative" },
    { id: "brand-guidelines", label: "Brand Guidelines", desc: "Voice, tone, visual identity" },
  ],
  article: [
    { id: "blog", label: "Blog", desc: "Notes and a draft, quick to publish" },
    { id: "essay", label: "Essay", desc: "Research, outline, and polished draft" },
    { id: "longform", label: "Longform", desc: "Multi-section feature with sources" },
  ],
  newsletter: [
    { id: "single-issue", label: "Single Issue", desc: "One standalone issue" },
    { id: "newsletter-series", label: "Series", desc: "Recurring issues with a theme" },
    { id: "digest", label: "Digest", desc: "Curated links and commentary" },
  ],
  academic: [
    { id: "academic-essay", label: "Academic Essay", desc: "Research notes, outline, draft, references" },
    { id: "paper", label: "Paper", desc: "IMRAD structure with methodology" },
    { id: "monograph", label: "Monograph", desc: "Chapter-based scholarly work" },
    { id: "thesis", label: "Thesis", desc: "Full thesis with literature review" },
  ],
  legal: [
    { id: "contract", label: "Contract", desc: "Terms, clauses, and schedules" },
    { id: "legal-brief", label: "Legal Brief", desc: "Arguments, citations, and analysis" },
    { id: "policy-doc", label: "Policy Doc", desc: "Policy language and compliance notes" },
  ],
  novel: [
    { id: "novella", label: "Novella", desc: "Compact, 5-8 chapters, no parts" },
    { id: "standard", label: "Standard", desc: "Parts and chapters with planning docs" },
    { id: "saga", label: "Saga", desc: "Multi-book series with world building" },
  ],
  "short-story": [
    { id: "flash", label: "Flash", desc: "One scene, under 1,000 words" },
    { id: "short", label: "Short", desc: "Notes and a draft, classic form" },
    { id: "novelette", label: "Novelette", desc: "Scene-based with parts" },
  ],
  screenplay: [
    { id: "short-film", label: "Short Film", desc: "Logline, characters, single script" },
    { id: "feature", label: "Feature", desc: "Three-act structure with treatment" },
    { id: "series", label: "Series", desc: "Pilot and episode outlines" },
  ],
  "tv-series": [
    { id: "limited", label: "Limited", desc: "4-6 episodes, self-contained" },
    { id: "season", label: "Season", desc: "8-10 episodes, single season" },
    { id: "multi-season", label: "Multi-season", desc: "Multiple seasons with master arc" },
  ],
  youtube: [
    { id: "short-video", label: "Short Video", desc: "Under 60 seconds, hook and script" },
    { id: "standard-video", label: "Standard Video", desc: "Outline, script, production notes" },
    { id: "long-video", label: "Long Video", desc: "Documentary-style with research" },
  ],
  podcast: [
    { id: "solo-episode", label: "Solo Episode", desc: "Outline, script, and show notes" },
    { id: "interview", label: "Interview", desc: "Questions, research, and notes" },
    { id: "podcast-series", label: "Series", desc: "Multiple episodes with planning" },
  ],
  "social-media": [
    { id: "thread", label: "Thread", desc: "Sequential posts on a topic" },
    { id: "campaign", label: "Campaign", desc: "Multi-platform content plan" },
    { id: "content-calendar", label: "Content Calendar", desc: "Scheduled posts and themes" },
  ],
};

const FALLBACK_STRUCTURES = {
  novel: [
    { type: "file", title: "Outline" },
    { type: "file", title: "Characters" },
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
  "short-story": [
    { type: "file", title: "Notes" },
    { type: "file", title: "Draft" },
  ],
  screenplay: [
    { type: "file", title: "Logline & Synopsis" },
    { type: "file", title: "Treatment" },
    { type: "file", title: "Characters" },
    { type: "folder", title: "Script", children: [
      { type: "file", title: "Act I" },
      { type: "file", title: "Act II" },
      { type: "file", title: "Act III" },
    ]},
  ],
  "tv-series": [
    { type: "file", title: "Show Bible" },
    { type: "file", title: "Characters" },
    { type: "file", title: "Season Arc" },
    { type: "folder", title: "Season 1", children: [
      { type: "file", title: "Pilot Outline" },
      { type: "file", title: "Episode 2" },
      { type: "file", title: "Episode 3" },
    ]},
  ],
  youtube: [
    { type: "file", title: "Hook & Outline" },
    { type: "file", title: "Script" },
    { type: "file", title: "Production Notes" },
  ],
  article: [
    { type: "file", title: "Research Notes" },
    { type: "file", title: "Outline" },
    { type: "file", title: "Draft" },
  ],
  academic: [
    { type: "file", title: "Research Question" },
    { type: "file", title: "Literature Review" },
    { type: "file", title: "Outline" },
    { type: "file", title: "Draft" },
    { type: "file", title: "References" },
  ],
  product: [
    { type: "file", title: "Brief" },
    { type: "file", title: "Research" },
    { type: "file", title: "Roadmap" },
    { type: "file", title: "Specs" },
  ],
  marketing: [
    { type: "file", title: "Brief" },
    { type: "file", title: "Copy Draft" },
    { type: "file", title: "Assets List" },
  ],
  newsletter: [
    { type: "file", title: "Issue Draft" },
    { type: "file", title: "Notes" },
  ],
  legal: [
    { type: "file", title: "Draft" },
    { type: "file", title: "Notes" },
    { type: "file", title: "References" },
  ],
  podcast: [
    { type: "file", title: "Episode Outline" },
    { type: "file", title: "Script" },
    { type: "file", title: "Show Notes" },
  ],
  "social-media": [
    { type: "file", title: "Content Brief" },
    { type: "file", title: "Draft" },
  ],
  freeform: [],
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
  0 — Welcome (philosophy + CTA)
  1 — Type selection ("What are you making?")
  2 — Subcategory selection (skipped for freeform)
  3 — Name + description ("Give it a working title")
  4 — Structure (skipped for freeform)
  5 — Features showcase
  6 — Launch
*/

export function WelcomeWalkthrough({ onComplete, onSkip, defaultAgent, apiBase }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [projectType, setProjectType] = useState(null);
  const [projectExtension, setProjectExtension] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [structure, setStructure] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const nameInputRef = useRef(null);

  const goForward = (s) => { setDirection("forward"); setStep(s); };
  const goBackward = (s) => { setDirection("backward"); setStep(s); };

  const hasSubcategories = projectType && SUBCATEGORIES[projectType];
  const isFreeform = projectType === "freeform";
  const totalDots = isFreeform ? 3 : 4;
  const currentDotIndex = isFreeform
    ? (step === 3 ? 0 : step === 5 ? 1 : step === 6 ? 2 : -1)
    : step - 3;

  useEffect(() => {
    if (step === 3 && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 260);
    }
  }, [step]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (step === 0) onSkip();
        else if (step === 2) goBackward(1);
        else if (step === 3) goBackward(hasSubcategories ? 2 : 1);
        else if (step === 5 && isFreeform) goBackward(3);
        else goBackward(step - 1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [step, onSkip, hasSubcategories, isFreeform]);

  const handleTypeSelect = (typeId) => {
    setProjectType(typeId);
    setProjectExtension(null);
    setStructure(null);
    if (typeId === "freeform") {
      goForward(3);
    } else if (SUBCATEGORIES[typeId]) {
      goForward(2);
    } else {
      goForward(3);
    }
  };

  const handleSubcategorySelect = (extId) => {
    setProjectExtension(extId);
    goForward(3);
  };

  const handleNameContinue = () => {
    if (projectType === "freeform") {
      goForward(5);
    } else {
      goForward(4);
      if (!structure) generateStructure();
    }
  };

  const generateStructure = async () => {
    setIsGenerating(true);
    setStructure(null);
    try {
      const typeLabel = PROJECT_TYPES.find((t) => t.id === projectType)?.label || projectType;
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
              content: `Project type: ${typeLabel}${projectName.trim() ? `\nTitle: ${projectName}` : ""}${description.trim() ? `\nDescription: ${description}` : ""}`,
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
      setStructure(assignIds(FALLBACK_STRUCTURES[projectType] || []));
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
        type: projectType,
        extension: projectExtension,
        structure: enabledStructure,
        description,
        structureSummary: flatItems.map((i) => i.title).join(", "),
      });
    } catch {
      setIsCreating(false);
    }
  };

  const stepClass = `welcome-page ${direction === "backward" ? "backward" : ""}`;
  const flatItems = structure ? flattenItems(structure) : [];

  /* ── Features showcase step ── */

  const renderFeaturesStep = () => (
    <>
      <h1 className="welcome-heading">Three things to know.</h1>
      <div className="welcome-features">
        <div className="welcome-feature-card">
          <div className="welcome-feature-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div className="welcome-feature-title">Select to format</div>
          <div className="welcome-feature-desc">
            Highlight any text and a toolbar appears — bold, italic, strikethrough, code, or leave a comment.
          </div>
        </div>
        <div className="welcome-feature-card">
          <div className="welcome-feature-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </div>
          <div className="welcome-feature-title">AI review</div>
          <div className="welcome-feature-desc">
            Hit Review and your AI reads the whole draft — then leaves inline suggestions, like a real editor.
          </div>
        </div>
        <div className="welcome-feature-card">
          <div className="welcome-feature-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" />
              <path d="M19 10l.75 1.7 1.75.8-1.75.8L19 15l-.75-1.7-1.75-.8 1.75-.8Z" />
              <path d="M9 17l.6 1.3 1.4.7-1.4.6L9 21l-.6-1.4-1.4-.6 1.4-.7Z" />
            </svg>
          </div>
          <div className="welcome-feature-title">AI assistant</div>
          <div className="welcome-feature-desc">
            Press <kbd>&#8984;J</kbd> to chat. It reads your entire project and remembers your preferences.
          </div>
        </div>
      </div>
      <button className="welcome-cta wt-pulse" onClick={() => goForward(6)}>
        Continue
      </button>
    </>
  );

  /* ── Launch step ── */

  const renderLaunchStep = () => (
    <>
      <div className="welcome-brand">
        <div className="welcome-brand-mark">M</div>
      </div>
      <h1 className="welcome-heading">Ready.</h1>
      <p className="welcome-text">
        We've loaded a sample draft so you can try everything right away.
      </p>
      <button
        className={`welcome-cta ${!isCreating ? "wt-pulse" : ""}`}
        onClick={handleComplete}
        disabled={isCreating}
      >
        {isCreating ? "Creating..." : "Start writing"}
      </button>
    </>
  );

  return (
    <div className="welcome">
      <button className="welcome-skip" onClick={onSkip}>
        Skip
      </button>

      <div className="welcome-body">
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className={stepClass} key="welcome">
            <div className="welcome-brand">
              <div className="welcome-brand-mark">M</div>
            </div>
            <h1 className="welcome-heading">
              Your ideas deserve a room, not a blank page.
            </h1>
            <p className="welcome-text">
              Marvin gives your work structure and intelligence. Outline, draft,
              and revise — with an AI that reads everything you've written.
            </p>
            <p className="welcome-subtext">
              For novels, screenplays, articles, academic papers, and anything
              worth writing well.
            </p>
            <div className="welcome-cta-group">
              <button className="welcome-cta wt-pulse" onClick={() => goForward(1)}>
                Create your first project
              </button>
              <button className="welcome-alt" onClick={onSkip}>
                or explore on your own
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Type selection ── */}
        {step === 1 && (
          <div className={stepClass} key="type">
            <h1 className="welcome-heading">What are you making?</h1>
            <p className="welcome-text">
              Chapters, acts, sections — we'll set up the right structure for
              your work. What's the project?
            </p>
            <p className="welcome-hint">Pick one to continue</p>
            <div className="welcome-type-list">
              {PROJECT_TYPES.map((type, i) => (
                <button
                  key={type.id}
                  className={`welcome-type-option ${i === 0 ? "wt-pulse-subtle" : ""}`}
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <div className="welcome-type-option-inner">
                    <svg className="welcome-type-icon" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={type.icon} />
                    </svg>
                    <div className="welcome-type-text">
                      <span className="welcome-type-label">{type.label}</span>
                      <span className="welcome-type-desc">{type.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Subcategory selection ── */}
        {step === 2 && hasSubcategories && (
          <div className={stepClass} key="subcategory">
            <h1 className="welcome-heading">What kind?</h1>
            <p className="welcome-text">
              This helps us set up the right structure for your project.
            </p>
            <p className="welcome-hint">Pick one to continue</p>
            <div className="welcome-type-list">
              {SUBCATEGORIES[projectType].map((sub, i) => (
                <button
                  key={sub.id}
                  className={`welcome-type-option ${i === 0 ? "wt-pulse-subtle" : ""}`}
                  onClick={() => handleSubcategorySelect(sub.id)}
                >
                  <div className="welcome-type-option-inner">
                    <div className="welcome-type-text">
                      <span className="welcome-type-label">{sub.label}</span>
                      <span className="welcome-type-desc">{sub.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Name + Description ── */}
        {step === 3 && (
          <div className={stepClass} key="name">
            <h1 className="welcome-heading">Give it a working title.</h1>
            <p className="welcome-text">Working titles change — that's the point.</p>
            <input
              ref={nameInputRef}
              className="welcome-name-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Untitled"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameContinue();
              }}
            />
            <textarea
              className="welcome-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about? (optional)"
              rows={3}
            />
            <button className="welcome-cta wt-pulse" onClick={handleNameContinue}>
              Continue
            </button>
            <p className="welcome-hint">or press Enter ↵</p>
          </div>
        )}

        {/* ── Step 4: Structure (non-freeform) ── */}
        {step === 4 && projectType !== "freeform" && (
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
                    className="welcome-cta wt-pulse"
                    onClick={() => goForward(5)}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Features step ── */}
        {step === 5 && (
          <div className={stepClass} key="features">
            {renderFeaturesStep()}
          </div>
        )}

        {/* ── Launch step ── */}
        {step === 6 && (
          <div className={stepClass} key="launch">
            {renderLaunchStep()}
          </div>
        )}
      </div>

      {/* ── Bottom navigation (from step 1+) ── */}
      {step > 0 && (
        <div className="welcome-nav">
          <div className="welcome-nav-side">
            <button
              className="welcome-nav-btn"
              onClick={() => {
                if (step === 3 && !hasSubcategories) goBackward(1);
                else if (step === 5 && isFreeform) goBackward(3);
                else goBackward(step - 1);
              }}
              aria-label="Previous"
            >
              <ChevronLeft />
            </button>
          </div>
          {step > 2 && (
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
          )}
          <div className="welcome-nav-side" />
        </div>
      )}
    </div>
  );
}
