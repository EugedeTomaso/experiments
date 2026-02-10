import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { MarkdownEditor } from "./MarkdownEditor";
import { TreeItem } from "./components/TreeItem";
import { AgentsList } from "./components/AgentsList";
import { AgentConfigView } from "./components/AgentConfigView";
import { AgentCreatorSlideOver } from "./components/AgentCreatorSlideOver";
import { AIStudioSlideOver } from "./components/AIStudioSlideOver";
import { TabBar } from "./components/TabBar";
import { CommentInput } from "./components/CommentInput";
import { CommentPopover } from "./components/CommentPopover";
import "./App.css";

const DEFAULT_AGENT = {
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0.7,
  system_prompt: "",
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "cerebras", label: "Cerebras" },
  { value: "groq", label: "Groq" },
];

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
  const [isSaving, setIsSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [versions, setVersions] = useState([]);
  const [activeTab, setActiveTab] = useState("comments");

  // --- Agent state ---
  const [agents, setAgents] = useState([]);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [nodeAgentConfigs, setNodeAgentConfigs] = useState([]);
  const [resolvedAgent, setResolvedAgent] = useState(null);
  const [nodeDirectConfig, setNodeDirectConfig] = useState(null);

  // --- AI Studio state ---
  const [isAIStudioOpen, setIsAIStudioOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantOutput, setAssistantOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // --- Agent creator state ---
  const [isAgentCreatorOpen, setIsAgentCreatorOpen] = useState(false);

  // --- Settings state ---
  const [providerKeys, setProviderKeys] = useState([]);
  const [providerForm, setProviderForm] = useState({ provider: "openai", api_key: "" });
  const [providerMessage, setProviderMessage] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    () => (activeAgentId ? null : nodes.find((n) => String(n.id) === String(activeNodeId))),
    [nodes, activeNodeId, activeAgentId]
  );

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId]
  );

  const selectionType = useMemo(() => {
    if (activeAgentId) return "agent";
    if (activeNode?.type === "file") return "file";
    if (activeNode?.type === "folder") return "folder";
    return "none";
  }, [activeAgentId, activeNode]);

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
    const sampleFiles = files.slice(0, 5).map((file) => ({
      id: file.id,
      title: file.title,
      snippet: buildSnippet(file.content_md, 160),
    }));
    return { fileCount: files.length, folderCount: folders.length, wordCount, lastUpdated, sampleFiles };
  }, [activeNode, childrenMap]);

  const providerKeyMap = useMemo(() => {
    const map = new Map();
    providerKeys.forEach((key) => map.set(key.provider, key));
    return map;
  }, [providerKeys]);

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

  // Load all agent configs for tree indicators
  useEffect(() => {
    if (!activeProjectId || !nodes.length) { setNodeAgentConfigs([]); return; }
    api.listAgentConfigs({}).then((all) => {
      const projectNodeIds = new Set(nodes.map((n) => String(n.id)));
      setNodeAgentConfigs(all.filter((c) => c.node && projectNodeIds.has(String(c.node))));
    }).catch(() => setNodeAgentConfigs([]));
  }, [activeProjectId, nodes]);

  useEffect(() => {
    setActiveNodeId(null);
    setActiveAgentId(null);
  }, [activeProjectId]);

  useEffect(() => {
    if (activeNode?.type === "file") {
      setDraft(activeNode.content_md || "");
      api.listComments(activeNode.id).then(setComments).catch(() => setComments([]));
      api.listVersions(activeNode.id).then(setVersions).catch(() => setVersions([]));
    } else {
      setDraft("");
      setComments([]);
      setVersions([]);
    }
  }, [activeNodeId, activeNode, activeProjectId]);

  // Load resolved agent for current node
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
    setActiveAgentId(null);
  };

  const handleCreateNode = async (type) => {
    if (!activeProjectId) return;
    const title = window.prompt(type === "folder" ? "Folder name" : "File name");
    if (!title) return;
    const parent = activeNode?.type === "folder" ? activeNode.id : activeNode?.parent ?? null;
    const node = await api.createNode({
      project: activeProjectId,
      parent,
      type,
      title,
      order: getNextOrder(parent),
      content_md: "",
    });
    setNodes((prev) => [...prev, node]);
    if (type === "file") {
      setActiveNodeId(String(node.id));
      setActiveAgentId(null);
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
    setActiveAgentId(null);
  };

  const handleSelectAgent = (agent) => {
    setActiveAgentId(agent.id);
    setActiveNodeId(null);
  };

  const handleOpenAgentCreator = () => {
    if (!activeProjectId) return;
    setIsAgentCreatorOpen(true);
  };

  const handleCreateAgentFromCreator = async ({ name, config }) => {
    if (!activeProjectId) return;
    const agent = await api.createAgent({
      project: activeProjectId,
      name,
      config,
    });
    setAgents((prev) => [...prev, agent]);
    setActiveAgentId(agent.id);
    setActiveNodeId(null);
  };

  const handleSaveAgent = async ({ name, config }) => {
    if (!activeAgent) return;
    const updated = await api.updateAgent(activeAgent.id, { name, config });
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDeleteAgent = async () => {
    if (!activeAgent) return;
    if (!window.confirm(`Delete assistant "${activeAgent.name}"?`)) return;
    await api.deleteAgent(activeAgent.id);
    setAgents((prev) => prev.filter((a) => a.id !== activeAgent.id));
    setActiveAgentId(null);
  };

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== "file") return;
    setIsSaving(true);
    try {
      const updated = await api.updateNode(activeNode.id, { content_md: draft });
      setNodes((prev) => prev.map((n) => (String(n.id) === String(updated.id) ? updated : n)));
      const versionList = await api.listVersions(activeNode.id);
      setVersions(versionList);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!activeNode || !commentDraft.trim()) return;
    const comment = await api.createComment({ node: activeNode.id, body: commentDraft.trim() });
    setComments((prev) => [...prev, comment]);
    setCommentDraft("");
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
    // Refresh
    const configs = await api.listAgentConfigs({ node: activeNode.id });
    setNodeDirectConfig(configs.length ? configs[0] : null);
    const resolved = await api.resolveAgentConfig({ node: activeNode.id });
    setResolvedAgent(resolved);
    // Refresh tree indicators
    api.listAgentConfigs({}).then((all) => {
      const projectNodeIds = new Set(nodes.map((n) => String(n.id)));
      setNodeAgentConfigs(all.filter((c) => c.node && projectNodeIds.has(String(c.node))));
    }).catch(() => {});
  };

  const handleRunAssistant = async () => {
    if (!assistantPrompt.trim() || isStreaming || !activeProjectId) return;
    setAssistantOutput("");
    setIsStreaming(true);
    try {
      const resolved = await api.resolveAgentConfig(
        activeNode ? { node: activeNode.id } : { project: activeProjectId }
      );
      const config = { ...DEFAULT_AGENT, ...(resolved?.config || {}) };
      const messages = [];
      if (config.system_prompt) {
        messages.push({ role: "system", content: config.system_prompt });
      }
      let contextBlock = "";
      if (activeNode?.type === "file") {
        contextBlock = `\n\nCurrent document:\n${draft}`;
      } else if (activeNode?.type === "folder" && folderSummary) {
        const summaryLines = [
          `\n\nCurrent folder: ${activeNode.title}`,
          `Files: ${folderSummary.fileCount}, Folders: ${folderSummary.folderCount}`,
          `Total words: ${folderSummary.wordCount}`,
        ];
        if (folderSummary.sampleFiles.length) {
          summaryLines.push("File previews:");
          folderSummary.sampleFiles.forEach((file) => {
            summaryLines.push(`- ${file.title}: ${file.snippet || "Empty"}`);
          });
        }
        contextBlock = `\n\n${summaryLines.join("\n")}`;
      }
      messages.push({ role: "user", content: `${assistantPrompt}${contextBlock}` });

      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          messages,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Streaming failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
          if (data === "[DONE]") { setIsStreaming(false); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) setAssistantOutput((prev) => prev + parsed.delta);
          } catch (_) {}
        }
      }
    } catch (error) {
      setAssistantOutput("Error: " + error.message);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleRestoreVersion = (version) => setDraft(version.content_md || "");

  const handleSaveProviderKey = async () => {
    if (!providerForm.api_key.trim()) { setProviderMessage("Enter a key before saving."); return; }
    const existing = providerKeyMap.get(providerForm.provider);
    const payload = { provider: providerForm.provider, api_key: providerForm.api_key.trim() };
    if (existing) { await api.updateProviderKey(existing.id, payload); }
    else { await api.createProviderKey(payload); }
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
    setProviderForm((prev) => ({ ...prev, api_key: "" }));
    setProviderMessage("Key saved.");
  };

  const handleClearProviderKey = async () => {
    const existing = providerKeyMap.get(providerForm.provider);
    if (!existing) { setProviderMessage("No key to clear."); return; }
    await api.updateProviderKey(existing.id, { api_key: "" });
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
    setProviderMessage("Key cleared.");
  };

  // --- Drag & drop ---
  const handleDragStart = (event, node) => {
    event.dataTransfer.setData("text/plain", String(node.id));
    setDraggingId(String(node.id));
  };
  const handleDragOver = (event) => {
    event.preventDefault();
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
        <div className="brand">
          <span className="brand-name">Marvin</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`ai-button ${isAIStudioOpen ? "active" : ""}`}
            onClick={() => setIsAIStudioOpen((prev) => !prev)}
            aria-label="Toggle AI Studio"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M9.937 4.562 11.5 1l1.563 3.562L16.625 6.5l-3.562 1.063L11.5 11.125 9.937 7.563 6.375 6.5Zm7.063 5.938L18.25 8l1.25 2.5L22 11.75l-2.5 1.25L18.25 15.5 17 13l-2.5-1.25ZM9.937 14.438 11.5 11l1.563 3.438L16.625 16l-3.562 1.563L11.5 21l-1.563-3.437L6.375 16Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className={`profile-button ${isSettingsOpen ? "active" : ""}`}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-label="Toggle settings"
          >
            <span className="profile-avatar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53a7.76 7.76 0 0 0 .07-1 7.76 7.76 0 0 0-.07-.97l2.11-1.63a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.15 7.15 0 0 0-1.65-.96l-.37-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65a7.68 7.68 0 0 0-1.65.96l-2.49-1a.49.49 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64L4.57 11a8.3 8.3 0 0 0-.07.97 8.3 8.3 0 0 0 .07 1l-2.11 1.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1a7.15 7.15 0 0 0 1.65.96l.37 2.65a.5.5 0 0 0 .5.47h4a.5.5 0 0 0 .49-.42l.38-2.65a7.68 7.68 0 0 0 1.65-.96l2.49 1a.49.49 0 0 0 .61-.22l2-3.46a.49.49 0 0 0-.12-.64Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </div>
      </header>

      <div className="app">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel-header">
              <h2>Projects</h2>
              <button className="ghost" onClick={handleCreateProject}>+ New</button>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={`project-button ${activeProjectId === project.id ? "active" : ""}`}
                  onClick={() => setActiveProjectId(project.id)}
                >
                  {project.name}
                </button>
              ))}
              {projects.length === 0 && <div className="empty">No projects yet.</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
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
            <p className="helper">Drag files to reorder or move into folders.</p>
          </section>

          <AgentsList
            agents={agents}
            activeAgentId={activeAgentId}
            onSelect={handleSelectAgent}
            onCreate={handleOpenAgentCreator}
          />
        </aside>

        <main className="main">
          {selectionType === "agent" && activeAgent && (
            <AgentConfigView
              agent={activeAgent}
              onSave={handleSaveAgent}
              onDelete={handleDeleteAgent}
            />
          )}

          {selectionType === "file" && activeNode && (
            <>
              <header className="main-header">
                <div>
                  <div className="eyebrow">Editor</div>
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
                </div>
                <div className="header-actions">
                  <div className="agent-assignment">
                    <label className="agent-assignment-label">Assistant</label>
                    <select
                      className="agent-assignment-select"
                      value={nodeDirectConfig?.agent || ""}
                      onChange={(e) => handleAssignAgent(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">
                        {resolvedAgent?.inherited && resolvedAgent?.agent_name
                          ? `Inherited: ${resolvedAgent.agent_name}`
                          : "None"}
                      </option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving" : "Save"}
                  </button>
                </div>
              </header>

              <section className="editor-section" ref={editorWrapperRef}>
                <MarkdownEditor
                  key={activeNode.id}
                  docId={activeNode.id}
                  value={draft}
                  onChange={setDraft}
                  comments={comments}
                  editorRef={editorRef}
                />
              </section>

              <TabBar
                tabs={[
                  { key: "comments", label: `Comments (${comments.length})` },
                  { key: "versions", label: `Versions (${versions.length})` },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {activeTab === "comments" && (
                <section className="tab-content">
                  <div className="comment-list">
                    {comments.map((comment) => (
                      <div
                        className={`comment ${comment.quoted_text ? "comment-inline" : ""}`}
                        key={comment.id}
                        onClick={() => {
                          if (comment.quoted_text && editorRef.current) {
                            editorRef.current.scrollToPos(
                              comment.position_from,
                              comment.position_to
                            );
                          }
                        }}
                        style={{ cursor: comment.quoted_text ? "pointer" : "default" }}
                      >
                        {comment.quoted_text && (
                          <div className="comment-quoted">
                            &ldquo;{comment.quoted_text.length > 80
                              ? comment.quoted_text.slice(0, 80) + "\u2026"
                              : comment.quoted_text}&rdquo;
                          </div>
                        )}
                        <div className="comment-body">{comment.body}</div>
                        <div className="comment-meta">
                          {new Date(comment.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <div className="empty">No comments yet. Select text in the editor to add an inline comment.</div>
                    )}
                  </div>
                  <div className="comment-input">
                    <textarea
                      placeholder="Add a general comment..."
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <button className="primary" onClick={handleAddComment}>Post</button>
                  </div>
                </section>
              )}

              {activeTab === "versions" && (
                <section className="tab-content">
                  <div className="version-list">
                    {versions.map((version) => (
                      <div className="version-item" key={version.id}>
                        <div>
                          <div className="version-title">
                            {new Date(version.created_at).toLocaleString()}
                          </div>
                          <div className="version-snippet">
                            {(version.content_md || "").slice(0, 80) || "Empty"}
                          </div>
                        </div>
                        <button className="ghost" onClick={() => handleRestoreVersion(version)}>
                          Restore
                        </button>
                      </div>
                    ))}
                    {versions.length === 0 && <div className="empty">No versions yet.</div>}
                    {versions.length > 0 && (
                      <div className="helper">
                        Restoring loads content into the editor. Click Save to create a new version.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {selectionType === "folder" && activeNode && (
            <>
              <header className="main-header">
                <div>
                  <div className="eyebrow">Folder</div>
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
                </div>
                <div className="header-actions">
                  <div className="agent-assignment">
                    <label className="agent-assignment-label">Assistant</label>
                    <select
                      className="agent-assignment-select"
                      value={nodeDirectConfig?.agent || ""}
                      onChange={(e) => handleAssignAgent(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">
                        {resolvedAgent?.inherited && resolvedAgent?.agent_name
                          ? `Inherited: ${resolvedAgent.agent_name}`
                          : "None"}
                      </option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </header>

              {folderSummary && (
                <section className="folder-summary">
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
                      <div key={file.id} className="summary-item">
                        <div className="summary-title">{file.title}</div>
                        <div className="summary-snippet">{file.snippet || "Empty"}</div>
                      </div>
                    ))}
                    {folderSummary.sampleFiles.length === 0 && (
                      <div className="empty">No files inside this folder yet.</div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {selectionType === "none" && (
            <div className="empty-state">
              <div className="empty-state-text">Select a file to start writing.</div>
            </div>
          )}
        </main>
      </div>

      <AIStudioSlideOver
        isOpen={isAIStudioOpen}
        onClose={() => setIsAIStudioOpen(false)}
        prompt={assistantPrompt}
        onPromptChange={setAssistantPrompt}
        output={assistantOutput}
        isStreaming={isStreaming}
        onGenerate={handleRunAssistant}
      />

      <AgentCreatorSlideOver
        isOpen={isAgentCreatorOpen}
        onClose={() => setIsAgentCreatorOpen(false)}
        onCreate={handleCreateAgentFromCreator}
        apiBase={API_BASE}
      />

      {isSettingsOpen && (
        <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="panel settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>Settings</h2>
              <button className="ghost" onClick={() => setIsSettingsOpen(false)}>Close</button>
            </div>
            <div className="settings-group">
              <h3>Provider Keys</h3>
              <label>
                Provider
                <select
                  value={providerForm.provider}
                  onChange={(e) => setProviderForm((prev) => ({ ...prev, provider: e.target.value }))}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label>
                API key
                <input
                  type="password"
                  placeholder="sk-..."
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm((prev) => ({ ...prev, api_key: e.target.value }))}
                />
              </label>
              <div className="provider-actions">
                <button className="primary" onClick={handleSaveProviderKey}>Save key</button>
                <button className="ghost" onClick={handleClearProviderKey}>Clear key</button>
              </div>
              {providerMessage && <div className="helper">{providerMessage}</div>}
              <div className="provider-list">
                {PROVIDERS.map((p) => (
                  <div className="provider-item" key={p.value}>
                    <span>{p.label}</span>
                    <span className={providerKeyMap.get(p.value)?.has_key ? "status ok" : "status"}>
                      {providerKeyMap.get(p.value)?.has_key ? "Configured" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
