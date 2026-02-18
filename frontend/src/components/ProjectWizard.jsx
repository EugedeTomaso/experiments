import { useState, useRef, useEffect } from "react";
import { api, getAuthHeader } from "../api";
import { GhostTextarea } from "./GhostTextarea";

// Template prefills — clicking a template pre-fills the description textarea
const TEMPLATE_PREFILLS = {
  novel: "A novel about ",
  "short-story": "A short story about ",
  screenplay: "A screenplay about ",
  "tv-series": "A TV series about ",
  youtube: "A video about ",
  article: "An article about ",
  academic: "A research paper on ",
  product: "A product brief for ",
};

const TEMPLATE_LABELS = [
  { id: "novel", label: "Novel" },
  { id: "short-story", label: "Short Story" },
  { id: "screenplay", label: "Screenplay" },
  { id: "tv-series", label: "TV Series" },
  { id: "youtube", label: "YouTube / Video" },
  { id: "article", label: "Article / Essay" },
  { id: "academic", label: "Academic" },
  { id: "product", label: "Product / Work" },
];

// --- Data constants (used by structure generation prompts) ---

const EXTENSION_SIZES = {
  flash: "small", "short-video": "small", blog: "small", "academic-essay": "small",
  short: "small", "short-film": "small", brief: "small",
  novella: "medium", standard: "medium", feature: "medium", limited: "medium",
  "standard-video": "medium", essay: "medium", paper: "medium", novelette: "medium",
  season: "medium", "full-product": "medium", monograph: "medium",
  saga: "large", series: "large", "multi-season": "large",
  "long-video": "large", longform: "large", thesis: "large", "research-project": "large",
};

const EXTENSION_PROMPTS = {
  // Novel
  novella: "Flat chapter list — no parts or sections. A novella is compact, typically 5-8 chapters. Include an outline and character notes at the top.",
  standard: "Use a Part I / Part II / Part III structure. Each part is a folder containing 3-5 chapters. Include planning documents (outline, characters, world building) before the parts.",
  saga: "Structure as multiple books (Book 1, Book 2, Book 3). Each book is a folder with its own outline and chapters. Include a series bible, world building, and characters at the top level.",
  // Short Story
  flash: "Minimal — just a single Draft document. Flash fiction is one scene, no outline needed.",
  short: "Keep it simple: a Notes file for planning and a Draft file. No folders.",
  novelette: "Use a part or scene-based structure with 2-3 parts as folders, each containing 2-3 scenes. Include an outline and character notes.",
  // Screenplay
  "short-film": "Flat structure — logline, characters, and a single script document. No act folders. Short films don't need formal act breaks.",
  feature: "Three-act structure. Put the script in a folder with Act I, Act II, and Act III as separate documents. Include logline/synopsis, treatment, and characters.",
  series: "Structure around a pilot episode. Include a show bible, characters, and season overview. Create folders for the Pilot and 2-3 subsequent episode outlines.",
  // TV Series
  limited: "Create a folder per episode (4-6 episodes). Each folder has an outline document. Include show bible, characters, and season arc at the top.",
  season: "Single season with 8-10 episodes. Group episodes under a Season 1 folder. Include show bible, characters, and season arc.",
  "multi-season": "Multiple season folders (Season 1, 2, 3). Each season has a season arc and episode outlines. Include show bible, characters, and a master arc document.",
  // YouTube
  "short-video": "Minimal: a hook/script file and thumbnail notes. Shorts are under 60 seconds — no elaborate structure.",
  "standard-video": "Three documents: hook & outline, script, and production notes.",
  "long-video": "Documentary style. Include research/sources, a Script folder with introduction + sections + conclusion, production notes, and thumbnail options.",
  // Article
  blog: "Keep it flat: notes and a draft document. Blog posts don't need folders.",
  essay: "Three documents: research notes, outline, and draft. Essays need a clear thesis plan.",
  longform: "Create a Draft folder with sections (Introduction, Section 1-4, Conclusion). Include research notes, source list, and outline at the top level.",
  // Academic
  "academic-essay": "Simple flat structure: research notes, outline, draft, and references.",
  paper: "Follow IMRAD structure: abstract, introduction, literature review, methodology, results, discussion, conclusion, and references. All as separate flat documents.",
  monograph: "Chapter-based structure. Each chapter is a folder containing a draft document. Include abstract, preface, conclusion, bibliography, and appendices.",
  thesis: "Formal thesis structure. Literature review as a folder with sub-topics. Results as a folder with data analysis and findings. Include abstract, methodology, discussion, conclusion, references, and appendices.",
  // Product
  brief: "Flat structure: problem statement, proposed solution, requirements, and success metrics.",
  "full-product": "Organized into Research, Strategy, and Specs folders. Include overview at top and launch plan at bottom.",
  "research-project": "Include a Data Collection folder (interviews, surveys, competitive analysis) and a Synthesis folder (findings, recommendations). Add research plan, methodology, and final report.",
};

const FALLBACK_STRUCTURES = {
  // --- Novel ---
  "novel:novella": {
    suggestedName: "Untitled Novella",
    structure: [
      { type: "file", title: "Outline" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Chapter 1" },
      { type: "file", title: "Chapter 2" },
      { type: "file", title: "Chapter 3" },
      { type: "file", title: "Chapter 4" },
      { type: "file", title: "Chapter 5" },
    ],
  },
  novel: {
    suggestedName: "Untitled Novel",
    structure: [
      { type: "file", title: "Outline" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
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
  "novel:standard": {
    suggestedName: "Untitled Novel",
    structure: [
      { type: "file", title: "Outline" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
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
  "novel:saga": {
    suggestedName: "Untitled Saga",
    structure: [
      { type: "file", title: "Series Bible" },
      { type: "file", title: "World Building" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "folder", title: "Book 1", children: [
        { type: "file", title: "Outline" },
        { type: "file", title: "Chapter 1" },
        { type: "file", title: "Chapter 2" },
        { type: "file", title: "Chapter 3" },
      ]},
      { type: "folder", title: "Book 2", children: [
        { type: "file", title: "Outline" },
      ]},
      { type: "folder", title: "Book 3", children: [
        { type: "file", title: "Outline" },
      ]},
    ],
  },
  // --- Short Story ---
  "short-story:flash": {
    suggestedName: "Untitled Flash Fiction",
    structure: [
      { type: "file", title: "Draft" },
    ],
  },
  "short-story": {
    suggestedName: "Untitled Story",
    structure: [
      { type: "file", title: "Notes" },
      { type: "file", title: "Draft" },
    ],
  },
  "short-story:short": {
    suggestedName: "Untitled Story",
    structure: [
      { type: "file", title: "Notes" },
      { type: "file", title: "Draft" },
    ],
  },
  "short-story:novelette": {
    suggestedName: "Untitled Novelette",
    structure: [
      { type: "file", title: "Outline" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "folder", title: "Part I", children: [
        { type: "file", title: "Scene 1" },
        { type: "file", title: "Scene 2" },
      ]},
      { type: "folder", title: "Part II", children: [
        { type: "file", title: "Scene 3" },
        { type: "file", title: "Scene 4" },
      ]},
      { type: "folder", title: "Part III", children: [
        { type: "file", title: "Scene 5" },
      ]},
    ],
  },
  // --- Screenplay ---
  "screenplay:short-film": {
    suggestedName: "Untitled Short Film",
    structure: [
      { type: "file", title: "Logline & Synopsis" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Script" },
    ],
  },
  screenplay: {
    suggestedName: "Untitled Screenplay",
    structure: [
      { type: "file", title: "Logline & Synopsis" },
      { type: "file", title: "Treatment" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "folder", title: "Script", children: [
        { type: "file", title: "Act I" },
        { type: "file", title: "Act II" },
        { type: "file", title: "Act III" },
      ]},
    ],
  },
  "screenplay:feature": {
    suggestedName: "Untitled Screenplay",
    structure: [
      { type: "file", title: "Logline & Synopsis" },
      { type: "file", title: "Treatment" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "folder", title: "Script", children: [
        { type: "file", title: "Act I" },
        { type: "file", title: "Act II" },
        { type: "file", title: "Act III" },
      ]},
    ],
  },
  "screenplay:series": {
    suggestedName: "Untitled Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Season Overview" },
      { type: "folder", title: "Pilot", children: [
        { type: "file", title: "Outline" },
        { type: "file", title: "Script" },
      ]},
      { type: "folder", title: "Episode 2", children: [
        { type: "file", title: "Outline" },
      ]},
      { type: "folder", title: "Episode 3", children: [
        { type: "file", title: "Outline" },
      ]},
    ],
  },
  // --- TV Series ---
  "tv-series:limited": {
    suggestedName: "Untitled Limited Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Season Arc" },
      { type: "folder", title: "Episode 1", children: [
        { type: "file", title: "Outline" },
      ]},
      { type: "folder", title: "Episode 2", children: [
        { type: "file", title: "Outline" },
      ]},
      { type: "folder", title: "Episode 3", children: [
        { type: "file", title: "Outline" },
      ]},
      { type: "folder", title: "Episode 4", children: [
        { type: "file", title: "Outline" },
      ]},
    ],
  },
  "tv-series": {
    suggestedName: "Untitled Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Season Arc" },
      { type: "folder", title: "Season 1", children: [
        { type: "file", title: "Pilot Outline" },
        { type: "file", title: "Episode 2" },
        { type: "file", title: "Episode 3" },
      ]},
    ],
  },
  "tv-series:season": {
    suggestedName: "Untitled Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Season Arc" },
      { type: "folder", title: "Season 1", children: [
        { type: "file", title: "Pilot Outline" },
        { type: "file", title: "Episode 2" },
        { type: "file", title: "Episode 3" },
        { type: "file", title: "Episode 4" },
        { type: "file", title: "Episode 5" },
        { type: "file", title: "Episode 6" },
      ]},
    ],
  },
  "tv-series:multi-season": {
    suggestedName: "Untitled Series",
    structure: [
      { type: "file", title: "Show Bible" },
      { type: "file", title: "Characters", content_md: "## Characters\n\n| Name | Role | Arc | Notes |\n|------|------|-----|-------|\n| | Protagonist | | |\n| | Antagonist | | |\n| | Supporting | | |\n" },
      { type: "file", title: "Master Arc" },
      { type: "folder", title: "Season 1", children: [
        { type: "file", title: "Season Arc" },
        { type: "file", title: "Pilot Outline" },
        { type: "file", title: "Episode 2" },
        { type: "file", title: "Episode 3" },
      ]},
      { type: "folder", title: "Season 2", children: [
        { type: "file", title: "Season Arc" },
        { type: "file", title: "Episode 1" },
      ]},
      { type: "folder", title: "Season 3", children: [
        { type: "file", title: "Season Arc" },
      ]},
    ],
  },
  // --- YouTube ---
  "youtube:short-video": {
    suggestedName: "Untitled Short",
    structure: [
      { type: "file", title: "Hook & Script" },
      { type: "file", title: "Thumbnail Notes" },
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
  "youtube:standard-video": {
    suggestedName: "Untitled Video",
    structure: [
      { type: "file", title: "Hook & Outline" },
      { type: "file", title: "Script" },
      { type: "file", title: "Production Notes" },
    ],
  },
  "youtube:long-video": {
    suggestedName: "Untitled Documentary",
    structure: [
      { type: "file", title: "Research & Sources" },
      { type: "file", title: "Outline" },
      { type: "folder", title: "Script", children: [
        { type: "file", title: "Introduction" },
        { type: "file", title: "Section 1" },
        { type: "file", title: "Section 2" },
        { type: "file", title: "Section 3" },
        { type: "file", title: "Conclusion" },
      ]},
      { type: "file", title: "Production Notes" },
      { type: "file", title: "Thumbnail & Title Options" },
    ],
  },
  // --- Article ---
  "article:blog": {
    suggestedName: "Untitled Blog Post",
    structure: [
      { type: "file", title: "Notes" },
      { type: "file", title: "Draft" },
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
  "article:essay": {
    suggestedName: "Untitled Essay",
    structure: [
      { type: "file", title: "Research Notes" },
      { type: "file", title: "Outline" },
      { type: "file", title: "Draft" },
    ],
  },
  "article:longform": {
    suggestedName: "Untitled Feature",
    structure: [
      { type: "file", title: "Research Notes" },
      { type: "file", title: "Source List", content_md: "## Sources\n\n| Source | URL | Key takeaway | Used in |\n|-------|-----|-------------|----------|\n| | | | |\n| | | | |\n" },
      { type: "file", title: "Outline" },
      { type: "folder", title: "Draft", children: [
        { type: "file", title: "Introduction" },
        { type: "file", title: "Section 1" },
        { type: "file", title: "Section 2" },
        { type: "file", title: "Section 3" },
        { type: "file", title: "Section 4" },
        { type: "file", title: "Conclusion" },
      ]},
    ],
  },
  // --- Academic ---
  "academic:academic-essay": {
    suggestedName: "Untitled Academic Essay",
    structure: [
      { type: "file", title: "Research Notes" },
      { type: "file", title: "Outline" },
      { type: "file", title: "Draft" },
      { type: "file", title: "References", content_md: "## References\n\n| # | Author(s) | Year | Title | Source | Notes |\n|---|-----------|------|-------|--------|-------|\n| 1 | | | | | |\n| 2 | | | | | |\n" },
    ],
  },
  academic: {
    suggestedName: "Untitled Academic Work",
    structure: [
      { type: "file", title: "Research Question" },
      { type: "file", title: "Literature Review" },
      { type: "file", title: "Outline" },
      { type: "file", title: "Draft" },
      { type: "file", title: "References", content_md: "## References\n\n| # | Author(s) | Year | Title | Source | Notes |\n|---|-----------|------|-------|--------|-------|\n| 1 | | | | | |\n| 2 | | | | | |\n" },
    ],
  },
  "academic:paper": {
    suggestedName: "Untitled Research Paper",
    structure: [
      { type: "file", title: "Abstract" },
      { type: "file", title: "Introduction" },
      { type: "file", title: "Literature Review" },
      { type: "file", title: "Methodology", content_md: "## Methodology\n\n| Aspect | Detail |\n|--------|--------|\n| **Approach** | |\n| **Method** | |\n| **Sample** | |\n| **Data collection** | |\n| **Analysis** | |\n" },
      { type: "file", title: "Results" },
      { type: "file", title: "Discussion" },
      { type: "file", title: "Conclusion" },
      { type: "file", title: "References", content_md: "## References\n\n| # | Author(s) | Year | Title | Source | Notes |\n|---|-----------|------|-------|--------|-------|\n| 1 | | | | | |\n| 2 | | | | | |\n" },
    ],
  },
  "academic:monograph": {
    suggestedName: "Untitled Monograph",
    structure: [
      { type: "file", title: "Abstract" },
      { type: "file", title: "Preface" },
      { type: "folder", title: "Chapter 1: Introduction", children: [
        { type: "file", title: "Draft" },
      ]},
      { type: "folder", title: "Chapter 2: Background", children: [
        { type: "file", title: "Draft" },
      ]},
      { type: "folder", title: "Chapter 3: Analysis", children: [
        { type: "file", title: "Draft" },
      ]},
      { type: "folder", title: "Chapter 4: Discussion", children: [
        { type: "file", title: "Draft" },
      ]},
      { type: "file", title: "Conclusion" },
      { type: "file", title: "Bibliography", content_md: "## Bibliography\n\n| # | Author(s) | Year | Title | Source | Notes |\n|---|-----------|------|-------|--------|-------|\n| 1 | | | | | |\n| 2 | | | | | |\n" },
      { type: "file", title: "Appendices" },
    ],
  },
  "academic:thesis": {
    suggestedName: "Untitled Thesis",
    structure: [
      { type: "file", title: "Abstract" },
      { type: "file", title: "Research Question & Hypothesis" },
      { type: "folder", title: "Literature Review", children: [
        { type: "file", title: "Theoretical Framework" },
        { type: "file", title: "Previous Research" },
      ]},
      { type: "file", title: "Methodology", content_md: "## Methodology\n\n| Aspect | Detail |\n|--------|--------|\n| **Approach** | |\n| **Method** | |\n| **Sample** | |\n| **Data collection** | |\n| **Analysis** | |\n" },
      { type: "folder", title: "Results", children: [
        { type: "file", title: "Data Analysis" },
        { type: "file", title: "Findings" },
      ]},
      { type: "file", title: "Discussion" },
      { type: "file", title: "Conclusion" },
      { type: "file", title: "References", content_md: "## References\n\n| # | Author(s) | Year | Title | Source | Notes |\n|---|-----------|------|-------|--------|-------|\n| 1 | | | | | |\n| 2 | | | | | |\n" },
      { type: "file", title: "Appendices" },
    ],
  },
  // --- Product ---
  "product:brief": {
    suggestedName: "Untitled Brief",
    structure: [
      { type: "file", title: "Problem Statement" },
      { type: "file", title: "Proposed Solution" },
      { type: "file", title: "Requirements" },
      { type: "file", title: "Success Metrics", content_md: "## Success Metrics\n\n| Metric | Target | Current | Method |\n|--------|--------|---------|--------|\n| | | | |\n| | | | |\n" },
    ],
  },
  product: {
    suggestedName: "Untitled Project",
    structure: [
      { type: "file", title: "Brief" },
      { type: "file", title: "Research" },
      { type: "file", title: "Roadmap", content_md: "## Roadmap\n\n| Phase | Milestone | Status | Target |\n|-------|-----------|--------|--------|\n| Discovery | Research complete | | |\n| Definition | Spec finalized | | |\n| Build | MVP ready | | |\n| Launch | Public release | | |\n" },
      { type: "file", title: "Specs" },
    ],
  },
  "product:full-product": {
    suggestedName: "Untitled Product",
    structure: [
      { type: "file", title: "Overview", content_md: "## Overview\n\n| | Detail |\n|---|---|\n| **Problem** | |\n| **Solution** | |\n| **Target audience** | |\n| **Success metrics** | |\n\n## Key decisions\n\n| Decision | Status | Date | Notes |\n|----------|--------|------|-------|\n| | | | |\n" },
      { type: "folder", title: "Research", children: [
        { type: "file", title: "User Research" },
        { type: "file", title: "Market Analysis", content_md: "## Market Analysis\n\n### Competitive landscape\n\n| Competitor | Strengths | Weaknesses | Differentiation |\n|------------|-----------|------------|------------------|\n| | | | |\n| | | | |\n\n### Market size\n\n| Segment | TAM | SAM | SOM |\n|---------|-----|-----|-----|\n| | | | |\n" },
      ]},
      { type: "folder", title: "Strategy", children: [
        { type: "file", title: "Vision & Goals" },
        { type: "file", title: "Roadmap", content_md: "## Roadmap\n\n| Phase | Milestone | Status | Target |\n|-------|-----------|--------|--------|\n| Discovery | Research complete | | |\n| Definition | Spec finalized | | |\n| Build | MVP ready | | |\n| Launch | Public release | | |\n" },
      ]},
      { type: "folder", title: "Specs", children: [
        { type: "file", title: "Feature Spec" },
        { type: "file", title: "Technical Requirements" },
      ]},
      { type: "file", title: "Launch Plan" },
    ],
  },
  "product:research-project": {
    suggestedName: "Untitled Research Project",
    structure: [
      { type: "file", title: "Research Plan" },
      { type: "file", title: "Methodology", content_md: "## Methodology\n\n| Aspect | Detail |\n|--------|--------|\n| **Approach** | |\n| **Method** | |\n| **Sample** | |\n| **Data collection** | |\n| **Analysis** | |\n" },
      { type: "folder", title: "Data Collection", children: [
        { type: "file", title: "Interview Notes" },
        { type: "file", title: "Survey Results", content_md: "## Survey Results\n\n### Demographics\n\n| Segment | Count | % |\n|---------|-------|----||\n| | | |\n\n### Key findings\n\n| Question | Top response | % | Notes |\n|----------|-------------|---|-------|\n| | | | |\n" },
        { type: "file", title: "Competitive Analysis", content_md: "## Competitive Analysis\n\n| Product | Category | Pricing | Key features | Gaps |\n|---------|----------|---------|-------------|------|\n| | | | | |\n| | | | | |\n" },
      ]},
      { type: "folder", title: "Synthesis", children: [
        { type: "file", title: "Key Findings" },
        { type: "file", title: "Recommendations" },
      ]},
      { type: "file", title: "Final Report" },
    ],
  },
  // --- Freeform ---
  freeform: {
    suggestedName: "",
    structure: [],
  },
};

function getFallbackStructure(type, extension) {
  const compoundKey = extension ? `${type}:${extension}` : null;
  if (compoundKey && FALLBACK_STRUCTURES[compoundKey]) {
    return FALLBACK_STRUCTURES[compoundKey];
  }
  return FALLBACK_STRUCTURES[type] || FALLBACK_STRUCTURES.freeform;
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

export function ProjectWizard({ onComplete, onCancel, defaultAgent, apiBase }) {
  // Screen state machine
  const [screen, setScreen] = useState("describe");
  const [direction, setDirection] = useState("forward");

  // Data
  const [description, setDescription] = useState("");
  const [followUps, setFollowUps] = useState([]);        // AI-generated questions
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [projectName, setProjectName] = useState("");
  const [nameSuggestion, setNameSuggestion] = useState(""); // ghost text for name input

  // Loading states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Background structure generation
  const structurePromiseRef = useRef(null);
  const nameInputRef = useRef(null);

  const goForward = (s) => { setDirection("forward"); setScreen(s); };
  const goBackward = (s) => { setDirection("backward"); setScreen(s); };

  // --- Keyboard Navigation ---
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (screen === "describe") onCancel();
        else if (screen === "name") {
          goBackward(followUps.length > 0 ? `followup-${followUps.length - 1}` : "describe");
        } else if (screen.startsWith("followup-")) {
          const idx = parseInt(screen.split("-")[1]);
          goBackward(idx === 0 ? "describe" : `followup-${idx - 1}`);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [screen, followUps, onCancel]);

  // Focus name input when reaching name screen
  useEffect(() => {
    if (screen === "name" && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 260);
    }
  }, [screen]);

  // --- AI Helper: Evaluate Follow-ups ---
  const evaluateFollowUps = async () => {
    const systemPrompt = `You are helping someone set up a new writing project. They've described what they want to create.

Analyze their description. Do you have enough information to create a good file/folder structure for their project?

If the description is detailed enough (mentions type, scope, subject matter), respond:
{"needsFollowUp": false}

If you need more information, generate 1-2 targeted follow-up questions and respond:
{"needsFollowUp": true, "questions": [{"question": "...", "type": "choice", "options": ["A", "B", "C"]}, {"question": "...", "type": "text", "placeholder": "..."}]}

Rules:
- Maximum 2 questions
- Prefer "choice" type with 2-4 short options
- Use "text" type only when you need specific details the user must provide
- Questions should uncover scope, organization, or specific content the user has in mind
- Output ONLY valid JSON — no markdown fences, no explanation`;

    const response = await fetch(`${apiBase}/api/ai/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        provider: defaultAgent.provider,
        model: defaultAgent.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
      }),
    });

    if (!response.ok || !response.body) throw new Error("AI request failed");

    const fullContent = await readSSEStream(response);
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { needsFollowUp: false };
  };

  // --- AI Helper: Generate Structure ---
  const generateStructure = async () => {
    const systemPrompt = `You are helping set up a new writing project. Based on the project description and any follow-up answers, generate a project structure.

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

    let userMessage = `Project description: ${description}`;
    if (followUps.length > 0 && Object.keys(followUpAnswers).length > 0) {
      userMessage += "\n\nFollow-up Q&A:";
      followUps.forEach((q, i) => {
        if (followUpAnswers[i]) {
          userMessage += `\n- ${q.question}\n  Answer: ${followUpAnswers[i]}`;
        }
      });
    }

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
      return { name: result.suggestedName || "", structure: result.structure || [] };
    }
    throw new Error("Could not parse structure");
  };

  // --- Screen Handlers ---

  const handleDescriptionContinue = async () => {
    if (!description.trim()) return;
    setIsEvaluating(true);
    goForward("evaluating");

    try {
      const result = await evaluateFollowUps();
      if (result.needsFollowUp && result.questions?.length > 0) {
        setFollowUps(result.questions.slice(0, 2));
        setIsEvaluating(false);
        goForward("followup-0");
      } else {
        setFollowUps([]);
        setIsEvaluating(false);
        enterNameScreen();
      }
    } catch {
      setFollowUps([]);
      setIsEvaluating(false);
      enterNameScreen();
    }
  };

  const handleFollowUpChoice = (questionIdx, option) => {
    setFollowUpAnswers((prev) => ({ ...prev, [questionIdx]: option }));
    // Auto-advance for choice questions
    const nextIdx = questionIdx + 1;
    if (nextIdx < followUps.length) {
      setTimeout(() => goForward(`followup-${nextIdx}`), 200);
    } else {
      setTimeout(() => enterNameScreen(), 200);
    }
  };

  const handleFollowUpTextContinue = (questionIdx) => {
    const nextIdx = questionIdx + 1;
    if (nextIdx < followUps.length) {
      goForward(`followup-${nextIdx}`);
    } else {
      enterNameScreen();
    }
  };

  const fetchNameSuggestion = async () => {
    try {
      const data = await api.autocomplete(
        `Suggest a short, creative working title for this writing project: ${description.slice(0, 500)}`,
        "project_name"
      );
      if (data?.completion) {
        setNameSuggestion(data.completion.replace(/^["']|["']$/g, "").trim());
      }
    } catch {
      // Silently ignore — structure generation also provides a name
    }
  };

  const enterNameScreen = () => {
    // Start structure generation in background
    structurePromiseRef.current = generateStructure().catch(() => ({
      name: "Untitled",
      structure: [{ type: "file", title: "Notes" }, { type: "file", title: "Draft" }],
    }));

    // Fetch a name suggestion via autocomplete (faster path)
    fetchNameSuggestion();

    // Set name suggestion from structure result only if autocomplete hasn't already set one
    structurePromiseRef.current.then((result) => {
      if (result.name && !projectName) {
        setNameSuggestion((prev) => prev || result.name);
      }
    });

    goForward("name");
  };

  const handleTemplatePick = (templateId) => {
    const prefill = TEMPLATE_PREFILLS[templateId] || "";
    setDescription(prefill);
  };

  const handleEmptyProject = () => {
    goForward("name");
  };

  const handleNameTab = (e) => {
    if (e.key === "Tab" && nameSuggestion && !projectName) {
      e.preventDefault();
      setProjectName(nameSuggestion);
      setNameSuggestion("");
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setShowSuccess(true);

    let structure = [];
    if (structurePromiseRef.current) {
      try {
        const result = await structurePromiseRef.current;
        structure = result.structure || [];
      } catch {
        structure = [];
      }
    }

    await new Promise((r) => setTimeout(r, 600)); // success animation
    await onComplete({
      name: projectName.trim() || nameSuggestion || "Untitled",
      type: "custom",
      extension: null,
      structure,
      description,
    });
    setIsCreating(false);
  };

  // --- Back Navigation ---
  const handleBack = () => {
    if (screen === "name") {
      goBackward(followUps.length > 0 ? `followup-${followUps.length - 1}` : "describe");
    } else if (screen.startsWith("followup-")) {
      const idx = parseInt(screen.split("-")[1]);
      goBackward(idx === 0 ? "describe" : `followup-${idx - 1}`);
    }
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

        {/* Screen: Describe */}
        {screen === "describe" && (
          <div className={screenClass} key="describe">
            <h1 className="wizard-heading">What are you creating?</h1>
            <p className="wizard-subheading">Describe your project and we'll help you set it up.</p>
            <GhostTextarea
              value={description}
              onChange={setDescription}
              context="project_description"
              className="wizard-textarea"
              placeholder="A sci-fi novel about time travel, a research paper on climate change, a product brief for a new app..."
              autoFocus
              rows={3}
              style={{ minHeight: "auto" }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && description.trim()) {
                  handleDescriptionContinue();
                }
              }}
            />
            <div className="wizard-actions">
              <button
                className="primary"
                onClick={handleDescriptionContinue}
                disabled={!description.trim()}
              >
                Continue
              </button>
            </div>

            <div className="wizard-template-divider">
              <span>or pick a template</span>
            </div>

            <div className="wizard-template-grid">
              {TEMPLATE_LABELS.map((t) => (
                <button key={t.id} className="wizard-template-pill" onClick={() => handleTemplatePick(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <button className="wizard-freeform-link" onClick={handleEmptyProject}>
              Start with an empty project
            </button>
          </div>
        )}

        {/* Screen: Evaluating (brief loading) */}
        {screen === "evaluating" && (
          <div className={screenClass} key="evaluating">
            <div className="wizard-evaluating">
              <div className="wizard-skeleton">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="wizard-skeleton-item" />
                ))}
              </div>
              <p className="wizard-evaluating-text">Setting things up...</p>
            </div>
          </div>
        )}

        {/* Screen: Follow-up Questions */}
        {screen.startsWith("followup-") && (() => {
          const idx = parseInt(screen.split("-")[1]);
          const q = followUps[idx];
          if (!q) return null;

          return (
            <div className={screenClass} key={screen}>
              <button className="wizard-back" onClick={handleBack}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {" "}Back
              </button>
              <h1 className="wizard-heading">{q.question}</h1>

              {q.type === "choice" ? (
                <div className="wizard-extension-list">
                  {q.options.map((opt, j) => (
                    <button
                      key={j}
                      className={`wizard-extension-option ${followUpAnswers[idx] === opt ? "selected" : ""}`}
                      onClick={() => handleFollowUpChoice(idx, opt)}
                    >
                      <span className="wizard-extension-label">{opt}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <GhostTextarea
                    value={followUpAnswers[idx] || ""}
                    onChange={(val) => setFollowUpAnswers((prev) => ({ ...prev, [idx]: val }))}
                    context="project_followup"
                    className="wizard-textarea"
                    placeholder={q.placeholder || "Your answer..."}
                    autoFocus
                    rows={3}
                  />
                  <div className="wizard-actions">
                    <button className="primary" onClick={() => handleFollowUpTextContinue(idx)}>
                      Continue
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Screen: Name */}
        {screen === "name" && (
          <div className={screenClass} key="name">
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
                <h1 className="wizard-heading">Name your project</h1>
                <div style={{ position: "relative" }}>
                  <input
                    ref={nameInputRef}
                    className="wizard-name-input"
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      if (e.target.value) setNameSuggestion("");
                    }}
                    placeholder={nameSuggestion || "Untitled"}
                    onKeyDown={(e) => {
                      handleNameTab(e);
                      if (e.key === "Enter") handleCreate();
                    }}
                  />
                  {nameSuggestion && !projectName && (
                    <span className="wizard-name-hint">Press Tab to accept</span>
                  )}
                </div>
                <div className="wizard-actions">
                  <button className="primary" onClick={handleCreate} disabled={isCreating}>
                    Create project
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
