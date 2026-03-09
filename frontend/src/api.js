const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export function getAuthHeader() {
  const token = localStorage.getItem("mive:access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let _refreshPromise = null;

async function refreshAccessToken() {
  const refresh = localStorage.getItem("mive:refresh_token");
  if (!refresh) throw new Error("No refresh token");
  const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  const data = await res.json();
  localStorage.setItem("mive:access_token", data.access);
  if (data.refresh) localStorage.setItem("mive:refresh_token", data.refresh);
  return data.access;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
    ...options,
  });

  // On 401, try refreshing the token and retry once
  if (response.status === 401 && localStorage.getItem("mive:refresh_token")) {
    try {
      // Deduplicate concurrent refresh attempts
      if (!_refreshPromise) {
        _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
      }
      const newToken = await _refreshPromise;

      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...(options.headers || {}),
        },
      });

      if (!retry.ok) {
        const text = await retry.text();
        const error = new Error(text || `Request failed: ${retry.status}`);
        error.status = retry.status;
        throw error;
      }
      if (retry.status === 204) return null;
      return retry.json();
    } catch {
      // Refresh failed — clear tokens so user gets redirected to login
      localStorage.removeItem("mive:access_token");
      localStorage.removeItem("mive:refresh_token");
      const error = new Error("Session expired");
      error.status = 401;
      throw error;
    }
  }

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
  updateProject(id, payload) {
    return request(`/api/projects/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteProject(id) {
    return request(`/api/projects/${id}/`, { method: "DELETE" });
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
    return request(`/api/comments/?node=${nodeId}&root_only=true`);
  },
  createComment(payload) {
    return request("/api/comments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateComment(id, payload) {
    return request(`/api/comments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteComment(id) {
    return request(`/api/comments/${id}/`, { method: "DELETE" });
  },
  approveComment(id) {
    return request(`/api/comments/${id}/approve/`, { method: "POST" });
  },
  rejectComment(id) {
    return request(`/api/comments/${id}/reject/`, { method: "POST" });
  },
  resolveComment(id) {
    return request(`/api/comments/${id}/resolve/`, { method: "POST" });
  },

  // AI Fact-Check
  factCheck(payload) {
    const token = localStorage.getItem("mive:access_token");
    return fetch(`${API_BASE}/api/ai/fact-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  },

  // AI Review
  requestReview(payload) {
    return request("/api/ai/review", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  requestCommentReply(payload) {
    return request("/api/ai/comment-reply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // AI Critique
  requestCritique(payload) {
    return request("/api/ai/critique", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listCritiques(nodeId) {
    return request(`/api/critiques/?node_id=${nodeId}`);
  },

  getCritique(id) {
    return request(`/api/critiques/${id}/`);
  },

  discussCritiqueSection(payload) {
    return request("/api/ai/critique-discuss", {
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
  routeAgent(payload) {
    return request("/api/ai/route-agent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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

  // Memories
  listMemories(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/memories/?${query}`);
  },
  createMemory(payload) {
    return request("/api/memories/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateMemory(id, payload) {
    return request(`/api/memories/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteMemory(id) {
    return request(`/api/memories/${id}/`, { method: "DELETE" });
  },
  resolveMemories(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/api/memories/resolve/?${query}`);
  },

  // Publish — Connections
  listConnections() {
    return request("/api/publish/connections/");
  },
  deleteConnection(id) {
    return request(`/api/publish/connections/${id}/`, { method: "DELETE" });
  },
  initiateOAuth(platform) {
    return request(`/api/publish/connect/${platform}/`);
  },

  // Publish — Actions
  publish(payload) {
    return request("/api/publish/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  previewPublish(payload) {
    return request("/api/publish/preview/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  publishHistory() {
    return request("/api/publish/history/");
  },

  // Export formats
  exportFormats(projectType) {
    return request(`/api/export/formats/?type=${encodeURIComponent(projectType)}`);
  },

  // Link preview
  fetchLinkPreview(url) {
    return request(`/api/link-preview/?url=${encodeURIComponent(url)}`);
  },

  // AI Autocomplete
  autocomplete(text, context = "") {
    return request("/api/ai/autocomplete", {
      method: "POST",
      body: JSON.stringify({ text, context }),
    });
  },

  // Sharing — Invitations
  inviteToProject(projectId, { email, role }) {
    return request(`/api/projects/${projectId}/invite/`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },
  listInvitations() {
    return request("/api/invitations/");
  },
  acceptInvitation(id) {
    return request(`/api/invitations/${id}/accept/`, { method: "POST" });
  },
  declineInvitation(id) {
    return request(`/api/invitations/${id}/decline/`, { method: "POST" });
  },

  // Sharing — Members
  listMembers(projectId) {
    return request(`/api/projects/${projectId}/members/`);
  },
  updateMemberRole(projectId, userId, role) {
    return request(`/api/projects/${projectId}/members/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  removeMember(projectId, userId) {
    return request(`/api/projects/${projectId}/members/${userId}/`, { method: "DELETE" });
  },

  // Sharing — Public link
  regenerateShareToken(projectId) {
    return request(`/api/projects/${projectId}/regenerate-share-token/`, { method: "POST" });
  },

  publishSnapshot(projectId) {
    return request(`/api/projects/${projectId}/publish-snapshot/`, {
      method: "POST",
    });
  },

  unpublishSnapshot(projectId) {
    return request(`/api/projects/${projectId}/unpublish-snapshot/`, {
      method: "POST",
    });
  },

  // Marketplace (reviewer)
  listMarketplace(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/marketplace/${qs ? `?${qs}` : ""}`);
  },
  getMarketplaceListing(id) {
    return request(`/api/marketplace/${id}/`);
  },
  getListingNodes(listingId) {
    return request(`/api/marketplace/${listingId}/nodes/`);
  },
  getListingNode(listingId, nodeId) {
    return request(`/api/marketplace/${listingId}/nodes/${nodeId}/`);
  },

  // Reviews (reviewer)
  createReview(listingId) {
    return request("/api/reviews/", {
      method: "POST",
      body: JSON.stringify({ listing: listingId }),
    });
  },
  listMyReviews() {
    return request("/api/reviews/");
  },
  getReview(id) {
    return request(`/api/reviews/${id}/`);
  },
  updateReview(id, payload) {
    return request(`/api/reviews/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  submitReview(id) {
    return request(`/api/reviews/${id}/submit/`, { method: "POST" });
  },
  listReviewComments(reviewId) {
    return request(`/api/reviews/${reviewId}/comments/`);
  },
  createReviewComment(reviewId, payload) {
    return request(`/api/reviews/${reviewId}/comments/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateReviewComment(reviewId, commentId, payload) {
    return request(`/api/reviews/${reviewId}/comments/${commentId}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteReviewComment(reviewId, commentId) {
    return request(`/api/reviews/${reviewId}/comments/${commentId}/`, {
      method: "DELETE",
    });
  },

  // Listings (writer)
  createListing(payload) {
    return request("/api/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listMyListings() {
    return request("/api/listings/");
  },
  delistListing(id) {
    return request(`/api/listings/${id}/delist/`, { method: "POST" });
  },
  refreshListingScore(id) {
    return request(`/api/listings/${id}/refresh-score/`, { method: "POST" });
  },
  getListingReviews(id) {
    return request(`/api/listings/${id}/reviews/`);
  },
  analyzeForReview(reviewId, tool, nodeId = null) {
    return request(`/api/reviews/${reviewId}/ai/analyze`, {
      method: "POST",
      body: JSON.stringify({ tool, node_id: nodeId }),
    });
  },
  chatForReview(reviewId, message, nodeId = null) {
    return request(`/api/reviews/${reviewId}/ai/chat`, {
      method: "POST",
      body: JSON.stringify({ message, node_id: nodeId }),
    });
  },
};
