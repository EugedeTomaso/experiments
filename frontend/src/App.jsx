import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { MarkdownEditor } from "./MarkdownEditor";
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

function TreeItem({
  node,
  depth,
  activeNodeId,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTargetId,
  draggingId,
}) {
  const isDropTarget = String(dropTargetId) === String(node.id);
  const isDragging = String(draggingId) === String(node.id);
  return (
    <div className={`tree-item ${node.type} ${isDropTarget ? "drop-target" : ""}`}>
      <button
        className={`tree-button ${activeNodeId === node.id ? "active" : ""} ${
          isDragging ? "dragging" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(node)}
        draggable
        onDragStart={(event) => onDragStart(event, node)}
        onDragOver={(event) => onDragOver(event, node)}
        onDrop={(event) => onDrop(event, node)}
        onDragEnd={onDragEnd}
      >
        <span className="tree-icon">{node.type === "folder" ? "▸" : "✎"}</span>
        <span>{node.title}</span>
      </button>
      {node.children?.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dropTargetId={dropTargetId}
              draggingId={draggingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [versions, setVersions] = useState([]);
  const [scopeConfigId, setScopeConfigId] = useState(null);
  const [scopeConfig, setScopeConfig] = useState(DEFAULT_AGENT);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantOutput, setAssistantOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerKeys, setProviderKeys] = useState([]);
  const [providerForm, setProviderForm] = useState({
    provider: "openai",
    api_key: "",
  });
  const [providerMessage, setProviderMessage] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    api
      .listProjects()
      .then((data) => {
        setProjects(data);
        if (data.length && !activeProjectId) {
          setActiveProjectId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .listProviderKeys()
      .then((data) => setProviderKeys(data))
      .catch(() => setProviderKeys([]));
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    api
      .listNodes(activeProjectId)
      .then((data) => {
        setNodes(data);
        if (!activeNodeId) {
          const firstFile = data.find((node) => node.type === "file");
          if (firstFile) {
            setActiveNodeId(String(firstFile.id));
          }
        }
      })
      .catch(() => {});
  }, [activeProjectId]);

  useEffect(() => {
    setActiveNodeId(null);
  }, [activeProjectId]);

  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [String(n.id), n])),
    [nodes]
  );

  const childrenMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => {
      const parentId = normalizeId(node.parent);
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId).push(node);
    });
    return map;
  }, [nodes]);

  const activeNode = useMemo(
    () => nodes.find((node) => String(node.id) === String(activeNodeId)),
    [nodes, activeNodeId]
  );

  useEffect(() => {
    if (activeNode?.type === "file") {
      setDraft(activeNode.content_md || "");
      api
        .listComments(activeNode.id)
        .then((data) => setComments(data))
        .catch(() => setComments([]));
      api
        .listVersions(activeNode.id)
        .then((data) => setVersions(data))
        .catch(() => setVersions([]));
    } else {
      setDraft("");
      setComments([]);
      setVersions([]);
    }
  }, [activeNodeId, activeNode, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    const loadConfig = async () => {
      try {
        if (activeNode) {
          const configs = await api.listAgentConfigs({ node: activeNode.id });
          if (configs.length) {
            setScopeConfigId(configs[0].id);
            setScopeConfig({ ...DEFAULT_AGENT, ...(configs[0].config || {}) });
          } else {
            setScopeConfigId(null);
            setScopeConfig(DEFAULT_AGENT);
          }
        } else {
          const configs = await api.listAgentConfigs({
            project: activeProjectId,
            scope_type: "project",
          });
          if (configs.length) {
            setScopeConfigId(configs[0].id);
            setScopeConfig({ ...DEFAULT_AGENT, ...(configs[0].config || {}) });
          } else {
            setScopeConfigId(null);
            setScopeConfig(DEFAULT_AGENT);
          }
        }
      } catch (error) {
        setScopeConfigId(null);
        setScopeConfig(DEFAULT_AGENT);
      }
    };
    loadConfig();
  }, [activeProjectId, activeNode]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const folderSummary = useMemo(() => {
    if (!activeNode || activeNode.type !== "folder") return null;
    const descendants = [];
    const stack = [String(activeNode.id)];
    while (stack.length) {
      const current = stack.pop();
      const children = childrenMap.get(current) || [];
      children.forEach((child) => {
        descendants.push(child);
        if (child.type === "folder") {
          stack.push(String(child.id));
        }
      });
    }

    const files = descendants.filter((node) => node.type === "file");
    const folders = descendants.filter((node) => node.type === "folder");
    const wordCount = files.reduce((total, file) => {
      const words = (file.content_md || "").trim().split(/\s+/).filter(Boolean);
      return total + words.length;
    }, 0);
    const lastUpdated = descendants.reduce((latest, node) => {
      const timestamp = new Date(node.updated_at).getTime();
      return Math.max(latest, timestamp);
    }, new Date(activeNode.updated_at).getTime());
    const sampleFiles = files.slice(0, 5).map((file) => ({
      id: file.id,
      title: file.title,
      snippet: buildSnippet(file.content_md, 160),
    }));

    return {
      fileCount: files.length,
      folderCount: folders.length,
      wordCount,
      lastUpdated,
      sampleFiles,
    };
  }, [activeNode, childrenMap]);

  const agentScopeLabel = useMemo(() => {
    if (!activeNode) return "Project";
    return activeNode.type === "file" ? "File" : "Folder";
  }, [activeNode]);

  const providerKeyMap = useMemo(() => {
    const map = new Map();
    providerKeys.forEach((key) => {
      map.set(key.provider, key);
    });
    return map;
  }, [providerKeys]);

  const getNextOrder = (parentId) => {
    const targetParent = normalizeId(parentId);
    const siblings = nodes.filter(
      (node) => normalizeId(node.parent) === targetParent
    );
    if (!siblings.length) return 0;
    return Math.max(...siblings.map((node) => node.order ?? 0)) + 1;
  };

  const isDescendant = (targetId, ancestorId) => {
    let current = nodesById.get(String(targetId));
    while (current && current.parent) {
      if (String(current.parent) === String(ancestorId)) return true;
      current = nodesById.get(String(current.parent));
    }
    return false;
  };

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
    const title = window.prompt(type === "folder" ? "Folder name" : "File name");
    if (!title) return;
    const parent =
      activeNode?.type === "folder"
        ? activeNode.id
        : activeNode?.parent ?? null;
    const node = await api.createNode({
      project: activeProjectId,
      parent,
      type,
      title,
      order: getNextOrder(parent),
      content_md: type === "file" ? "" : "",
    });
    setNodes((prev) => [...prev, node]);
    if (type === "file") {
      setActiveNodeId(String(node.id));
    }
  };

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== "file") return;
    setIsSaving(true);
    try {
      const updated = await api.updateNode(activeNode.id, { content_md: draft });
      setNodes((prev) =>
        prev.map((node) =>
          String(node.id) === String(updated.id) ? updated : node
        )
      );
      const versionList = await api.listVersions(activeNode.id);
      setVersions(versionList);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!activeNode || !commentDraft.trim()) return;
    const comment = await api.createComment({
      node: activeNode.id,
      body: commentDraft.trim(),
    });
    setComments((prev) => [...prev, comment]);
    setCommentDraft("");
  };

  const handleSaveAgentConfig = async () => {
    if (!activeProjectId) return;
    setIsConfigSaving(true);
    const payload = {
      scope_type: activeNode ? activeNode.type : "project",
      project: activeNode ? null : activeProjectId,
      node: activeNode ? activeNode.id : null,
      config: scopeConfig,
    };
    try {
      if (scopeConfigId) {
        await api.updateAgentConfig(scopeConfigId, payload);
      } else {
        const created = await api.createAgentConfig(payload);
        setScopeConfigId(created.id);
      }
    } finally {
      setIsConfigSaving(false);
    }
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
          if (data === "[DONE]") {
            setIsStreaming(false);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              setAssistantOutput((prev) => prev + parsed.delta);
            }
          } catch (error) {
            // ignore malformed chunks
          }
        }
      }
    } catch (error) {
      setAssistantOutput("Error: " + error.message);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveProviderKey = async () => {
    if (!providerForm.api_key.trim()) {
      setProviderMessage("Enter a key before saving.");
      return;
    }
    const existing = providerKeyMap.get(providerForm.provider);
    const payload = {
      provider: providerForm.provider,
      api_key: providerForm.api_key.trim(),
    };
    if (existing) {
      await api.updateProviderKey(existing.id, payload);
    } else {
      await api.createProviderKey(payload);
    }
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
    setProviderForm((prev) => ({ ...prev, api_key: "" }));
    setProviderMessage("Key saved.");
  };

  const handleClearProviderKey = async () => {
    const existing = providerKeyMap.get(providerForm.provider);
    if (!existing) {
      setProviderMessage("No key to clear.");
      return;
    }
    await api.updateProviderKey(existing.id, { api_key: "" });
    const updated = await api.listProviderKeys();
    setProviderKeys(updated);
    setProviderMessage("Key cleared.");
  };

  const handleRestoreVersion = (version) => {
    setDraft(version.content_md || "");
  };

  const handleDragStart = (event, node) => {
    event.dataTransfer.setData("text/plain", String(node.id));
    setDraggingId(String(node.id));
  };

  const handleDragOver = (event, node) => {
    event.preventDefault();
    setDropTargetId(String(node.id));
  };

  const handleDrop = async (event, targetNode) => {
    event.preventDefault();
    const draggedId = normalizeId(
      draggingId || event.dataTransfer.getData("text/plain")
    );
    if (!draggedId || String(draggedId) === String(targetNode.id)) return;
    const draggedNode = nodesById.get(String(draggedId));
    if (!draggedNode) return;

    const newParent =
      targetNode.type === "folder" ? targetNode.id : targetNode.parent ?? null;
    if (newParent === draggedNode.parent && targetNode.id === draggedNode.id) {
      return;
    }
    if (String(newParent) === String(draggedId)) return;
    if (newParent && isDescendant(newParent, draggedId)) return;

    const updated = await api.updateNode(Number(draggedId), {
      parent: newParent,
      order: getNextOrder(newParent),
    });
    setNodes((prev) =>
      prev.map((node) =>
        String(node.id) === String(updated.id) ? updated : node
      )
    );
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Marvin</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`profile-button ${isSettingsOpen ? "active" : ""}`}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-label="Toggle settings"
          >
            <span className="profile-avatar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.6c-3.3 0-7.8 1.7-7.8 5V22h15.6v-2.4c0-3.3-4.5-5-7.8-5Z"
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
            <button className="ghost" onClick={handleCreateProject}>
              + New
            </button>
          </div>
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-button ${
                  activeProjectId === project.id ? "active" : ""
                }`}
                onClick={() => setActiveProjectId(project.id)}
              >
                {project.name}
              </button>
            ))}
            {projects.length === 0 && (
              <div className="empty">No projects yet.</div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Outline</h2>
            <div className="actions">
              <button className="ghost" onClick={() => handleCreateNode("folder")}>
                + Folder
              </button>
              <button className="ghost" onClick={() => handleCreateNode("file")}>
                + File
              </button>
            </div>
          </div>
          <div className="tree">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                activeNodeId={activeNodeId}
                onSelect={(node) => setActiveNodeId(String(node.id))}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                dropTargetId={dropTargetId}
                draggingId={draggingId}
              />
            ))}
            {tree.length === 0 && (
              <div className="empty">Add your first file or folder.</div>
            )}
          </div>
          <p className="helper">Drag files to reorder or move into folders.</p>
        </section>
        </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <div className="eyebrow">Editor</div>
            <h1>{activeNode?.title || "Select a file"}</h1>
          </div>
          <div className="header-actions">
            <button
              className="primary"
              onClick={handleSave}
              disabled={!activeNode || activeNode.type !== "file" || isSaving}
            >
              {isSaving ? "Saving" : "Save"}
            </button>
          </div>
        </header>

        <section className="editor-section">
          {activeNode?.type === "file" ? (
            <MarkdownEditor
              key={activeNode.id}
              docId={activeNode.id}
              value={draft}
              onChange={setDraft}
            />
          ) : (
            <div className="empty editor-empty">
              {activeNode?.type === "folder"
                ? "Select a file to start writing."
                : "Select a file to start writing."}
            </div>
          )}
        </section>

        {activeNode?.type === "folder" && folderSummary && (
          <section className="folder-summary">
            <div className="panel-header">
              <h2>Folder Summary</h2>
            </div>
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
                  <div className="summary-snippet">
                    {file.snippet || "Empty"}
                  </div>
                </div>
              ))}
              {folderSummary.sampleFiles.length === 0 && (
                <div className="empty">No files inside this folder yet.</div>
              )}
            </div>
          </section>
        )}

        <section className="comments">
          <div className="panel-header">
            <h2>Comments</h2>
          </div>
          {activeNode?.type !== "file" && (
            <div className="empty">Select a file to view comments.</div>
          )}
          {activeNode?.type === "file" && (
            <>
              <div className="comment-list">
                {comments.map((comment) => (
                  <div className="comment" key={comment.id}>
                    <div className="comment-body">{comment.body}</div>
                    <div className="comment-meta">
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="empty">No comments yet.</div>
                )}
              </div>
              <div className="comment-input">
                <textarea
                  placeholder="Add comment"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <button className="primary" onClick={handleAddComment}>
                  Post
                </button>
              </div>
            </>
          )}
        </section>

        <section className="versions">
          <div className="panel-header">
            <h2>Versions</h2>
          </div>
          {activeNode?.type !== "file" && (
            <div className="empty">Select a file to view versions.</div>
          )}
          {activeNode?.type === "file" && (
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
                  <button
                    className="ghost"
                    onClick={() => handleRestoreVersion(version)}
                  >
                    Restore
                  </button>
                </div>
              ))}
              {versions.length === 0 && (
                <div className="empty">No versions yet.</div>
              )}
              {versions.length > 0 && (
                <div className="helper">
                  Restoring loads content into the editor. Click Save to create a
                  new version.
                </div>
              )}
            </div>
          )}
        </section>
        </main>

        <aside className="assistant">
        <div className="panel-header">
          <h2>Agent</h2>
        </div>
        <div className="agent-panel">
          <div className="scope-label">Scope: {agentScopeLabel}</div>
          <label>
            Provider
            <select
              value={scopeConfig.provider}
              onChange={(event) =>
                setScopeConfig((prev) => ({
                  ...prev,
                  provider: event.target.value,
                }))
              }
            >
              {PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <input
              value={scopeConfig.model}
              onChange={(event) =>
                setScopeConfig((prev) => ({
                  ...prev,
                  model: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Temperature
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={scopeConfig.temperature}
              onChange={(event) =>
                setScopeConfig((prev) => ({
                  ...prev,
                  temperature: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            System prompt
            <textarea
              value={scopeConfig.system_prompt}
              onChange={(event) =>
                setScopeConfig((prev) => ({
                  ...prev,
                  system_prompt: event.target.value,
                }))
              }
            />
          </label>
          <button className="primary" onClick={handleSaveAgentConfig}>
            {isConfigSaving ? "Saving" : "Save agent"}
          </button>
        </div>
        <div className="assistant-panel">
          <div className="panel-header">
            <h2>AI Studio</h2>
          </div>
          <textarea
            placeholder="Ask the agent…"
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
          />
          <button className="primary" onClick={handleRunAssistant}>
            {isStreaming ? "Generating" : "Generate"}
          </button>
          <div className="assistant-output">
            {assistantOutput || "The response will appear here."}
          </div>
        </div>
        </aside>
      </div>

      {isSettingsOpen && (
        <div
          className="settings-overlay"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="panel settings-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>Settings</h2>
              <button className="ghost" onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="settings-group">
              <h3>Provider Keys</h3>
              <label>
                Provider
                <select
                  value={providerForm.provider}
                  onChange={(event) =>
                    setProviderForm((prev) => ({
                      ...prev,
                      provider: event.target.value,
                    }))
                  }
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                API key
                <input
                  type="password"
                  placeholder="sk-..."
                  value={providerForm.api_key}
                  onChange={(event) =>
                    setProviderForm((prev) => ({
                      ...prev,
                      api_key: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="provider-actions">
                <button className="primary" onClick={handleSaveProviderKey}>
                  Save key
                </button>
                <button className="ghost" onClick={handleClearProviderKey}>
                  Clear key
                </button>
              </div>
              {providerMessage && <div className="helper">{providerMessage}</div>}
              <div className="provider-list">
                {PROVIDERS.map((provider) => (
                  <div className="provider-item" key={provider.value}>
                    <span>{provider.label}</span>
                    <span
                      className={
                        providerKeyMap.get(provider.value)?.has_key
                          ? "status ok"
                          : "status"
                      }
                    >
                      {providerKeyMap.get(provider.value)?.has_key
                        ? "Configured"
                        : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
