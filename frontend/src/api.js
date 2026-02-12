const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  listProjects() {
    return request("/api/projects/");
  },
  createProject(payload) {
    return request("/api/projects/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listNodes(projectId) {
    return request(`/api/nodes/?project=${projectId}`);
  },
  createNode(payload) {
    return request("/api/nodes/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateNode(id, payload) {
    return request(`/api/nodes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteNode(id) {
    return request(`/api/nodes/${id}/`, { method: "DELETE" });
  },
  listComments(nodeId) {
    return request(`/api/comments/?node=${nodeId}`);
  },
  createComment(payload) {
    return request("/api/comments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listVersions(nodeId) {
    return request(`/api/versions/?node=${nodeId}`);
  },
  listAgentConfigs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/agent-configs/?${query}`);
  },
  createAgentConfig(payload) {
    return request("/api/agent-configs/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAgentConfig(id, payload) {
    return request(`/api/agent-configs/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteAgentConfig(id) {
    return request(`/api/agent-configs/${id}/`, { method: "DELETE" });
  },
  resolveAgentConfig(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/agent-configs/resolve/?${query}`);
  },
  listAgents(projectId) {
    return request(`/api/agents/?project=${projectId}`);
  },
  createAgent(payload) {
    return request("/api/agents/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAgent(id, payload) {
    return request(`/api/agents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteAgent(id) {
    return request(`/api/agents/${id}/`, { method: "DELETE" });
  },
  listProviderKeys() {
    return request("/api/provider-keys/");
  },
  createProviderKey(payload) {
    return request("/api/provider-keys/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateProviderKey(id, payload) {
    return request(`/api/provider-keys/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteProviderKey(id) {
    return request(`/api/provider-keys/${id}/`, { method: "DELETE" });
  },
  searchNodes(projectId, query) {
    return request(`/api/search/?project=${projectId}&q=${encodeURIComponent(query)}`);
  },
  generateSummary(nodeId, { provider, model }) {
    return request(`/api/nodes/${nodeId}/summary`, {
      method: "POST",
      body: JSON.stringify({ provider, model }),
    });
  },

  // Conversations
  listConversations(nodeId) {
    return request(`/api/conversations/?node=${nodeId}`);
  },
  createConversation(payload) {
    return request("/api/conversations/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateConversation(id, payload) {
    return request(`/api/conversations/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteConversation(id) {
    return request(`/api/conversations/${id}/`, { method: "DELETE" });
  },

  // Messages
  listMessages(conversationId) {
    return request(`/api/messages/?conversation=${conversationId}`);
  },
  createMessage(payload) {
    return request("/api/messages/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
