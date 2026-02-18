import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getAuthHeader } from "./api";
import { useAuth } from "./AuthContext";
import { MarkdownEditor } from "./MarkdownEditor";
import { TreeItem } from "./components/TreeItem";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { AssistantPanel } from "./components/AssistantPanel";
import { FolderView } from "./components/FolderView";
import { NodePreviewTooltip } from "./components/NodePreviewTooltip";
import { SearchResultItem } from "./components/SearchResultItem";
import { VersionsMenu } from "./components/VersionsMenu";
import { ExportMenu } from "./components/ExportMenu";
import { PublishDialog } from "./components/PublishDialog";
import { AgentCreatorSlideOver } from "./components/AgentCreatorSlideOver";
import { CommentInput } from "./components/CommentInput";
import { CommentThread } from "./components/CommentThread";
import { SettingsModal } from "./components/SettingsModal";
import { ShareDialog } from "./components/ShareDialog";
import { InvitationBanner } from "./components/InvitationBanner";
import { ProjectWizard } from "./components/ProjectWizard";
import { ProjectHome } from "./components/ProjectHome";
import { AllProjects } from "./components/AllProjects";
import { WelcomeWalkthrough } from "./components/WelcomeWalkthrough";
import { SpotlightTour } from "./components/SpotlightTour";
import { useComments } from "./hooks/useComments";
import { createStreamParser } from "./streamParser";
import { buildSnippet, wordCount } from "./utils";
import { createCollabSession } from "./collabPlugin";
import PresenceIndicator from "./components/PresenceIndicator";
import ConnectionBanner from "./components/ConnectionBanner";
import AiSuggestionBanner from "./components/AiSuggestionBanner";
import "./App.css";

const NEW_DOC_TEMPLATE = `\
Start writing, or press **/** for commands.
`;

const SAMPLE_DRAFT = `\
Most people think writing is about the first draft — the blank page, the blinking cursor, the mythical flow state where words pour out like water. It's a romantic image, and it's mostly wrong.

The real work happens after. Revision is where writing becomes *writing*: where scattered thoughts find their shape, where vague gestures become precise observations, where the thing you meant to say finally appears on the page.

## Why first drafts are supposed to be bad

A first draft is a conversation with yourself. You're thinking out loud, figuring out what you actually believe. Expecting that conversation to also be polished prose is like expecting your grocery list to be a poem.

The best writers know this instinctively. Hemingway called first drafts something unprintable. Anne Lamott calls them "shitty first drafts." The point isn't that good writers produce bad work — it's that they don't confuse the beginning of the process with the end of it.

## The revision loop

Good revision isn't about fixing typos or swapping adjectives. It's about re-seeing the work with fresh eyes. Some questions worth asking:

- Does the opening earn the reader's attention, or does it just assume it?
- Is every paragraph pulling its weight, or are some just filling space?
- Where did you write what was easy instead of what was true?

The hardest part is being honest with yourself. It's tempting to tinker around the edges — swap a word here, move a comma there — instead of confronting the deeper structural problems that require actual rewriting.

## A practice, not a talent

Revision is a skill that improves with repetition. The gap between good writing and great writing is often just the willingness to go through the text one more time, and then one more time after that.

Write your messy first draft. Then come back tomorrow and make it better.
`;

const INITIAL_DEFAULT_AGENT = {
  provider: "deepseek",
  model: "deepseek-chat",
  temperature: 0.7,
  system_prompt: "",
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const ASSISTANTS_PROMPT = `You are helping set up AI writing assistants for a project in a markdown editor called Marvin. Based on the project type and description, generate 2-3 assistants tailored to this project.

Each assistant should serve a different purpose (e.g., creative collaborator, editor/critic, research/planning).

Output ONLY valid JSON — an array of 2-3 objects, no markdown fences, no explanation:

[
  {
    "name": "Short memorable name (1-3 words)",
    "system_prompt": "Detailed instructions for this assistant's role, tone, and how it helps with this project.",
    "provider": "deepseek",
    "model": "deepseek-chat",
    "temperature": 0.7
  }
]

Rules:
- 2-3 assistants with distinct roles relevant to the project type
- System prompts should reference the specific project context
- Creative projects: include a creative collaborator + an editor/critic
- Non-fiction: include a research assistant + a writing coach/editor
- Temperature: 0.8-1.0 for creative, 0.3-0.5 for editors, 0.5-0.7 for research/planning
- Use "deepseek" as provider and "deepseek-chat" as model for all`;

const FALLBACK_ASSISTANTS = {
  novel: [
    { name: "Story Partner", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.9, system_prompt: "You are a creative writing partner for a novel. Help brainstorm plot ideas, develop characters, suggest dialogue, and work through narrative challenges. Be encouraging and imaginative. Preserve the author's voice." }},
    { name: "Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.3, system_prompt: "You are a sharp developmental and line editor. Identify weak prose, pacing issues, plot holes, and inconsistencies. Be direct and constructive. Suggest specific rewrites. Focus on tightening language and strengthening narrative structure." }},
  ],
  "short-story": [
    { name: "Story Partner", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.9, system_prompt: "You are a creative collaborator for short fiction. Help develop the central idea, suggest structural approaches, and refine the narrative arc. Short stories demand economy — every sentence should earn its place." }},
    { name: "Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.3, system_prompt: "You are a meticulous editor for short fiction. Focus on economy of language, cutting unnecessary words, and ensuring every scene advances the story. Be direct and specific." }},
  ],
  screenplay: [
    { name: "Story Room", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.9, system_prompt: "You are a writers' room collaborator for screenwriting. Help develop scenes, punch up dialogue, suggest visual storytelling opportunities, and workshop story beats. Think cinematically." }},
    { name: "Script Doctor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.4, system_prompt: "You are a script doctor. Analyze screenplay structure, pacing, dialogue naturalness, and character consistency. Identify scenes that drag and suggest cuts or restructuring." }},
  ],
  "tv-series": [
    { name: "Writers Room", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.9, system_prompt: "You are a TV writers' room partner. Help develop episode arcs, series mythology, character development across episodes, and episodic structure. Think about serialized storytelling and audience engagement." }},
    { name: "Show Runner", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.4, system_prompt: "You are a show runner reviewing scripts. Ensure consistency across episodes, check character voice continuity, flag timeline issues, and maintain the series bible." }},
  ],
  youtube: [
    { name: "Content Strategist", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.7, system_prompt: "You are a YouTube content strategist. Help craft compelling hooks, structure videos for retention, suggest thumbnail and title ideas, and optimize for audience engagement." }},
    { name: "Script Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.4, system_prompt: "You are a video script editor. Tighten language for spoken delivery, cut filler, improve transitions, and ensure the script sounds natural when read aloud." }},
  ],
  article: [
    { name: "Research Assistant", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.5, system_prompt: "You are a research assistant for editorial writing. Help gather background information, suggest angles, identify counterarguments, and provide context. Be thorough and cite your reasoning." }},
    { name: "Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.3, system_prompt: "You are an editorial editor. Review for clarity, logical flow, argument strength, and prose quality. Suggest structural improvements and tighten language." }},
  ],
  academic: [
    { name: "Research Advisor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.4, system_prompt: "You are an academic research advisor. Help develop arguments, suggest methodological approaches, identify gaps in reasoning, and strengthen scholarly rigor." }},
    { name: "Academic Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.2, system_prompt: "You are an academic editor. Review for clarity, logical consistency, proper citation practices, and adherence to academic writing standards. Flag unsupported claims." }},
  ],
  product: [
    { name: "Product Strategist", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.6, system_prompt: "You are a product strategist. Help refine problem statements, develop user stories, prioritize features, and think through edge cases. Challenge assumptions." }},
    { name: "Writer", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.5, system_prompt: "You are a product writing specialist. Help craft clear, concise product documentation, specifications, and briefs. Ensure requirements are unambiguous." }},
  ],
  freeform: [
    { name: "Writing Partner", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.7, system_prompt: "You are a versatile writing partner. Help brainstorm, draft, and refine content. Adapt to the user's project needs and writing style." }},
    { name: "Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.3, system_prompt: "You are a thorough editor. Review writing for clarity, consistency, and quality. Provide specific, actionable feedback." }},
  ],
  custom: [
    { name: "Writing Partner", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.7, system_prompt: "You are a versatile writing partner. Help brainstorm, draft, and refine content. Adapt to the user's project needs and writing style." }},
    { name: "Editor", config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.3, system_prompt: "You are a thorough editor. Review writing for clarity, consistency, and quality. Provide specific, actionable feedback." }},
  ],
};

const TYPE_LABELS = {
  novel: "Novel", "short-story": "Short Story", screenplay: "Screenplay",
  "tv-series": "TV Series", youtube: "YouTube / Video", "article": "Article / Essay",
  academic: "Academic", product: "Product / Work", freeform: "Freeform", custom: "Custom",
};

const normalizeId = (value) =>
  value === null || value === undefined ? null : String(value);


function buildTree(nodes) {
  const map = new Map();
  nodes.forEach((node) => {
    map.set(String(node.id), { ...node, children: [] });
  });
  const roots = [];
  map.forEach((node) => {
    if (node.parent !== null && node.parent !== undefined) {
      const parent = map.get(String(node.parent));
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (items) => {
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

export default function App() {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  // --- Project & Node state ---
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);

  // --- Editor state ---
  const [draft, setDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved'
  const [versions, setVersions] = useState([]);
  const autoSaveTimerRef = useRef(null);
  const loadedContentRef = useRef("");
  const pendingSaveRef = useRef(null); // { nodeId, content } or null
  const abortRef = useRef(null);
  const preEditDraftRef = useRef(null);

  // --- Layout state ---
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [assistantTab, setAssistantTab] = useState("chat");
  const [assistantWidth, setAssistantWidth] = useState(() => {
    const saved = localStorage.getItem("marvin:assistant-width");
    return saved ? Number(saved) : 380;
  });
  const [editorZoom, setEditorZoom] = useState(() => {
    const saved = localStorage.getItem("marvin:editor-zoom");
    return saved ? Number(saved) : 100;
  });

  // --- Chat state ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffAvailable, setDiffAvailable] = useState(false);
  const [diffStats, setDiffStats] = useState(null);
  const [compareVersionId, setCompareVersionId] = useState(null);

  // --- Conversation state ---
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // --- AI context from editor selection ---
  const [pendingContext, setPendingContext] = useState(null);

  // --- @ mention context ---
  const [mentionedFileIds, setMentionedFileIds] = useState([]);

  // --- Agent state ---
  const [agents, setAgents] = useState([]);
  const [nodeAgentConfigs, setNodeAgentConfigs] = useState([]);
  const [resolvedAgent, setResolvedAgent] = useState(null);
  const [nodeDirectConfig, setNodeDirectConfig] = useState(null);
  const [agentMode, setAgentMode] = useState("auto"); // "auto" | "fixed"
  const [isAgentCreatorOpen, setIsAgentCreatorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null); // null = create, object = edit

  // --- Wizard state ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // --- Walkthrough state ---
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const [showAppTour, setShowAppTour] = useState(false);

  // --- Settings state ---
  const [providerKeys, setProviderKeys] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [publishState, setPublishState] = useState(null); // { platform, connection }
  const [collabSession, setCollabSession] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [autosaveDelay, setAutosaveDelay] = useState(() => {
    const saved = localStorage.getItem("marvin:autosave-delay");
    return saved ? Number(saved) : 1500;
  });
  const [defaultAgent, setDefaultAgent] = useState(() => {
    try {
      const saved = localStorage.getItem("marvin:default-agent");
      return saved ? JSON.parse(saved) : INITIAL_DEFAULT_AGENT;
    } catch {
      return INITIAL_DEFAULT_AGENT;
    }
  });

  // --- Memory state ---
  const [memories, setMemories] = useState([]);
  const [resolvedMemories, setResolvedMemories] = useState(null);
  const [pendingMemorySuggestion, setPendingMemorySuggestion] = useState(null);
  const [memoryToast, setMemoryToast] = useState(null);

  // --- Inline comment state ---
  const [commentInputState, setCommentInputState] = useState(null);
  const editorRef = useRef(null);
  const editorWrapperRef = useRef(null);

  // --- Review mode ---
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewFocusOpen, setReviewFocusOpen] = useState(false);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckProgress, setFactCheckProgress] = useState(null);
  const [reviewEmptyMsg, setReviewEmptyMsg] = useState(false);
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const docMenuRef = useRef(null);

  // --- Comment state (centralized hook) ---
  const commentState = useComments({ nodeId: activeNodeId, editorRef, editorWrapperRef, content: draft });
  const {
    comments, openComments, decorationComments, activeThread: activeThreadComment,
    focusedId: focusedCommentId, navIndex: focusedNavIndex, navTotal,
    aiThinkingId: aiThinkingCommentId,
    reviewComments, reviewResolved, hasReviewProgress,
    load: loadComments, clear: clearComments,
    navigatePrev: handleNavPrev, navigateNext: handleNavNext,
    openThread, closeThread: handleCloseThread,
    create: createComment, approve: handleApproveComment,
    reject: handleRejectComment, resolve: handleResolveComment,
    remove: handleDeleteComment, reply: handleReplyToComment,
    askAI: handleAskAIInThread, addBulk: addBulkComments, addOne: addOneComment,
  } = commentState;

  // Sync active highlight class on DOM
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll(".comment-highlight--active").forEach((el) => {
      el.classList.remove("comment-highlight--active");
    });
    if (focusedCommentId) {
      wrapper.querySelectorAll(`[data-comment-id="${focusedCommentId}"]`).forEach((el) => {
        el.classList.add("comment-highlight--active");
      });
    }
  }, [focusedCommentId]);

  // Keyboard: Cmd+Shift+Arrow to navigate comments
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNavNext();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavPrev();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleNavNext, handleNavPrev]);

  // --- Drag & drop ---
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'after' | 'inside'

  // --- Sidebar state ---
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [outlineFilter, setOutlineFilter] = useState("");
  const [outlineWidth, setOutlineWidth] = useState(() => {
    const saved = localStorage.getItem("marvin:outline-width");
    return saved ? Number(saved) : 220;
  });
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const createMenuRef = useRef(null);
  const outlineFilterRef = useRef(null);
  const searchTimerRef = useRef(null);
  const hoverTimerRef = useRef(null);

  // --- Derived state ---
  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [String(n.id), n])),
    [nodes]
  );

  const childrenMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => {
      const parentId = normalizeId(node.parent);
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(node);
    });
    return map;
  }, [nodes]);

  const activeNode = useMemo(
    () => nodes.find((n) => String(n.id) === String(activeNodeId)),
    [nodes, activeNodeId]
  );

  const currentRole = useMemo(() => {
    const p = projects.find((p) => p.id === activeProjectId);
    return p?.current_user_role || null;
  }, [projects, activeProjectId]);

  const canEdit = currentRole && currentRole !== "viewer" && currentRole !== "commenter";

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const agentNodeIds = useMemo(() => {
    const ids = new Set();
    nodeAgentConfigs.forEach((c) => {
      if (c.node && c.agent) ids.add(String(c.node));
    });
    return ids;
  }, [nodeAgentConfigs]);

  const folderSummary = useMemo(() => {
    if (!activeNode || activeNode.type !== "folder") return null;
    const descendants = [];
    const stack = [String(activeNode.id)];
    while (stack.length) {
      const current = stack.pop();
      const children = childrenMap.get(current) || [];
      children.forEach((child) => {
        descendants.push(child);
        if (child.type === "folder") stack.push(String(child.id));
      });
    }
    const files = descendants.filter((n) => n.type === "file");
    const folders = descendants.filter((n) => n.type === "folder");
    const wordCount = files.reduce((total, file) => {
      const words = (file.content_md || "").trim().split(/\s+/).filter(Boolean);
      return total + words.length;
    }, 0);
    const lastUpdated = descendants.reduce((latest, n) => {
      return Math.max(latest, new Date(n.updated_at).getTime());
    }, new Date(activeNode.updated_at).getTime());
    const sampleFiles = files.slice(0, 10).map((file) => ({
      id: file.id,
      title: file.title,
      snippet: buildSnippet(file.content_md, 160),
      summary: file.summary || null,
      summaryStale: !file.summary_updated_at ||
        new Date(file.updated_at) > new Date(file.summary_updated_at),
    }));
    return { fileCount: files.length, folderCount: folders.length, wordCount, lastUpdated, sampleFiles };
  }, [activeNode, childrenMap]);

  const providerKeyMap = useMemo(() => {
    const map = new Map();
    providerKeys.forEach((key) => map.set(key.provider, key));
    return map;
  }, [providerKeys]);

  const wordCount = useMemo(() => {
    if (!draft) return 0;
    return draft.trim().split(/\s+/).filter(Boolean).length;
  }, [draft]);

  // --- Effects ---
  useEffect(() => {
    api.listProjects().then((data) => {
      setProjects(data);
      if (data.length && !activeProjectId) setActiveProjectId(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.listProviderKeys().then(setProviderKeys).catch(() => setProviderKeys([]));
  }, []);

  useEffect(() => {
    localStorage.setItem("marvin:autosave-delay", String(autosaveDelay));
  }, [autosaveDelay]);

  useEffect(() => {
    localStorage.setItem("marvin:default-agent", JSON.stringify(defaultAgent));
  }, [defaultAgent]);

  useEffect(() => {
    localStorage.setItem("marvin:assistant-width", String(assistantWidth));
  }, [assistantWidth]);

  useEffect(() => {
    localStorage.setItem("marvin:outline-width", String(outlineWidth));
  }, [outlineWidth]);

  useEffect(() => {
    localStorage.setItem("marvin:editor-zoom", String(editorZoom));
  }, [editorZoom]);

  useEffect(() => {
    if (!activeProjectId) return;

    // Flush any pending auto-save before switching projects so the
    // server has the latest content when the new project loads.
    clearTimeout(autoSaveTimerRef.current);
    let flushPromise = Promise.resolve();
    if (pendingSaveRef.current) {
      const { nodeId, content } = pendingSaveRef.current;
      setNodes((prev) =>
        prev.map((n) =>
          String(n.id) === String(nodeId) ? { ...n, content_md: content } : n
        )
      );
      flushPromise = api.updateNode(nodeId, { content_md: content }).catch(() => {});
      pendingSaveRef.current = null;
    }

    setActiveNodeId(null);
    flushPromise.then(() => api.listNodes(activeProjectId)).then((data) => {
      setNodes(data);
      // Auto-expand all folders on load
      const folderIds = new Set(data.filter((n) => n.type === "folder").map((n) => String(n.id)));
      setExpandedFolders(folderIds);
      const firstFile = data.find((n) => n.type === "file");
      if (firstFile) setActiveNodeId(String(firstFile.id));
    }).catch(() => {});
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) { setAgents([]); return; }
    api.listAgents(activeProjectId).then(setAgents).catch(() => setAgents([]));
  }, [activeProjectId]);

  // Fetch memories when project changes
  useEffect(() => {
    if (!activeProjectId) { setMemories([]); setResolvedMemories(null); return; }
    api.listMemories({ project: activeProjectId }).then(setMemories).catch(() => setMemories([]));
    api.resolveMemories({ project: activeProjectId }).then(setResolvedMemories).catch(() => setResolvedMemories(null));
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || !nodes.length) { setNodeAgentConfigs([]); return; }
    api.listAgentConfigs({}).then((all) => {
      const projectNodeIds = new Set(nodes.map((n) => String(n.id)));
      setNodeAgentConfigs(all.filter((c) => c.node && projectNodeIds.has(String(c.node))));
    }).catch(() => setNodeAgentConfigs([]));
  }, [activeProjectId, nodes]);

  // Eager summary generation: when a folder is active, generate summaries for stale files in background
  useEffect(() => {
    if (!activeNode || activeNode.type !== "folder") return;
    if (!folderSummary) return;

    const staleFiles = folderSummary.sampleFiles.filter(
      (f) => f.summaryStale && f.snippet
    );
    if (!staleFiles.length) return;

    staleFiles.forEach((file) => {
      api
        .generateSummary(file.id, {
          provider: defaultAgent.provider,
          model: defaultAgent.model,
        })
        .then((data) => {
          if (data.summary) {
            setNodes((prev) =>
              prev.map((n) =>
                String(n.id) === String(file.id)
                  ? { ...n, summary: data.summary, summary_updated_at: data.summary_updated_at }
                  : n
              )
            );
          }
        })
        .catch(() => {}); // Silently handle 429s and other errors
    });
  }, [activeNode?.id, folderSummary]);

  useEffect(() => {
    // Flush any pending auto-save for the previous node
    clearTimeout(autoSaveTimerRef.current);
    if (pendingSaveRef.current) {
      const { nodeId, content } = pendingSaveRef.current;
      // Optimistically update the node in memory so navigating back
      // loads the correct content even before the API responds.
      setNodes((prev) =>
        prev.map((n) =>
          String(n.id) === String(nodeId) ? { ...n, content_md: content } : n
        )
      );
      api.updateNode(nodeId, { content_md: content })
        .then((updated) => {
          setNodes((prev) =>
            prev.map((n) =>
              String(n.id) === String(updated.id) ? updated : n
            )
          );
        })
        .catch(() => {});
      pendingSaveRef.current = null;
    }

    // Read the node directly from the current nodes array.
    // Both setNodes and setActiveNodeId are batched in the same handler,
    // so the target node is always present when this effect runs.
    const node = nodes.find((n) => String(n.id) === String(activeNodeId));
    setDiffAvailable(false);
    setDiffVisible(false);

    if (node?.type === "file") {
      const content = node.content_md || "";
      setDraft(content);
      loadedContentRef.current = content;
      setSaveStatus("saved");
      clearComments();
      loadComments(node.id);
      api.listVersions(node.id).then(setVersions).catch(() => setVersions([]));
    } else {
      setDraft("");
      loadedContentRef.current = "";
      setSaveStatus("saved");
      clearComments();
      setVersions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  // Collab session lifecycle — only activate if WebSocket server is reachable
  useEffect(() => {
    const node = nodes.find((n) => String(n.id) === String(activeNodeId));
    if (!activeNodeId || !node || node.type !== "file") return;

    const jwt = localStorage.getItem("marvin:access_token");
    if (!jwt) return;

    const session = createCollabSession(activeNodeId, jwt, {
      name: user?.username || "Anonymous",
      id: user?.id || 0,
    });

    let destroyed = false;

    const unsubscribe = session.onConnectionChange((state) => {
      if (destroyed) return;
      setConnectionStatus(state);
      // If the server confirms connection, commit to collab mode
      if (state === "connected") {
        clearTimeout(connectTimeout);
        setCollabSession(session);
      }
    });

    // Give the WebSocket server a few seconds to connect.
    // If it doesn't connect in time, fall back to API-based saving
    // so content isn't lost to an empty Yjs document.
    const connectTimeout = setTimeout(() => {
      if (session.connectionState !== "connected") {
        destroyed = true;
        unsubscribe();
        session.destroy();
        setCollabSession(null);
        setConnectionStatus("disconnected");
      }
    }, 3000);

    // Start in non-collab mode; only switch if WebSocket connects
    setConnectionStatus("connecting");

    return () => {
      destroyed = true;
      clearTimeout(connectTimeout);
      unsubscribe();
      session.destroy();
      setCollabSession(null);
      setConnectionStatus("disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  // Auto-save with debounce
  useEffect(() => {
    if (!activeNodeId) return;
    if (collabSession && connectionStatus === "connected") return; // Collab server handles persistence
    if (draft === loadedContentRef.current) {
      setSaveStatus("saved");
      pendingSaveRef.current = null;
      return;
    }

    setSaveStatus("unsaved");
    const nodeId = activeNodeId;
    pendingSaveRef.current = { nodeId, content: draft };

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const updated = await api.updateNode(nodeId, { content_md: draft });
        setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
        const versionList = await api.listVersions(nodeId);
        setVersions(versionList);
        loadedContentRef.current = draft;
        pendingSaveRef.current = null;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, autosaveDelay);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [draft, autosaveDelay, collabSession, connectionStatus]);

  // Clear diff toggle when user edits and plugin clears its data
  useEffect(() => {
    if (diffAvailable && editorRef.current) {
      if (!editorRef.current.hasDiffData()) {
        setDiffAvailable(false);
        setDiffVisible(false);
        setDiffStats(null);
        setCompareVersionId(null);
      }
    }
  }, [draft, diffAvailable]);

  // Load conversations when node changes; reset chat state
  useEffect(() => {
    setChatMessages([]);
    setStreamingContent("");
    setChatInput("");
    setActiveConversationId(null);
    setMentionedFileIds([]);
    if (activeNodeId) {
      api.listConversations(activeNodeId).then(setConversations).catch(() => setConversations([]));
    } else {
      setConversations([]);
    }
  }, [activeNodeId]);

  useEffect(() => {
    if (!activeProjectId || !activeNode) {
      setResolvedAgent(null);
      setNodeDirectConfig(null);
      return;
    }
    api.resolveAgentConfig({ node: activeNode.id })
      .then(setResolvedAgent)
      .catch(() => setResolvedAgent(null));
    api.listAgentConfigs({ node: activeNode.id })
      .then((configs) => setNodeDirectConfig(configs.length ? configs[0] : null))
      .catch(() => setNodeDirectConfig(null));
  }, [activeProjectId, activeNode]);

  // --- Editor custom event listeners ---
  const handleHighlightClick = useCallback(
    (commentIds, rect) => {
      const rootComment = comments.find(
        (c) => commentIds.includes(c.id) && !c.parent
      );
      if (rootComment) {
        openThread(rootComment, rect);
      }
    },
    [comments, openThread]
  );

  useEffect(() => {
    const el = editorWrapperRef.current;
    if (!el) return;

    const onSelectionRequest = (e) => {
      setCommentInputState({
        from: e.detail.from,
        to: e.detail.to,
        text: e.detail.text,
        rect: e.detail.rect,
      });
    };

    const onHighlightClick = (e) => {
      handleHighlightClick(e.detail.commentIds, e.detail.rect);
    };

    const onAiRequest = (e) => {
      setPendingContext({ text: e.detail.text, from: e.detail.from, to: e.detail.to });
      setIsAssistantOpen(true);
    };

    const handleFactCheckSelection = (e) => {
      const { from, to } = e.detail;
      handleFactCheckRef.current?.(from, to);
    };

    el.addEventListener("comment-selection-request", onSelectionRequest);
    el.addEventListener("comment-highlight-click", onHighlightClick);
    el.addEventListener("ai-selection-request", onAiRequest);
    el.addEventListener("fact-check-selection-request", handleFactCheckSelection);
    return () => {
      el.removeEventListener("comment-selection-request", onSelectionRequest);
      el.removeEventListener("comment-highlight-click", onHighlightClick);
      el.removeEventListener("ai-selection-request", onAiRequest);
      el.removeEventListener("fact-check-selection-request", handleFactCheckSelection);
    };
  }, [handleHighlightClick]);

  // --- Cmd+J: toggle assistant pane ---
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsAssistantOpen((prev) => {
          if (prev) {
            // Closing — return focus to editor
            requestAnimationFrame(() => editorRef.current?.focus());
          }
          return !prev;
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // --- Cmd+=/- and Cmd+0: editor zoom ---
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setEditorZoom((z) => Math.min(z + 10, 150));
      } else if (e.key === "-") {
        e.preventDefault();
        setEditorZoom((z) => Math.max(z - 10, 75));
      } else if (e.key === "0") {
        e.preventDefault();
        setEditorZoom(100);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // --- Cmd+B: toggle outline sidebar ---
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsOutlineOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // --- Helpers ---
  const getNextOrder = (parentId) => {
    const targetParent = normalizeId(parentId);
    const siblings = nodes.filter((n) => normalizeId(n.parent) === targetParent);
    if (!siblings.length) return 0;
    return Math.max(...siblings.map((n) => n.order ?? 0)) + 1;
  };

  const isDescendant = (targetId, ancestorId) => {
    let current = nodesById.get(String(targetId));
    while (current && current.parent) {
      if (String(current.parent) === String(ancestorId)) return true;
      current = nodesById.get(String(current.parent));
    }
    return false;
  };

  // --- Handlers ---
  const handleCreateProject = () => {
    setIsWizardOpen(true);
  };

  const handleQuickCreate = async ({ name, type }) => {
    const project = await api.createProject({
      name: name.trim() || "Untitled",
      project_type: type || "",
      project_extension: "",
    });
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);
    setNodes([]);
    setActiveNodeId(null);

    // Generate assistants in background (fire-and-forget)
    generateAndCreateAssistants(project.id, { type, extension: "", description: "", structureSummary: "" });
  };

  const handleDeleteProject = async (projectId) => {
    await api.deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (projectId === activeProjectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      } else {
        setActiveProjectId(null);
        setNodes([]);
        setActiveNodeId(null);
      }
    }
  };

  const handleRenameProject = async (projectId, newName) => {
    const updated = await api.updateProject(projectId, { name: newName });
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const generateAndCreateAssistants = async (projectId, { type, extension, description, structureSummary }) => {
    const createFallbacks = async () => {
      const fallbacks = FALLBACK_ASSISTANTS[type] || FALLBACK_ASSISTANTS.freeform;
      for (const { name, config } of fallbacks) {
        try {
          const agent = await api.createAgent({ project: projectId, name, config });
          setAgents((prev) => [...prev, agent]);
        } catch (_) {}
      }
    };

    try {
      const typeLabel = TYPE_LABELS[type] || type;
      const userMessage = [
        `Project type: ${typeLabel}`,
        extension ? `Scope: ${extension}` : null,
        description ? `Description: ${description}` : null,
        structureSummary ? `Structure: ${structureSummary}` : null,
      ].filter(Boolean).join("\n");

      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          provider: "deepseek",
          model: "deepseek-chat",
          temperature: 0.5,
          messages: [
            { role: "system", content: ASSISTANTS_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok || !response.body) throw new Error("Generation failed");

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
          const dataLines = event.split("\n")
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

      const cleaned = fullOutput.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const assistants = JSON.parse(cleaned);

      if (!Array.isArray(assistants) || assistants.length === 0) throw new Error("Invalid response");

      for (const a of assistants) {
        try {
          const agent = await api.createAgent({
            project: projectId,
            name: a.name || "Assistant",
            config: {
              provider: a.provider || "deepseek",
              model: a.model || "deepseek-chat",
              temperature: a.temperature ?? 0.7,
              system_prompt: a.system_prompt || "",
            },
          });
          setAgents((prev) => [...prev, agent]);
        } catch (_) {}
      }
    } catch (_) {
      await createFallbacks();
    }
  };

  const handleWizardComplete = async ({ name, type, extension, structure, description, structureSummary }) => {
    setIsWizardOpen(false);
    const project = await api.createProject({
      name,
      project_type: type || "",
      project_extension: extension || "",
    });
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);

    // Create nodes from wizard structure
    let order = 0;
    const createNodesRecursive = async (items, parentId) => {
      for (const item of items) {
        const node = await api.createNode({
          project: project.id,
          parent: parentId,
          type: item.type,
          title: item.title,
          order: order++,
          content_md: item.content_md || "",
        });
        if (item.children?.length) {
          await createNodesRecursive(item.children, node.id);
        }
      }
    };

    if (structure?.length) {
      await createNodesRecursive(structure, null);
    }

    // Refresh nodes and select first file
    const allNodes = await api.listNodes(project.id);
    setNodes(allNodes);
    const folderIds = new Set(allNodes.filter((n) => n.type === "folder").map((n) => String(n.id)));
    setExpandedFolders(folderIds);
    const firstFile = allNodes.find((n) => n.type === "file");
    if (firstFile) setActiveNodeId(String(firstFile.id));

    // Generate assistants in background (fire-and-forget)
    generateAndCreateAssistants(project.id, { type, extension, description, structureSummary });
  };

  // --- Walkthrough handlers ---
  const showWalkthrough = !walkthroughDismissed && projects.length === 0 && !isWizardOpen;

  const handleWalkthroughComplete = async ({ name, type, extension, structure, description, structureSummary }) => {
    localStorage.setItem("marvin:walkthrough-seen", "true");
    setWalkthroughDismissed(true);

    const project = await api.createProject({
      name,
      project_type: type || "",
      project_extension: extension || "",
    });
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);

    let order = 0;
    let firstFileSeeded = false;
    const createNodesRecursive = async (items, parentId) => {
      for (const item of items) {
        const isFirstFile = item.type === "file" && !firstFileSeeded;
        if (isFirstFile) firstFileSeeded = true;
        const node = await api.createNode({
          project: project.id,
          parent: parentId,
          type: item.type,
          title: item.title,
          order: order++,
          content_md: isFirstFile ? SAMPLE_DRAFT : (item.content_md || ""),
        });
        if (item.children?.length) {
          await createNodesRecursive(item.children, node.id);
        }
      }
    };

    if (structure?.length) {
      await createNodesRecursive(structure, null);
    }

    const allNodes = await api.listNodes(project.id);
    setNodes(allNodes);
    const folderIds = new Set(allNodes.filter((n) => n.type === "folder").map((n) => String(n.id)));
    setExpandedFolders(folderIds);
    const firstFile = allNodes.find((n) => n.type === "file");
    if (firstFile) setActiveNodeId(String(firstFile.id));

    generateAndCreateAssistants(project.id, { type, extension, description, structureSummary });

    // Trigger the spotlight app tour after the UI settles
    setShowAppTour(true);
  };

  const handleWalkthroughSkip = () => {
    localStorage.setItem("marvin:walkthrough-seen", "true");
    setWalkthroughDismissed(true);
  };

  const handleCreateNode = async (type) => {
    if (!activeProjectId) return;
    const isFile = type === "file";
    let title;
    if (isFile) {
      title = "Untitled";
    } else {
      title = window.prompt("Folder name");
      if (!title) return;
    }
    const parent = activeNode?.type === "folder" ? activeNode.id : activeNode?.parent ?? null;
    const node = await api.createNode({
      project: activeProjectId,
      parent,
      type,
      title,
      order: getNextOrder(parent),
      content_md: isFile ? NEW_DOC_TEMPLATE : "",
    });
    setNodes((prev) => [...prev, node]);
    if (isFile) {
      setActiveNodeId(String(node.id));
    }
  };

  const handleRenameNode = async (nodeId, newTitle) => {
    if (!newTitle.trim()) return;
    const updated = await api.updateNode(nodeId, { title: newTitle.trim() });
    setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
  };

  const handleDeleteNode = async (nodeId) => {
    const node = nodesById.get(String(nodeId));
    if (!node) return;
    const label = node.type === "folder" ? "folder" : "file";
    if (!window.confirm(`Delete ${label} "${node.title}"?`)) return;
    await api.deleteNode(nodeId);
    setNodes((prev) => prev.filter((n) => String(n.id) !== String(nodeId)));
    if (String(activeNodeId) === String(nodeId)) setActiveNodeId(null);
  };

  const handleSelectNode = (node) => {
    setActiveNodeId(String(node.id));
    setHoverPreview(null);
    clearTimeout(hoverTimerRef.current);
  };

  const handleCreateInlineComment = async (body) => {
    if (!activeNode || !commentInputState) return;
    await createComment({
      node: activeNode.id,
      body,
      quoted_text: commentInputState.text,
      position_from: commentInputState.from,
      position_to: commentInputState.to,
    });
    setCommentInputState(null);
  };

  // --- Review mode handlers ---

  const handleRequestReview = async (focus = "all") => {
    if (!activeNode || isReviewing) return;
    setIsReviewing(true);
    setReviewFocusOpen(false);
    setAssistantTab("review");
    if (!isAssistantOpen) setIsAssistantOpen(true);
    try {
      const providerSettings = JSON.parse(localStorage.getItem("marvin:ai-provider") || "{}");
      const provider = providerSettings.provider || "deepseek";
      const model = providerSettings.model || "deepseek-chat";
      const newComments = await api.requestReview({
        node_id: activeNode.id,
        provider,
        model,
        focus,
      });
      if (newComments.length === 0) {
        setReviewEmptyMsg(true);
        setTimeout(() => setReviewEmptyMsg(false), 3000);
      } else {
        addBulkComments(newComments);
      }
    } catch (err) {
      console.error("Review failed:", err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleFactCheckRef = useRef(null);
  const handleFactCheck = async (selectionFrom = null, selectionTo = null) => {
    if (!activeNode || isFactChecking) return;
    setIsFactChecking(true);
    setFactCheckProgress(null);
    setAssistantTab("verify");
    if (!isAssistantOpen) setIsAssistantOpen(true);

    try {
      const providerSettings = JSON.parse(localStorage.getItem("marvin:ai-provider") || "{}");
      const provider = providerSettings.provider || "deepseek";
      const model = providerSettings.model || "deepseek-chat";

      const response = await api.factCheck({
        node_id: activeNode.id,
        provider,
        model,
        selection_from: selectionFrom,
        selection_to: selectionTo,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Fact-check request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "claims_extracted") {
              setFactCheckProgress({ total: parsed.count, done: 0 });
            } else if (parsed.type === "fact_check_result" && parsed.comment) {
              addOneComment(parsed.comment);
              setFactCheckProgress((prev) =>
                prev ? { ...prev, done: prev.done + 1 } : null
              );
            } else if (parsed.type === "error") {
              console.error("Fact-check error:", parsed.detail);
            }
          } catch (_) {
            // skip unparseable lines
          }
        }
      }
    } catch (err) {
      console.error("Fact-check failed:", err);
    } finally {
      setIsFactChecking(false);
      setFactCheckProgress(null);
    }
  };
  handleFactCheckRef.current = handleFactCheck;

  const handleAssignAgent = async (agentId) => {
    if (!activeNode) return;
    try {
      if (agentId) {
        if (nodeDirectConfig) {
          await api.updateAgentConfig(nodeDirectConfig.id, { agent: agentId, config: {} });
        } else {
          await api.createAgentConfig({
            scope_type: activeNode.type,
            node: activeNode.id,
            project: null,
            agent: agentId,
            config: {},
          });
        }
      } else {
        if (nodeDirectConfig) {
          await api.deleteAgentConfig(nodeDirectConfig.id);
        }
      }
    } catch (err) {
      console.error("Failed to assign agent:", err);
    }
    // Always refresh state so the UI stays in sync
    try {
      const configs = await api.listAgentConfigs({ node: activeNode.id });
      setNodeDirectConfig(configs.length ? configs[0] : null);
    } catch (_) {
      setNodeDirectConfig(null);
    }
    try {
      const resolved = await api.resolveAgentConfig({ node: activeNode.id });
      setResolvedAgent(resolved);
    } catch (_) {
      setResolvedAgent(null);
    }
    api.listAgentConfigs({}).then((all) => {
      const projectNodeIds = new Set(nodes.map((n) => String(n.id)));
      setNodeAgentConfigs(all.filter((c) => c.node && projectNodeIds.has(String(c.node))));
    }).catch(() => {});
  };

  const handleCreateAgentFromCreator = async ({ name, config }) => {
    if (!activeProjectId) return;
    const agent = await api.createAgent({
      project: activeProjectId,
      name,
      config,
    });
    setAgents((prev) => [...prev, agent]);
  };

  const handleUpdateAgent = async (agentId, { name, config }) => {
    const updated = await api.updateAgent(agentId, { name, config });
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDeleteAgent = async (agentId) => {
    await api.deleteAgent(agentId);
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  const openAgentEditor = (agent) => {
    setEditingAgent(agent);
    setIsAgentCreatorOpen(true);
  };

  const openAgentCreator = () => {
    setEditingAgent(null);
    setIsAgentCreatorOpen(true);
  };

  const handleSelectConversation = async (convId) => {
    setActiveConversationId(convId);
    try {
      const msgs = await api.listMessages(convId);
      setChatMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
    } catch {
      setChatMessages([]);
    }
  };

  const handleBackToList = () => {
    setActiveConversationId(null);
    setChatMessages([]);
    setStreamingContent("");
    // Refresh conversation list to get updated previews/counts
    if (activeNodeId) {
      api.listConversations(activeNodeId).then(setConversations).catch(() => {});
    }
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm("Delete this conversation?")) return;
    await api.deleteConversation(convId);
    setConversations((prev) => prev.filter((c) => String(c.id) !== String(convId)));
    setActiveConversationId(null);
    setChatMessages([]);
  };

  const handleRenameConversation = async (convId, newTitle) => {
    const updated = await api.updateConversation(convId, { title: newTitle });
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === String(updated.id) ? { ...c, ...updated } : c))
    );
  };

  const refreshMemories = useCallback(() => {
    if (!activeProjectId) return;
    api.listMemories({ project: activeProjectId }).then(setMemories).catch(() => {});
    api.resolveMemories({ project: activeProjectId }).then(setResolvedMemories).catch(() => {});
  }, [activeProjectId]);

  const handleCreateMemory = useCallback(async (content, scope, source = "manual") => {
    const payload = { content: content.slice(0, 200), scope, source };
    if (scope === "project" && activeProjectId) payload.project = activeProjectId;
    try {
      await api.createMemory(payload);
      refreshMemories();
      return true;
    } catch { return false; }
  }, [activeProjectId, refreshMemories]);

  const handleDeleteMemory = useCallback(async (id) => {
    try {
      await api.deleteMemory(id);
      refreshMemories();
    } catch {}
  }, [refreshMemories]);

  const handleSendMessageDirect = async (overrideMsg) => {
    const rawMsg = overrideMsg || chatInput;
    if (!rawMsg.trim() || isStreaming || !activeProjectId) return;

    // Detect "remember:" prefix — save as memory, don't send to AI
    const rememberMatch = rawMsg.trim().match(/^(?:remember(?:\s+that)?|recordá|acordate(?:\s+que)?)\s*[:]\s*(.+)/i);
    if (rememberMatch) {
      const memContent = rememberMatch[1].trim();
      const ok = await handleCreateMemory(memContent, "project", "manual");
      setChatInput("");
      if (ok) {
        setMemoryToast(memContent);
        setTimeout(() => setMemoryToast(null), 4000);
      }
      return;
    }

    abortRef.current = new AbortController();
    const userMsg = rawMsg.trim();
    // Build the API message with optional context
    const context = pendingContext;
    const capturedMentionedIds = [...mentionedFileIds];
    const apiUserMsg = context
      ? `[Re: "${context.text}"]\n\n${userMsg}`
      : userMsg;
    setChatMessages((prev) => [...prev, {
      role: "user",
      content: userMsg,
      context: context || undefined,
      mentionedFiles: capturedMentionedIds.length > 0 ? capturedMentionedIds : undefined,
    }]);
    setChatInput("");
    setPendingContext(null);
    setMentionedFileIds([]);
    setIsStreaming(true);
    setStreamingContent("");
    setIsEditingDocument(false);
    setDiffAvailable(false);
    setDiffVisible(false);
    if (collabSession) collabSession.setAiMode("streaming");
    if (editorRef.current) {
      try { editorRef.current.clearAiHighlights(); } catch (_) {}
    }

    // Save draft before AI edits for potential undo
    preEditDraftRef.current = draft;

    // Capture editor instance and node ID at stream start so that
    // navigating to another document mid-stream cannot redirect writes.
    const targetNodeId = activeNodeId;
    const targetEditor = editorRef.current;

    // Persist conversation + user message
    let convId = activeConversationId;
    try {
      if (!convId && targetNodeId) {
        const title = userMsg.length > 50
          ? userMsg.slice(0, userMsg.lastIndexOf(" ", 50) || 50)
          : userMsg;
        const conv = await api.createConversation({ node: Number(targetNodeId), title });
        convId = conv.id;
        setActiveConversationId(conv.id);
        setConversations((prev) => [conv, ...prev]);
      }
      if (convId) {
        api.createMessage({ conversation: convId, role: "user", content: userMsg }).catch(() => {});
      }
    } catch {
      // Non-blocking: conversation persistence shouldn't block the chat
    }

    try {
      let config;
      let routedAgentId = null;
      let routedAgentName = null;

      if (agentMode === "auto" && agents.length >= 2) {
        // Auto mode: ask backend to route
        try {
          const routed = await api.routeAgent({
            project_id: activeProjectId,
            query: userMsg,
          });
          if (routed.agent_id) {
            routedAgentId = routed.agent_id;
            routedAgentName = routed.agent_name;
            config = { ...defaultAgent, ...routed.config };
          }
        } catch (_) {
          // Routing failed — fall through to default resolution
        }
      }

      // If not routed (fixed mode, <2 agents, or routing failed), use existing resolution
      if (!config) {
        let resolved;
        try {
          resolved = await api.resolveAgentConfig(
            activeNode ? { node: activeNode.id } : { project: activeProjectId }
          );
        } catch (_) {
          if (activeNode && activeProjectId) {
            try {
              resolved = await api.resolveAgentConfig({ project: activeProjectId });
            } catch (_) {}
          }
        }
        config = { ...defaultAgent, ...(resolved?.config || {}) };

        // In auto mode with 1 agent, show that agent's name
        if (agentMode === "auto" && agents.length === 1) {
          routedAgentId = agents[0].id;
          routedAgentName = agents[0].name;
        }
      }

      const apiMessages = [];
      let systemContent = config.system_prompt || "";

      // Project context — name, type, brief
      const activeProject = projects.find((p) => p.id === activeProjectId);
      if (activeProject) {
        let projectSection = `\n\n## Project\n- Name: ${activeProject.name}`;
        if (activeProject.project_type) {
          const typeLabel = activeProject.project_extension
            ? `${activeProject.project_type} (${activeProject.project_extension})`
            : activeProject.project_type;
          projectSection += `\n- Type: ${typeLabel}`;
        }
        systemContent += projectSection;
        if (activeProject.brief) {
          systemContent += `\n\n## Project Brief\n${activeProject.brief}`;
        }
      }

      // Memory injection — user + project preferences
      if (resolvedMemories) {
        const budget = 1500;
        let remaining = budget;
        const addSection = (label, items) => {
          if (!items || items.length === 0) return "";
          const header = `\n\n## ${label}\nThese are standing instructions from the user. Always follow these:\n`;
          if (remaining - header.length <= 0) return "";
          remaining -= header.length;
          let section = header;
          for (const item of items) {
            const line = `- ${item.content}\n`;
            if (remaining - line.length < 0) break;
            section += line;
            remaining -= line.length;
          }
          return section;
        };
        systemContent += addSection("User Preferences", resolvedMemories.user_memories);
        systemContent += addSection("Project Preferences", resolvedMemories.project_memories);
      }

      if (activeNode?.type === "file") {
        const parentFolderForLabel = activeNode.parent
          ? nodesById.get(String(activeNode.parent))
          : null;
        const locationLabel = parentFolderForLabel
          ? `a document titled "${activeNode.title}" inside the folder "${parentFolderForLabel.title}"`
          : `a document titled "${activeNode.title}"`;
        systemContent += `\n\nThe user is working on ${locationLabel}. Current content:\n\n${draft}`;
        systemContent += `\n\nWhen the user asks you to write, edit, rewrite, expand, or modify the document content, you MUST respond using this exact format:

<document>
[The complete updated document content in markdown]
</document>

<message>
[A brief follow-up message for the chat, e.g. "Done! I rewrote the intro. Want me to adjust anything?"]
</message>

IMPORTANT RULES:
- The <document> block must contain the COMPLETE document content (not a diff or partial update)
- The <message> block should be a short, conversational follow-up (1-2 sentences)
- If the user is NOT asking you to edit the document (e.g., they ask a question, want feedback, or want a summary), respond normally WITHOUT any <document> or <message> tags
- Never put document content outside of <document> tags when editing
- Never omit the <message> tag when you include a <document> tag
- Do NOT repeat the document or file title in your response text — the user already sees it in the UI

## Available Markdown Formats
The editor supports these advanced formats. Use them when they improve readability:
- **Tables**: standard GFM tables for structured data, comparisons, specs
- **Callout blocks**: \`> [!NOTE]\`, \`> [!TIP]\`, \`> [!WARNING]\`, \`> [!CAUTION]\`, \`> [!IMPORTANT]\` — for highlighting key info
- **Mermaid diagrams**: \\\`\\\`\\\`mermaid code blocks for flowcharts, sequence diagrams, gantt charts
- **Toggle sections**: \`> [!TOGGLE] Summary text\` for collapsible content
- **Highlight**: \`<mark>text</mark>\` for emphasizing key terms
- **Task lists**: \`- [ ]\` / \`- [x]\` for checklists
- Standard: bold, italic, strikethrough, code, blockquotes, lists, headings, HR

Use tables for any structured data. Use callouts for warnings, tips, and important notes.
Use mermaid when the user discusses processes, flows, or architectures.`;

        // Context file resolution: project pins + folder pins (or auto-sibling fallback)
        const projectPins = (activeProject?.context_nodes || [])
          .map((id) => nodesById.get(String(id)))
          .filter((n) => n && n.type === "file" && String(n.id) !== String(activeNode.id));

        const parentFolder = activeNode.parent
          ? nodesById.get(String(activeNode.parent))
          : null;
        const folderPinIds = parentFolder?.context_nodes;
        let folderContextFiles;
        if (folderPinIds && folderPinIds.length > 0) {
          folderContextFiles = folderPinIds
            .map((id) => nodesById.get(String(id)))
            .filter((n) => n && n.type === "file" && String(n.id) !== String(activeNode.id));
        } else if (activeProject?.auto_context !== false) {
          folderContextFiles = nodes.filter(
            (n) =>
              n.type === "file" &&
              n.parent === activeNode.parent &&
              String(n.id) !== String(activeNode.id)
          );
        } else {
          folderContextFiles = [];
        }

        // Combine + deduplicate
        const seenIds = new Set();
        const allContextFiles = [];
        for (const file of [...projectPins, ...folderContextFiles]) {
          if (!seenIds.has(String(file.id))) {
            seenIds.add(String(file.id));
            allContextFiles.push(file);
          }
        }

        if (allContextFiles.length > 0) {
          const useFullContent = allContextFiles.length <= 5;
          const contextSection = allContextFiles
            .slice(0, 30)
            .map((file) => {
              if (useFullContent) {
                return `### ${file.title}\n${file.content_md || "(empty)"}`;
              }
              return `- **${file.title}**: ${file.summary || "(no summary yet)"}`;
            })
            .join("\n\n");
          systemContent += `\n\n## Context documents\n${contextSection}`;
        }
      } else if (activeNode?.type === "folder" && folderSummary) {
        const summaryLines = [
          `The user is viewing a folder titled "${activeNode.title}".`,
          `Files: ${folderSummary.fileCount}, Folders: ${folderSummary.folderCount}`,
          `Total words: ${folderSummary.wordCount}`,
        ];
        if (folderSummary.sampleFiles.length) {
          summaryLines.push("File previews:");
          folderSummary.sampleFiles.forEach((file) => {
            summaryLines.push(`- ${file.title}: ${file.snippet || "Empty"}`);
          });
        }
        summaryLines.push("Do NOT repeat the folder or file title in your response — the user already sees it in the UI.");
        systemContent += "\n\n" + summaryLines.join("\n");
      }
      // @ mentioned files — inject their full content
      if (capturedMentionedIds.length > 0) {
        const mentionedSection = capturedMentionedIds
          .map((id) => nodesById.get(String(id)))
          .filter((n) => n && n.type === "file")
          .map((file) => `### ${file.title}\n${file.content_md || "(empty)"}`)
          .join("\n\n");
        if (mentionedSection) {
          systemContent += `\n\n## Referenced files\n${mentionedSection}`;
        }
      }

      // Memory suggestion instruction
      systemContent += `\n\nIf the user expresses a persistent writing preference (signaled by words like "always", "never", "from now on", "I prefer", "remember that"), naturally acknowledge it in your response and suggest saving it. Use this format at the END of your response:

<memory_suggestion>
content: [Concise imperative rule, under 200 chars]
scope: [user or project]
</memory_suggestion>

Rules for memory suggestions:
- Only suggest for clearly persistent preferences, not one-time instructions
- "user" scope for universal style preferences; "project" scope for project-specific rules
- Maximum one suggestion per response
- Never duplicate existing preferences listed above
- Always include your regular response before the memory suggestion tag`;

      if (systemContent.trim()) {
        apiMessages.push({ role: "system", content: systemContent.trim() });
      }

      for (const msg of chatMessages) {
        const msgContent = msg.context
          ? `[Re: "${msg.context.text}"]\n\n${msg.content}`
          : msg.content;
        apiMessages.push({ role: msg.role, content: msgContent });
      }
      apiMessages.push({ role: "user", content: apiUserMsg });

      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        signal: abortRef.current?.signal,
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          messages: apiMessages,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Streaming failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      const parser = createStreamParser();
      let lastApplyTime = 0;
      let appliedDocument = false;

      const finalize = () => {
        const finalState = parser.getState();
        let assistantContent = "";
        if (finalState.mode === "document_edit") {
          // Apply final document content to the captured editor (may be unmounted)
          if (finalState.documentContent) {
            if (targetEditor) {
              try { targetEditor.replaceContentDiff(finalState.documentContent); } catch (_) {}
              setTimeout(() => {
                try {
                  targetEditor.showDiffHighlights();
                  const stats = targetEditor.getDiffStats();
                  setDiffStats(stats);
                  setDiffVisible(true);
                  setDiffAvailable(true);
                  setCompareVersionId(null);
                } catch (_) {}
              }, 400);
            }
            // Publish AI suggestion to collaborators if sharing is enabled
            if (collabSession && localStorage.getItem("marvin:ai-visible") === "true") {
              collabSession.publishAiSuggestion(
                user?.id,
                preEditDraftRef.current || "",
                finalState.documentContent
              );
            }
            // Always persist to the correct node via API, regardless of navigation
            if (targetNodeId) {
              api.updateNode(targetNodeId, { content_md: finalState.documentContent })
                .then((updated) => {
                  setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
                })
                .catch(() => {});
            }
          }
          assistantContent = finalState.chatContent || "I've updated the document.";
          setChatMessages((prev) => [...prev, { role: "assistant", content: assistantContent, isDocumentEdit: true, routedAgentId, routedAgentName }]);
        } else {
          assistantContent = fullContent;
          if (fullContent) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent, routedAgentId, routedAgentName }]);
          }
        }
        // Persist assistant message
        if (convId && assistantContent) {
          api.createMessage({ conversation: convId, role: "assistant", content: assistantContent, routed_agent: routedAgentId }).catch(() => {});
        }
        // Check for memory suggestion in AI response
        const finalParserState = parser.getState();
        if (finalParserState.memorySuggestion) {
          setPendingMemorySuggestion(finalParserState.memorySuggestion);
        }
        setStreamingContent("");
        setIsStreaming(false);
        setIsEditingDocument(false);
      };

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
          if (data === "[DONE]") {
            finalize();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Error: " + parsed.error },
              ]);
              setStreamingContent("");
              setIsStreaming(false);
              setIsEditingDocument(false);
              return;
            }
            if (parsed.delta) {
              fullContent += parsed.delta;
              const state = parser.push(parsed.delta);

              if (state.mode === "document_edit") {
                setIsEditingDocument(true);
                // Typewriter: apply partial content throttled every ~200ms
                const now = Date.now();
                if (state.documentContent && targetEditor && now - lastApplyTime >= 80) {
                  try { targetEditor.replaceContentDiff(state.documentContent, { streaming: true }); } catch (_) {}
                  lastApplyTime = now;
                  appliedDocument = true;
                }
                // Show chat message portion (streams in after </document>)
                setStreamingContent(state.chatContent || "");
              } else if (state.mode === "chat") {
                setStreamingContent(fullContent);
              }
              // mode === "pending": don't update streaming content yet
            }
          } catch (_) {}
        }
      }

      finalize();
    } catch (error) {
      if (error.name === "AbortError") {
        // User stopped streaming — finalize partial content
        const partial = streamingContent;
        if (partial) {
          setChatMessages((prev) => [...prev, { role: "assistant", content: partial }]);
        }
        setStreamingContent("");
        setIsEditingDocument(false);
      } else {
        let errorText = error.message;
        try {
          const parsed = JSON.parse(errorText);
          errorText = parsed.detail || parsed.error || errorText;
        } catch (_) {}
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: " + errorText },
        ]);
        setStreamingContent("");
        setIsEditingDocument(false);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      if (collabSession) collabSession.setAiMode("idle");
    }
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleSendMessage = () => handleSendMessageDirect();

  const handleUndoEdit = () => {
    if (preEditDraftRef.current != null && editorRef.current) {
      editorRef.current.replaceContent(preEditDraftRef.current);
      editorRef.current.clearAiHighlights();
      setDiffVisible(false);
      setDiffAvailable(false);
      setDiffStats(null);
      setCompareVersionId(null);
      // Persist undo
      if (activeNodeId) {
        api.updateNode(activeNodeId, { content_md: preEditDraftRef.current }).catch(() => {});
      }
      preEditDraftRef.current = null;
    }
  };

  const handleAcceptEdit = () => {
    if (editorRef.current) {
      editorRef.current.clearAiHighlights();
    }
    setDiffVisible(false);
    setDiffAvailable(false);
    setDiffStats(null);
    setCompareVersionId(null);
    preEditDraftRef.current = null;
  };


  const handleSuggestionAction = (prompt) => {
    if (prompt === "Review selection" && pendingContext) {
      // Route to review endpoint scoped to selection
      handleRequestReview("all");
      return;
    }
    handleSendMessageDirect(prompt);
  };

  const handleSummarize = async () => {
    if (isStreaming || !activeNode || activeNode.type !== "file" || !draft.trim()) return;
    setIsAssistantOpen(true);
    const userMsg = `Summarize the chapter "${activeNode.title}"`;
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setStreamingContent("");

    // Create conversation for summarize action
    let convId = activeConversationId;
    try {
      if (!convId) {
        const conv = await api.createConversation({ node: Number(activeNode.id), title: userMsg });
        convId = conv.id;
        setActiveConversationId(conv.id);
        setConversations((prev) => [conv, ...prev]);
      }
      if (convId) {
        api.createMessage({ conversation: convId, role: "user", content: userMsg }).catch(() => {});
      }
    } catch { /* non-blocking */ }

    try {
      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          provider: defaultAgent.provider,
          model: defaultAgent.model,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a writing assistant. Provide a concise summary of the following chapter content. " +
                "Highlight key themes, main arguments, and important details. Keep the summary to 2-4 paragraphs.",
            },
            {
              role: "user",
              content: `Please summarize this chapter titled "${activeNode.title}":\n\n${draft}`,
            },
          ],
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Summarization failed");
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
          const lines = event.split("\n");
          const dataLines = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (!dataLines.length) continue;
          const data = dataLines.join("\n");
          if (data === "[DONE]") {
            setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
            if (convId && fullContent) {
              api.createMessage({ conversation: convId, role: "assistant", content: fullContent }).catch(() => {});
            }
            setStreamingContent("");
            setIsStreaming(false);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              fullContent += parsed.delta;
              setStreamingContent(fullContent);
            }
          } catch (_) {}
        }
      }

      if (fullContent) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
        if (convId) {
          api.createMessage({ conversation: convId, role: "assistant", content: fullContent }).catch(() => {});
        }
      }
      setStreamingContent("");
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: " + error.message },
      ]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleRestoreVersion = (version) => {
    const md = version.content_md || "";
    setDraft(md);
    loadedContentRef.current = md;
    setCompareVersionId(null);
    if (editorRef.current) {
      editorRef.current.replaceContent(md);
    }
  };

  const handleCompareVersion = useCallback((version) => {
    if (!editorRef.current) return;
    if (compareVersionId === version.id) {
      // Toggle off
      editorRef.current.clearAiHighlights();
      setDiffVisible(false);
      setDiffAvailable(false);
      setDiffStats(null);
      setCompareVersionId(null);
      return;
    }
    editorRef.current.compareWithVersion(version.content_md || "");
    const stats = editorRef.current.getDiffStats();
    setDiffStats(stats);
    setDiffVisible(true);
    setDiffAvailable(true);
    setCompareVersionId(version.id);
  }, [compareVersionId]);

  const handleToggleDiff = useCallback(() => {
    if (!editorRef.current) return;
    if (diffVisible) {
      editorRef.current.hideAiDiffHighlights();
      setDiffVisible(false);
    } else {
      editorRef.current.showDiffHighlights();
      const stats = editorRef.current.getDiffStats();
      setDiffStats(stats);
      setDiffVisible(true);
    }
  }, [diffVisible]);

  const handleSaveProviderKey = async (provider, apiKey) => {
    const existing = providerKeyMap.get(provider);
    const payload = { provider, api_key: apiKey };
    if (existing) { await api.updateProviderKey(existing.id, payload); }
    else { await api.createProviderKey(payload); }
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
  };

  const handleClearProviderKey = async (provider) => {
    const existing = providerKeyMap.get(provider);
    if (!existing) throw new Error("No key to clear.");
    await api.updateProviderKey(existing.id, { api_key: "" });
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
  };

  // --- Sidebar tree helpers ---
  const handleExpandNode = useCallback((nodeId) => {
    setExpandedFolders((prev) => new Set([...prev, nodeId]));
  }, []);

  const handleCollapseNode = useCallback((nodeId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const handleHoverStart = useCallback((node, rect) => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverPreview({ node, rect });
    }, 300);
  }, []);

  const handleHoverEnd = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    // Delay clearing to allow mouse to move to tooltip
    hoverTimerRef.current = setTimeout(() => {
      setHoverPreview(null);
    }, 100);
  }, []);

  const handlePreviewMouseEnter = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
  }, []);

  const handlePreviewMouseLeave = useCallback(() => {
    setHoverPreview(null);
  }, []);

  // Flatten visible tree for keyboard navigation
  const flatVisibleNodes = useMemo(() => {
    const result = [];
    const walk = (items) => {
      for (const item of items) {
        result.push(item);
        if (item.type === "folder" && expandedFolders.has(String(item.id)) && item.children?.length) {
          walk(item.children);
        }
      }
    };
    walk(tree);
    return result;
  }, [tree, expandedFolders]);

  const handleTreeKeyDown = useCallback((e) => {
    if (!flatVisibleNodes.length) return;
    const currentIndex = flatVisibleNodes.findIndex((n) => String(n.id) === String(focusedNodeId));

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = currentIndex < flatVisibleNodes.length - 1 ? currentIndex + 1 : 0;
        setFocusedNodeId(String(flatVisibleNodes[nextIndex].id));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatVisibleNodes.length - 1;
        setFocusedNodeId(String(flatVisibleNodes[prevIndex].id));
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        // If on a child item, move focus to parent
        const current = flatVisibleNodes[currentIndex];
        if (current && current.parent) {
          setFocusedNodeId(String(current.parent));
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        setFocusedNodeId(String(flatVisibleNodes[0].id));
        break;
      }
      case "End": {
        e.preventDefault();
        setFocusedNodeId(String(flatVisibleNodes[flatVisibleNodes.length - 1].id));
        break;
      }
      default:
        break;
    }
  }, [flatVisibleNodes, focusedNodeId]);

  // Close create menu on outside click
  useEffect(() => {
    if (!createMenuOpen) return;
    const handler = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [createMenuOpen]);

  // Click-outside for doc overflow menu
  useEffect(() => {
    if (!docMenuOpen) return;
    const handler = (e) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target)) setDocMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [docMenuOpen]);

  // --- Sidebar resize ---
  const handleOutlineDividerMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = outlineWidth;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setOutlineWidth(Math.max(180, Math.min(320, startWidth + delta)));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // --- Pane resize ---
  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = assistantWidth;

    const onMouseMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      setAssistantWidth(Math.max(280, Math.min(600, startWidth + delta)));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // --- Drag & drop ---
  const handleDragStart = (event, node) => {
    event.dataTransfer.setData("text/plain", String(node.id));
    setDraggingId(String(node.id));
    setHoverPreview(null);
    clearTimeout(hoverTimerRef.current);
  };
  const handleDragOverNode = (event, node) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const threshold = rect.height * 0.25;

    if (node.type === "folder") {
      // Folders: top quarter = before, middle = inside, bottom quarter = after
      if (y < threshold) {
        setDropPosition("before");
      } else if (y > rect.height - threshold) {
        setDropPosition("after");
      } else {
        setDropPosition("inside");
      }
    } else {
      // Files: top half = before, bottom half = after
      setDropPosition(y < rect.height / 2 ? "before" : "after");
    }
    setDropTargetId(String(node.id));
  };
  const handleDrop = async (event, targetNode) => {
    event.preventDefault();
    const draggedId = normalizeId(draggingId || event.dataTransfer.getData("text/plain"));
    if (!draggedId || String(draggedId) === String(targetNode.id)) {
      setDraggingId(null);
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }
    const draggedNode = nodesById.get(String(draggedId));
    if (!draggedNode) return;

    let newParent;
    if (dropPosition === "inside" && targetNode.type === "folder") {
      newParent = targetNode.id;
    } else {
      newParent = targetNode.parent ?? null;
    }

    if (newParent === draggedNode.parent && targetNode.id === draggedNode.id) return;
    if (String(newParent) === String(draggedId)) return;
    if (newParent && isDescendant(newParent, draggedId)) return;
    const updated = await api.updateNode(Number(draggedId), {
      parent: newParent,
      order: getNextOrder(newParent),
    });
    setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
    setDraggingId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };
  const handleDragEnd = () => { setDraggingId(null); setDropTargetId(null); setDropPosition(null); };

  // --- User menu click-outside ---
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserMenuOpen]);

  const userInitials = useMemo(() => {
    if (!user?.name) return "?";
    return user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }, [user?.name]);

  // --- Render ---
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="brand-name-btn" onClick={() => { setActiveProjectId(null); setActiveNodeId(null); }}>Marvin</button>
          <span className="topbar-divider" />
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            nodes={nodes}
            onSelect={setActiveProjectId}
            onCreate={handleCreateProject}
            onQuickCreate={handleQuickCreate}
            onDelete={handleDeleteProject}
            onRename={handleRenameProject}
            onOpenSettings={(projectId) => {
              setActiveProjectId(projectId);
              setActiveNodeId(null);
            }}
          />
        </div>
        <div className="topbar-actions">
          <button
            className={`topbar-icon-btn ${isOutlineOpen ? "active" : ""}`}
            onClick={() => setIsOutlineOpen((prev) => !prev)}
            aria-label="Toggle outline"
            title="Outline"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
          {currentRole !== "viewer" && (
            <button
              className={`topbar-icon-btn ${isAssistantOpen ? "active" : ""}`}
              onClick={() => setIsAssistantOpen((prev) => !prev)}
              aria-label="Toggle assistant"
              title="Assistant"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" />
                <path d="M19 10l.75 1.7 1.75.8-1.75.8L19 15l-.75-1.7-1.75-.8 1.75-.8Z" />
                <path d="M9 17l.6 1.3 1.4.7-1.4.6L9 21l-.6-1.4-1.4-.6 1.4-.7Z" />
              </svg>
            </button>
          )}
          {activeProjectId && (() => {
            const p = projects.find((pr) => pr.id === activeProjectId);
            return (p?.current_user_role === "owner" || p?.current_user_role === "admin") ? (
              <button
                className="topbar-icon-btn"
                onClick={() => setIsShareOpen(true)}
                title="Share"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            ) : null;
          })()}
          {collabSession && <PresenceIndicator awareness={collabSession.awareness} />}
          <span className="topbar-divider" />
          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              className={`topbar-avatar${isUserMenuOpen ? " active" : ""}`}
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              aria-label="User menu"
              title={user?.name || "Account"}
            >
              {userInitials}
            </button>
            {isUserMenuOpen && (
              <div className="user-menu">
                <div className="user-menu-header">
                  <span className="user-menu-name">{user?.name}</span>
                  <span className="user-menu-email">{user?.email}</span>
                </div>
                <div className="user-menu-divider" />
                <button
                  className="user-menu-item"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Settings
                </button>
                <button
                  className="user-menu-item user-menu-item--danger"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <InvitationBanner onAccepted={() => api.listProjects().then(setProjects)} />

      {isWizardOpen ? (
        <ProjectWizard
          onComplete={handleWizardComplete}
          onCancel={() => setIsWizardOpen(false)}
          defaultAgent={defaultAgent}
          apiBase={API_BASE}
        />
      ) : showWalkthrough ? (
        <WelcomeWalkthrough
          onComplete={handleWalkthroughComplete}
          onSkip={handleWalkthroughSkip}
          defaultAgent={defaultAgent}
          apiBase={API_BASE}
        />
      ) : (
      <div className="app">
        <aside
          className={`outline-rail ${isOutlineOpen && activeProjectId ? "" : "collapsed"}`}
          style={isOutlineOpen && activeProjectId ? { width: `${outlineWidth}px` } : undefined}
        >
          {activeProjectId && (
            <button className="rail-project-header" onClick={() => setActiveNodeId(null)} title="Go to project overview">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 0 1-1 1h-3V10H6.5v4h-3a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
              </svg>
              <span className="rail-project-name">Overview</span>
            </button>
          )}
          <div className="rail-header">
            <div className="rail-search-wrapper">
              <svg className="rail-search-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                ref={outlineFilterRef}
                className={`rail-search-input ${searchResults !== null ? "searching" : ""}`}
                type="text"
                placeholder="Search..."
                value={outlineFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setOutlineFilter(val);
                  clearTimeout(searchTimerRef.current);
                  if (val.trim().length >= 3 && activeProjectId) {
                    setIsSearching(true);
                    searchTimerRef.current = setTimeout(() => {
                      api.searchNodes(activeProjectId, val.trim()).then((results) => {
                        setSearchResults(results);
                        setIsSearching(false);
                      }).catch(() => {
                        setSearchResults([]);
                        setIsSearching(false);
                      });
                    }, 500);
                  } else {
                    setSearchResults(null);
                    setIsSearching(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOutlineFilter("");
                    setSearchResults(null);
                    setIsSearching(false);
                    clearTimeout(searchTimerRef.current);
                    e.target.blur();
                  }
                  if (e.key === "Enter" && outlineFilter.trim().length >= 3 && activeProjectId) {
                    clearTimeout(searchTimerRef.current);
                    setIsSearching(true);
                    api.searchNodes(activeProjectId, outlineFilter.trim()).then((results) => {
                      setSearchResults(results);
                      setIsSearching(false);
                    }).catch(() => {
                      setSearchResults([]);
                      setIsSearching(false);
                    });
                  }
                }}
              />
              {outlineFilter && (
                <button
                  className="rail-search-clear"
                  onClick={() => { setOutlineFilter(""); setSearchResults(null); setIsSearching(false); clearTimeout(searchTimerRef.current); outlineFilterRef.current?.focus(); }}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <div className="rail-create-wrapper" ref={createMenuRef}>
              <button
                className="rail-create-btn"
                onClick={() => setCreateMenuOpen((v) => !v)}
                aria-label="Create new"
                title="New file or folder"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {createMenuOpen && (
                <div className="rail-create-menu">
                  <button
                    className="rail-create-menu-item"
                    onClick={() => { setCreateMenuOpen(false); handleCreateNode("file"); }}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M4.5 1.5h4.586a1 1 0 0 1 .707.293l2.914 2.914a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M9 1.5v3a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    New file
                  </button>
                  <button
                    className="rail-create-menu-item"
                    onClick={() => { setCreateMenuOpen(false); handleCreateNode("folder"); }}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M1.5 3.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.5 4.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    New folder
                  </button>
                </div>
              )}
            </div>
          </div>
          {searchResults !== null ? (
            <div className="search-results">
              {isSearching && (
                <div className="search-loading">Searching...</div>
              )}
              {!isSearching && searchResults.length === 0 && (
                <div className="search-empty">No results found</div>
              )}
              {!isSearching && searchResults.map((result) => (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  onSelect={(node) => {
                    handleSelectNode(node);
                    setOutlineFilter("");
                    setSearchResults(null);
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              className="tree"
              role="tree"
              onKeyDown={handleTreeKeyDown}
            >
              {tree.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  activeNodeId={activeNodeId}
                  onSelect={handleSelectNode}
                  onRename={handleRenameNode}
                  onDelete={handleDeleteNode}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOverNode}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  dropTargetId={dropTargetId}
                  dropPosition={dropPosition}
                  draggingId={draggingId}
                  agentNodeIds={agentNodeIds}
                  focusedNodeId={focusedNodeId}
                  onFocusNode={setFocusedNodeId}
                  onExpandNode={handleExpandNode}
                  onCollapseNode={handleCollapseNode}
                  expandedFolders={expandedFolders}
                  filterText={searchResults === null ? outlineFilter : ""}
                  showMeta={outlineWidth >= 240}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
              ))}
              {tree.length === 0 && (
                <div className="tree-empty-state">
                  <p>No documents yet</p>
                  <button
                    className="tree-empty-action"
                    onClick={() => handleCreateNode("file")}
                  >
                    Create your first document
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
        {hoverPreview && String(hoverPreview.node.id) !== String(activeNodeId) && (
          <NodePreviewTooltip
            node={hoverPreview.node}
            rect={hoverPreview.rect}
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={handlePreviewMouseLeave}
          />
        )}
        {isOutlineOpen && (
          <div
            className="outline-divider"
            onMouseDown={handleOutlineDividerMouseDown}
            onDoubleClick={() => setOutlineWidth(220)}
          />
        )}

        <main className={`editor-area${isAssistantOpen ? ' with-assistant' : ''}`}>
          {activeNode?.type === "file" && (
            <div className="editor-content" ref={editorWrapperRef}>
              <div className="document-header">
                <h1
                  className="editable-title"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => {
                    const newTitle = e.target.textContent.trim();
                    if (newTitle && newTitle !== activeNode.title) {
                      handleRenameNode(activeNode.id, newTitle);
                    } else {
                      e.target.textContent = activeNode.title;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
                    if (e.key === "Escape") { e.target.textContent = activeNode.title; e.target.blur(); }
                  }}
                >
                  {activeNode.title}
                </h1>
                <div className="document-meta">
                  <span className="word-count">{wordCount} words</span>
                  <span className="save-status">
                    {saveStatus === "saving" && "Saving…"}
                    {saveStatus === "saved" && "Saved"}
                  </span>
                  <div className="doc-actions">
                    <VersionsMenu versions={versions} onRestore={handleRestoreVersion} onCompare={handleCompareVersion} activeCompareId={compareVersionId} />
                    <ExportMenu
                      node={activeNode}
                      project={projects.find(p => p.id === activeProjectId)}
                      nodes={nodes}
                      onPublish={(platform, connection) => setPublishState({ platform, connection })}
                    />
                    <button
                      className="review-btn"
                      onClick={() => handleFactCheck()}
                      disabled={isFactChecking || !draft.trim()}
                      title="Fact-check document"
                      style={{ marginRight: 4 }}
                    >
                      {isFactChecking ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 16 16" style={{ animation: "spin 0.8s linear infinite" }}>
                            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
                          </svg>
                          {factCheckProgress
                            ? `${factCheckProgress.done}/${factCheckProgress.total}`
                            : "Extracting…"}
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M13.5 4.5L6.5 11.5L2.5 7.5" />
                          </svg>
                          Fact-Check
                        </>
                      )}
                    </button>
                    <div className="doc-more" ref={docMenuRef}>
                      <button
                        className="doc-more-btn"
                        onClick={() => setDocMenuOpen((v) => !v)}
                        title="More actions"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/></svg>
                      </button>
                      {docMenuOpen && (
                        <div className="doc-more-dropdown">
                          {["all", "grammar", "clarity", "style"].map((f) => (
                            <button
                              key={f}
                              className="doc-more-item"
                              onClick={() => { handleRequestReview(f); setDocMenuOpen(false); }}
                              disabled={isReviewing || !draft.trim()}
                            >
                              {isReviewing && f === "all" ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 16 16" style={{ animation: "spin 0.8s linear infinite" }}>
                                    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
                                  </svg>
                                  Reviewing…
                                </>
                              ) : `Review ${f}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {(openComments.length > 0 || diffAvailable || reviewEmptyMsg) && (
                <div className="review-bar">
                  {diffAvailable && (
                    <button
                      className={`diff-toggle-btn${diffVisible ? " active" : ""}`}
                      onClick={handleToggleDiff}
                      title={diffVisible ? "Hide changes" : "Show changes"}
                    >
                      {diffStats && (diffStats.modified + diffStats.added + diffStats.deleted) > 0
                        ? `${diffStats.modified + diffStats.added + diffStats.deleted} changes`
                        : "Changes"}
                    </button>
                  )}
                  {openComments.length > 0 && (
                    <>
                      <div className="comment-nav">
                        <button
                          className="comment-nav-btn"
                          onClick={handleNavPrev}
                          title="Previous comment (⌘⇧↑)"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 6.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <span className="comment-nav-count">
                          {focusedNavIndex >= 0 ? focusedNavIndex + 1 : "–"}/{navTotal}
                        </span>
                        <button
                          className="comment-nav-btn"
                          onClick={handleNavNext}
                          title="Next comment (⌘⇧↓)"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                      {hasReviewProgress && (
                        <span className="review-progress">
                          {reviewResolved}/{reviewComments.length} resolved
                        </span>
                      )}
                    </>
                  )}
                  {reviewEmptyMsg && (
                    <span className="review-empty-msg">No suggestions</span>
                  )}
                </div>
              )}

              {collabSession && (
                <ConnectionBanner
                  connectionState={connectionStatus}
                  onRetry={() => collabSession.provider.connect()}
                />
              )}

              {collabSession && (
                <AiSuggestionBanner
                  aiSuggestions={collabSession.aiSuggestions}
                  currentUserId={user?.id}
                  onViewDiff={(s) => {
                    editorRef.current?.compareWithVersion(s.oldMarkdown);
                  }}
                  onAccept={(s) => {
                    editorRef.current?.replaceContentDiff(s.newMarkdown);
                    collabSession.clearAiSuggestion(s.userId);
                  }}
                  onReject={(s) => {
                    collabSession.clearAiSuggestion(s.userId);
                  }}
                />
              )}

              <section
                className="editor-section"
                style={{ '--editor-zoom': editorZoom / 100 }}
                onClick={() => editorRef.current?.focus()}
              >
                <MarkdownEditor
                  key={activeNode.id}
                  docId={activeNode.id}
                  value={activeNode.content_md || ""}
                  onChange={setDraft}
                  comments={decorationComments}
                  editorRef={editorRef}
                  readOnly={currentRole === "viewer"}
                  currentRole={currentRole}
                  collabSession={collabSession}
                />
              </section>

              <div className="editor-status-bar">
                <span className="zoom-control">
                  <button
                    className="zoom-btn"
                    onClick={() => setEditorZoom((z) => Math.max(z - 10, 75))}
                    disabled={editorZoom <= 75}
                    aria-label="Zoom out"
                    title="Zoom out (⌘−)"
                  >A−</button>
                  <button
                    className="zoom-level"
                    onClick={() => setEditorZoom(100)}
                    title="Reset zoom (⌘0)"
                  >{editorZoom}%</button>
                  <button
                    className="zoom-btn"
                    onClick={() => setEditorZoom((z) => Math.min(z + 10, 150))}
                    disabled={editorZoom >= 150}
                    aria-label="Zoom in"
                    title="Zoom in (⌘+)"
                  >A+</button>
                </span>
              </div>
            </div>
          )}

          {activeNode?.type === "folder" && (
            <FolderView
              activeNode={activeNode}
              folderSummary={folderSummary}
              childrenMap={childrenMap}
              nodesById={nodesById}
              allNodes={nodes}
              onSelectNode={handleSelectNode}
              onCreateNode={handleCreateNode}
              onRenameNode={handleRenameNode}
              canEdit={canEdit}
              onUpdateNode={(nodeId, updates) => {
                api.updateNode(nodeId, updates).then((updated) => {
                  setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
                }).catch(() => {});
              }}
            />
          )}

          {!activeNode && activeProjectId && (
            <ProjectHome
              project={projects.find((p) => p.id === activeProjectId)}
              nodes={nodes}
              agents={agents}
              onUpdate={(updates) => {
                api.updateProject(activeProjectId, updates).then((updated) => {
                  setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                }).catch(() => {});
              }}
              onDelete={() => handleDeleteProject(activeProjectId)}
              onEditAgent={openAgentEditor}
              onCreateAgent={openAgentCreator}
            />
          )}

          {!activeNode && !activeProjectId && (
            <AllProjects
              projects={projects}
              onSelect={setActiveProjectId}
              onCreate={() => setIsWizardOpen(true)}
            />
          )}
        </main>

        <div
          className={`pane-divider${!isAssistantOpen ? ' hidden' : ''}`}
          onMouseDown={handleDividerMouseDown}
          onDoubleClick={() => setAssistantWidth(380)}
        />

        <AssistantPanel
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          messages={chatMessages}
          streamingContent={streamingContent}
          currentInput={chatInput}
          onInputChange={setChatInput}
          onSend={handleSendMessage}
          isStreaming={isStreaming}
          agents={agents}
          resolvedAgent={resolvedAgent}
          nodeDirectConfig={nodeDirectConfig}
          onAgentChange={handleAssignAgent}
          onCreateAgent={openAgentCreator}
          onEditAgent={openAgentEditor}
          onSuggestionAction={handleSuggestionAction}
          canSummarize={activeNode?.type === "file" && !!draft.trim()}
          isEditingDocument={isEditingDocument}
          width={assistantWidth}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onBackToList={handleBackToList}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onEscapeComposer={() => editorRef.current?.focus()}
          pendingContext={pendingContext}
          onClearContext={() => setPendingContext(null)}
          onStop={handleStopStreaming}
          diffVisible={diffVisible}
          diffAvailable={diffAvailable}
          diffStats={diffStats}
          onToggleDiff={handleToggleDiff}
          onUndoEdit={handleUndoEdit}
          onAcceptEdit={handleAcceptEdit}
          nodes={nodes}
          mentionedFileIds={mentionedFileIds}
          onMentionedFilesChange={setMentionedFileIds}
          memories={memories}
          onCreateMemory={handleCreateMemory}
          onDeleteMemory={handleDeleteMemory}
          pendingMemorySuggestion={pendingMemorySuggestion}
          onAcceptMemorySuggestion={async (suggestion) => {
            await handleCreateMemory(suggestion.content, suggestion.scope, "ai_suggested");
            setPendingMemorySuggestion(null);
          }}
          onDismissMemorySuggestion={() => setPendingMemorySuggestion(null)}
          memoryToast={memoryToast}
          onDismissMemoryToast={() => setMemoryToast(null)}
          activeProjectId={activeProjectId}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          activeTab={assistantTab}
          onTabChange={setAssistantTab}
          reviewTabComments={commentState.reviewTabComments}
          reviewPendingCount={commentState.reviewPendingCount}
          reviewAcceptedCount={commentState.reviewAcceptedCount}
          reviewDismissedCount={commentState.reviewDismissedCount}
          verifyTabComments={commentState.verifyTabComments}
          verifyPendingCount={commentState.verifyPendingCount}
          focusedCommentId={focusedCommentId}
          aiThinkingId={aiThinkingCommentId}
          getReplies={commentState.getReplies}
          onClickComment={(comment) => commentState.navigateTo(comment.id)}
          onApproveComment={handleApproveComment}
          onDismissComment={handleRejectComment}
          onResolveComment={handleResolveComment}
          onDeleteComment={handleDeleteComment}
          onReplyComment={handleReplyToComment}
          onAskAIComment={handleAskAIInThread}
          onLaunchReview={handleRequestReview}
          onLaunchFactCheck={handleFactCheck}
          isReviewing={isReviewing}
          isFactChecking={isFactChecking}
          factCheckProgress={factCheckProgress}
        />
      </div>
      )}

      <AgentCreatorSlideOver
        isOpen={isAgentCreatorOpen}
        onClose={() => { setIsAgentCreatorOpen(false); setEditingAgent(null); }}
        onCreate={handleCreateAgentFromCreator}
        onUpdate={handleUpdateAgent}
        onDelete={handleDeleteAgent}
        apiBase={API_BASE}
        agent={editingAgent}
      />

      {publishState && (
        <PublishDialog
          platform={publishState.platform}
          connection={publishState.connection}
          node={activeNode}
          project={projects.find(p => p.id === activeProjectId)}
          onClose={() => setPublishState(null)}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        providerKeyMap={providerKeyMap}
        onSaveProviderKey={handleSaveProviderKey}
        onClearProviderKey={handleClearProviderKey}
        autosaveDelay={autosaveDelay}
        onAutosaveDelayChange={setAutosaveDelay}
        defaultAgent={defaultAgent}
        onDefaultAgentChange={setDefaultAgent}
        memories={memories}
        activeProjectId={activeProjectId}
        onCreateMemory={handleCreateMemory}
        onDeleteMemory={handleDeleteMemory}
        onUpdateMemory={async (id, payload) => {
          try { await api.updateMemory(id, payload); refreshMemories(); } catch {}
        }}
        collabSession={collabSession}
      />

      <ShareDialog
        project={projects.find((p) => p.id === activeProjectId)}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onProjectUpdate={() => api.listProjects().then(setProjects)}
      />

      {commentInputState && (
        <CommentInput
          rect={commentInputState.rect}
          onSubmit={handleCreateInlineComment}
          onCancel={() => setCommentInputState(null)}
        />
      )}

      {activeThreadComment && (
        <CommentThread
          comment={activeThreadComment.comment}
          rect={activeThreadComment.rect}
          onClose={handleCloseThread}
          onApprove={handleApproveComment}
          onReject={handleRejectComment}
          onResolve={handleResolveComment}
          onDelete={handleDeleteComment}
          onReply={handleReplyToComment}
          onAskAI={handleAskAIInThread}
          isAIThinking={aiThinkingCommentId === activeThreadComment.comment.id}
          onPrev={navTotal > 1 ? handleNavPrev : undefined}
          onNext={navTotal > 1 ? handleNavNext : undefined}
          navLabel={navTotal > 1 && focusedNavIndex >= 0
            ? `${focusedNavIndex + 1}/${navTotal}`
            : undefined}
        />
      )}

      {showAppTour && (
        <SpotlightTour onComplete={() => setShowAppTour(false)} />
      )}
    </div>
  );
}
