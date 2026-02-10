import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { MarkdownEditor } from "./MarkdownEditor";
import { TreeItem } from "./components/TreeItem";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { AssistantPanel } from "./components/AssistantPanel";
import { VersionsMenu } from "./components/VersionsMenu";
import { AgentCreatorSlideOver } from "./components/AgentCreatorSlideOver";
import { CommentInput } from "./components/CommentInput";
import { CommentPopover } from "./components/CommentPopover";
import { SettingsModal } from "./components/SettingsModal";
import { createStreamParser } from "./streamParser";
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

const buildSnippet = (text, maxLength = 140) => {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
};

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

  // --- Agent state ---
  const [agents, setAgents] = useState([]);
  const [nodeAgentConfigs, setNodeAgentConfigs] = useState([]);
  const [resolvedAgent, setResolvedAgent] = useState(null);
  const [nodeDirectConfig, setNodeDirectConfig] = useState(null);
  const [isAgentCreatorOpen, setIsAgentCreatorOpen] = useState(false);

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
    if (!activeProjectId) return;
    api.listNodes(activeProjectId).then((data) => {
      setNodes(data);
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

  useEffect(() => {
    setChatMessages([]);
    setStreamingContent("");
    setChatInput("");
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

    el.addEventListener("comment-selection-request", onSelectionRequest);
    el.addEventListener("comment-highlight-click", onHighlightClick);
    return () => {
      el.removeEventListener("comment-selection-request", onSelectionRequest);
      el.removeEventListener("comment-highlight-click", onHighlightClick);
    };
  }, [handleHighlightClick]);

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
  const handleCreateProject = async () => {
    const name = window.prompt("Project name");
    if (!name) return;
    const project = await api.createProject({ name });
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);
    setActiveNodeId(null);
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

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isStreaming || !activeProjectId) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setIsEditingDocument(false);

    // Capture editor instance and node ID at stream start so that
    // navigating to another document mid-stream cannot redirect writes.
    const targetNodeId = activeNodeId;
    const targetEditor = editorRef.current;

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
        apiMessages.push({ role: msg.role, content: msg.content });
      }
      apiMessages.push({ role: "user", content: userMsg });

      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        if (finalState.mode === "document_edit") {
          // Apply final document content to the captured editor (may be unmounted)
          if (finalState.documentContent) {
            if (targetEditor) {
              try { targetEditor.replaceContent(finalState.documentContent); } catch (_) {}
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
          const chatMsg = finalState.chatContent || "I've updated the document.";
          setChatMessages((prev) => [...prev, { role: "assistant", content: chatMsg }]);
        } else {
          if (fullContent) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
          }
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
            if (parsed.delta) {
              fullContent += parsed.delta;
              const state = parser.push(parsed.delta);

              if (state.mode === "document_edit") {
                setIsEditingDocument(true);
                // Typewriter: apply partial content throttled every ~200ms
                const now = Date.now();
                if (state.documentContent && targetEditor && now - lastApplyTime >= 200) {
                  try { targetEditor.replaceContent(state.documentContent); } catch (_) {}
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
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: " + error.message },
      ]);
      setStreamingContent("");
      setIsEditingDocument(false);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSummarize = async () => {
    if (isStreaming || !activeNode || activeNode.type !== "file" || !draft.trim()) return;
    setIsAssistantOpen(true);
    const userMsg = `Summarize the chapter "${activeNode.title}"`;
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setStreamingContent("");

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
  };
  const handleDragOverNode = (event, node) => {
    event.preventDefault();
    setDropTargetId(String(node.id));
  };
  const handleDrop = async (event, targetNode) => {
    event.preventDefault();
    const draggedId = normalizeId(draggingId || event.dataTransfer.getData("text/plain"));
    if (!draggedId || String(draggedId) === String(targetNode.id)) return;
    const draggedNode = nodesById.get(String(draggedId));
    if (!draggedNode) return;
    const newParent = targetNode.type === "folder" ? targetNode.id : targetNode.parent ?? null;
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
  };
  const handleDragEnd = () => { setDraggingId(null); setDropTargetId(null); };

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

      <div className="app">
        {isOutlineOpen && (
          <aside className="outline-rail">
            <div className="rail-header">
              <h2>Outline</h2>
              <div className="actions">
                <button className="ghost" onClick={() => handleCreateNode("folder")}>+ Folder</button>
                <button className="ghost" onClick={() => handleCreateNode("file")}>+ File</button>
              </div>
            </div>
            <div className="tree">
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
                  draggingId={draggingId}
                  agentNodeIds={agentNodeIds}
                />
              ))}
              {tree.length === 0 && <div className="empty">Add your first file or folder.</div>}
            </div>
          </aside>
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
            <div className="editor-content">
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
                  <span className="eyebrow">Folder</span>
                </div>
              </div>

              {folderSummary && (
                <div className="folder-summary">
                  <div className="summary-grid">
                    <div>
                      <div className="summary-label">Files</div>
                      <div className="summary-value">{folderSummary.fileCount}</div>
                    </div>
                    <div>
                      <div className="summary-label">Folders</div>
                      <div className="summary-value">{folderSummary.folderCount}</div>
                    </div>
                    <div>
                      <div className="summary-label">Total words</div>
                      <div className="summary-value">{folderSummary.wordCount}</div>
                    </div>
                    <div>
                      <div className="summary-label">Last updated</div>
                      <div className="summary-value">
                        {new Date(folderSummary.lastUpdated).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="summary-list">
                    {folderSummary.sampleFiles.map((file) => (
                      <div
                        key={file.id}
                        className="summary-item"
                        onClick={() => setActiveNodeId(String(file.id))}
                      >
                        <div className="summary-item-header">
                          <div className="summary-title">{file.title}</div>
                          {file.summary && !file.summaryStale && (
                            <span className="summary-ai-badge">AI summary</span>
                          )}
                        </div>
                        <div className="summary-snippet">{file.snippet || "Empty"}</div>
                        {(file.summary || file.snippet) && (
                          <div className="summary-expand">
                            <div className="summary-expand-content">
                              {file.summary && !file.summaryStale ? (
                                <>{file.summary}</>
                              ) : (
                                <span className="summary-loading">
                                  <span className="summary-loading-dot" />
                                  {file.summaryStale && file.snippet ? "Generating summary\u2026" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {folderSummary.sampleFiles.length === 0 && (
                      <div className="empty">No files inside this folder yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
          onSummarize={handleSummarize}
          canSummarize={activeNode?.type === "file" && !!draft.trim()}
          isEditingDocument={isEditingDocument}
          width={assistantWidth}
        />
      </div>

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
