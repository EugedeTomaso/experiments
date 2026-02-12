import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { MarkdownEditor } from "./MarkdownEditor";
import { TreeItem } from "./components/TreeItem";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { AssistantPanel } from "./components/AssistantPanel";
import { FolderView } from "./components/FolderView";
import { NodePreviewTooltip } from "./components/NodePreviewTooltip";
import { SearchResultItem } from "./components/SearchResultItem";
import { VersionsMenu } from "./components/VersionsMenu";
import { AgentCreatorSlideOver } from "./components/AgentCreatorSlideOver";
import { CommentInput } from "./components/CommentInput";
import { CommentPopover } from "./components/CommentPopover";
import { SettingsModal } from "./components/SettingsModal";
import { ProjectWizard } from "./components/ProjectWizard";
import { createStreamParser } from "./streamParser";
import { buildSnippet, wordCount } from "./utils";
import "./App.css";

const NEW_DOC_TEMPLATE = `\
Welcome to your new document. This guide will help you get started — feel free to delete it when you're ready to write.

## Formatting text

Select any text to reveal the formatting toolbar. You can apply:

- **Bold** for emphasis on key ideas
- *Italic* for titles, subtle stress, or foreign words
- ~~Strikethrough~~ to mark edits or crossed-out thoughts
- \`Inline code\` for technical terms, variables, or commands

You can also combine them: ***bold and italic***, or **\`bold code\`**.

## Using the slash menu

Type **/** at the beginning of a new line to open the command menu. From there you can insert:

- Headings (H1, H2, H3) to structure your document
- Bullet lists and numbered lists
- Blockquotes for callouts or citations
- Code blocks for multi-line snippets
- Horizontal dividers to separate sections

> This is a blockquote. Use it to highlight a quote, a key takeaway, or an important note.

## Working with AI

Open the **Assistant** panel using the button in the top-right corner. The AI can help you at any stage of writing. Here are some things you can ask:

- "Help me outline an article about remote work best practices"
- "Rewrite the second paragraph in a more conversational tone"
- "What are the main arguments in my document so far?"
- "Suggest a better title for this piece"
- "Translate the last section to Spanish"
- "Shorten this to fit in a tweet"

The assistant reads your document, so you can reference specific sections or ask it to work with what you've already written.

## Keyboard shortcuts

A few shortcuts to speed up your workflow:

- **Ctrl+B** / **⌘B** — Bold
- **Ctrl+I** / **⌘I** — Italic
- **Ctrl+Z** / **⌘Z** — Undo
- **Ctrl+Shift+Z** / **⌘⇧Z** — Redo

---

*Delete this guide and start writing. Your changes save automatically.*
`;

const INITIAL_DEFAULT_AGENT = {
  provider: "deepseek",
  model: "deepseek-chat",
  temperature: 0.7,
  system_prompt: "",
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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
  // --- Project & Node state ---
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);

  // --- Editor state ---
  const [draft, setDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved'
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);
  const autoSaveTimerRef = useRef(null);
  const loadedContentRef = useRef("");
  const pendingSaveRef = useRef(null); // { nodeId, content } or null
  const abortRef = useRef(null);
  const preEditDraftRef = useRef(null);

  // --- Layout state ---
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(() => {
    const saved = localStorage.getItem("marvin:assistant-width");
    return saved ? Number(saved) : 380;
  });

  // --- Chat state ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffAvailable, setDiffAvailable] = useState(false);

  // --- Conversation state ---
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // --- AI context from editor selection ---
  const [pendingContext, setPendingContext] = useState(null);

  // --- Agent state ---
  const [agents, setAgents] = useState([]);
  const [nodeAgentConfigs, setNodeAgentConfigs] = useState([]);
  const [resolvedAgent, setResolvedAgent] = useState(null);
  const [nodeDirectConfig, setNodeDirectConfig] = useState(null);
  const [isAgentCreatorOpen, setIsAgentCreatorOpen] = useState(false);

  // --- Wizard state ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // --- Settings state ---
  const [providerKeys, setProviderKeys] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // --- Inline comment state ---
  const [commentInputState, setCommentInputState] = useState(null);
  const [popoverState, setPopoverState] = useState(null);
  const editorRef = useRef(null);
  const editorWrapperRef = useRef(null);

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
    if (!activeProjectId) return;
    api.listNodes(activeProjectId).then((data) => {
      setNodes(data);
      // Auto-expand all folders on load
      const folderIds = new Set(data.filter((n) => n.type === "folder").map((n) => String(n.id)));
      setExpandedFolders(folderIds);
      if (!activeNodeId) {
        const firstFile = data.find((n) => n.type === "file");
        if (firstFile) setActiveNodeId(String(firstFile.id));
      }
    }).catch(() => {});
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) { setAgents([]); return; }
    api.listAgents(activeProjectId).then(setAgents).catch(() => setAgents([]));
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
    setActiveNodeId(null);
  }, [activeProjectId]);

  useEffect(() => {
    // Flush any pending auto-save for the previous node
    clearTimeout(autoSaveTimerRef.current);
    if (pendingSaveRef.current) {
      const { nodeId, content } = pendingSaveRef.current;
      api.updateNode(nodeId, { content_md: content }).catch(() => {});
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
      api.listComments(node.id).then(setComments).catch(() => setComments([]));
      api.listVersions(node.id).then(setVersions).catch(() => setVersions([]));
    } else {
      setDraft("");
      loadedContentRef.current = "";
      setSaveStatus("saved");
      setComments([]);
      setVersions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  // Auto-save with debounce
  useEffect(() => {
    if (!activeNodeId) return;
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
  }, [draft, autosaveDelay]);

  // Clear diff toggle when user edits and plugin clears its data
  useEffect(() => {
    if (diffAvailable && editorRef.current) {
      if (!editorRef.current.hasDiffData()) {
        setDiffAvailable(false);
        setDiffVisible(false);
      }
    }
  }, [draft, diffAvailable]);

  // Load conversations when node changes; reset chat state
  useEffect(() => {
    setChatMessages([]);
    setStreamingContent("");
    setChatInput("");
    setActiveConversationId(null);
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
      const matching = comments.filter((c) => commentIds.includes(c.id));
      if (matching.length) {
        setPopoverState({ comments: matching, rect });
      }
    },
    [comments]
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

    el.addEventListener("comment-selection-request", onSelectionRequest);
    el.addEventListener("comment-highlight-click", onHighlightClick);
    el.addEventListener("ai-selection-request", onAiRequest);
    return () => {
      el.removeEventListener("comment-selection-request", onSelectionRequest);
      el.removeEventListener("comment-highlight-click", onHighlightClick);
      el.removeEventListener("ai-selection-request", onAiRequest);
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

  const handleWizardComplete = async ({ name, structure }) => {
    setIsWizardOpen(false);
    const project = await api.createProject({ name });
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
          content_md: "",
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
    const comment = await api.createComment({
      node: activeNode.id,
      body,
      quoted_text: commentInputState.text,
      position_from: commentInputState.from,
      position_to: commentInputState.to,
    });
    setComments((prev) => [...prev, comment]);
    setCommentInputState(null);
  };

  const handleAssignAgent = async (agentId) => {
    if (!activeNode) return;
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
    const configs = await api.listAgentConfigs({ node: activeNode.id });
    setNodeDirectConfig(configs.length ? configs[0] : null);
    const resolved = await api.resolveAgentConfig({ node: activeNode.id });
    setResolvedAgent(resolved);
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

  const handleSendMessageDirect = async (overrideMsg) => {
    const rawMsg = overrideMsg || chatInput;
    if (!rawMsg.trim() || isStreaming || !activeProjectId) return;

    abortRef.current = new AbortController();
    const userMsg = rawMsg.trim();
    // Build the API message with optional context
    const context = pendingContext;
    const apiUserMsg = context
      ? `[Re: "${context.text}"]\n\n${userMsg}`
      : userMsg;
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg, context: context || undefined }]);
    setChatInput("");
    setPendingContext(null);
    setIsStreaming(true);
    setStreamingContent("");
    setIsEditingDocument(false);
    setDiffAvailable(false);
    setDiffVisible(false);
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
      const resolved = await api.resolveAgentConfig(
        activeNode ? { node: activeNode.id } : { project: activeProjectId }
      );
      const config = { ...defaultAgent, ...(resolved?.config || {}) };

      const apiMessages = [];
      let systemContent = config.system_prompt || "";
      if (activeNode?.type === "file") {
        systemContent += `\n\nThe user is working on a document titled "${activeNode.title}". Current content:\n\n${draft}`;
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
- Never omit the <message> tag when you include a <document> tag`;
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
        systemContent += "\n\n" + summaryLines.join("\n");
      }
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
        headers: { "Content-Type": "application/json" },
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
                  setDiffVisible(true);
                  setDiffAvailable(true);
                } catch (_) {}
              }, 400);
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
          setChatMessages((prev) => [...prev, { role: "assistant", content: assistantContent, isDocumentEdit: true }]);
        } else {
          assistantContent = fullContent;
          if (fullContent) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
          }
        }
        // Persist assistant message
        if (convId && assistantContent) {
          api.createMessage({ conversation: convId, role: "assistant", content: assistantContent }).catch(() => {});
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
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error: " + error.message },
        ]);
        setStreamingContent("");
        setIsEditingDocument(false);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
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
      // Persist undo
      if (activeNodeId) {
        api.updateNode(activeNodeId, { content_md: preEditDraftRef.current }).catch(() => {});
      }
      preEditDraftRef.current = null;
    }
  };


  const handleSuggestionAction = (prompt) => {
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
        headers: { "Content-Type": "application/json" },
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

  const handleRestoreVersion = (version) => setDraft(version.content_md || "");

  const handleToggleDiff = useCallback(() => {
    if (!editorRef.current) return;
    if (diffVisible) {
      editorRef.current.hideAiDiffHighlights();
      setDiffVisible(false);
    } else {
      editorRef.current.showDiffHighlights();
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

  // --- Render ---
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-name">Marvin</span>
          <span className="topbar-divider" />
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            onCreate={handleCreateProject}
          />
        </div>
        <div className="topbar-actions">
          <button
            className={`topbar-icon-btn ${isOutlineOpen ? "active" : ""}`}
            onClick={() => setIsOutlineOpen((prev) => !prev)}
            aria-label="Toggle outline"
            title="Outline"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M4 6h16M4 12h10M4 18h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            className={`topbar-icon-btn ${isAssistantOpen ? "active" : ""}`}
            onClick={() => setIsAssistantOpen((prev) => !prev)}
            aria-label="Toggle assistant"
            title="Assistant"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M9.937 4.562 11.5 1l1.563 3.562L16.625 6.5l-3.562 1.063L11.5 11.125 9.937 7.563 6.375 6.5Zm7.063 5.938L18.25 8l1.25 2.5L22 11.75l-2.5 1.25L18.25 15.5 17 13l-2.5-1.25ZM9.937 14.438 11.5 11l1.563 3.438L16.625 16l-3.562 1.563L11.5 21l-1.563-3.437L6.375 16Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className={`topbar-icon-btn ${isSettingsOpen ? "active" : ""}`}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-label="Settings"
            title="Settings"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53a7.76 7.76 0 0 0 .07-1 7.76 7.76 0 0 0-.07-.97l2.11-1.63a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.15 7.15 0 0 0-1.65-.96l-.37-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65a7.68 7.68 0 0 0-1.65.96l-2.49-1a.49.49 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64L4.57 11a8.3 8.3 0 0 0-.07.97 8.3 8.3 0 0 0 .07 1l-2.11 1.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1a7.15 7.15 0 0 0 1.65.96l.37 2.65a.5.5 0 0 0 .5.47h4a.5.5 0 0 0 .49-.42l.38-2.65a7.68 7.68 0 0 0 1.65-.96l2.49 1a.49.49 0 0 0 .61-.22l2-3.46a.49.49 0 0 0-.12-.64Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </header>

      {isWizardOpen ? (
        <ProjectWizard
          onComplete={handleWizardComplete}
          onCancel={() => setIsWizardOpen(false)}
          defaultAgent={defaultAgent}
          apiBase={API_BASE}
        />
      ) : (
      <div className="app">
        <aside
          className={`outline-rail ${isOutlineOpen ? "" : "collapsed"}`}
          style={isOutlineOpen ? { width: `${outlineWidth}px` } : undefined}
        >
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
                  <VersionsMenu versions={versions} onRestore={handleRestoreVersion} />
                  {diffAvailable && (
                    <button
                      className={`diff-toggle-btn${diffVisible ? " active" : ""}`}
                      onClick={handleToggleDiff}
                      title={diffVisible ? "Hide changes" : "Show changes"}
                    >
                      Changes
                    </button>
                  )}
                  <span className="save-status">
                    {saveStatus === "saving" && "Saving…"}
                    {saveStatus === "saved" && "Saved"}
                  </span>
                </div>
              </div>

              <section
                className="editor-section"
                onClick={() => editorRef.current?.focus()}
              >
                <MarkdownEditor
                  key={activeNode.id}
                  docId={activeNode.id}
                  value={activeNode.content_md || ""}
                  onChange={setDraft}
                  comments={comments}
                  editorRef={editorRef}
                />
              </section>
            </div>
          )}

          {activeNode?.type === "folder" && (
            <FolderView
              activeNode={activeNode}
              folderSummary={folderSummary}
              childrenMap={childrenMap}
              nodesById={nodesById}
              onSelectNode={handleSelectNode}
              onCreateNode={handleCreateNode}
              onRenameNode={handleRenameNode}
            />
          )}

          {!activeNode && (
            <div className="empty-state">
              <div className="empty-state-text">Select a document to start writing.</div>
            </div>
          )}
        </main>

        {isAssistantOpen && (
          <div
            className="pane-divider"
            onMouseDown={handleDividerMouseDown}
            onDoubleClick={() => setAssistantWidth(380)}
          />
        )}

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
          onCreateAgent={() => setIsAgentCreatorOpen(true)}
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
          onToggleDiff={handleToggleDiff}
          onUndoEdit={handleUndoEdit}
        />
      </div>
      )}

      <AgentCreatorSlideOver
        isOpen={isAgentCreatorOpen}
        onClose={() => setIsAgentCreatorOpen(false)}
        onCreate={handleCreateAgentFromCreator}
        apiBase={API_BASE}
      />

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
      />

      {commentInputState && (
        <CommentInput
          rect={commentInputState.rect}
          onSubmit={handleCreateInlineComment}
          onCancel={() => setCommentInputState(null)}
        />
      )}

      {popoverState && (
        <CommentPopover
          comments={popoverState.comments}
          rect={popoverState.rect}
          onClose={() => setPopoverState(null)}
        />
      )}
    </div>
  );
}
