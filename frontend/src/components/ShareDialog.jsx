import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

const ROLES = ["viewer", "commenter", "editor", "admin"];

export function ShareDialog({ project, isOpen, onClose, onProjectUpdate }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [publicCopied, setPublicCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!project?.id) return;
    try {
      const data = await api.listMembers(project.id);
      setMembers(data);
    } catch {}
  }, [project?.id]);

  useEffect(() => {
    if (isOpen && project?.id) {
      fetchMembers();
      setError("");
      setInviteEmail("");
    }
  }, [isOpen, project?.id, fetchMembers]);

  if (!isOpen || !project) return null;

  const isLinkSharing = project.visibility === "link_viewable";

  const handleToggleLinkSharing = async () => {
    try {
      const newVisibility = isLinkSharing ? "private" : "link_viewable";
      await api.updateProject(project.id, { visibility: newVisibility });
      onProjectUpdate?.();
    } catch {}
  };

  const handleRegenerateToken = async () => {
    try {
      await api.regenerateShareToken(project.id);
      onProjectUpdate?.();
    } catch {}
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/shared/${project.share_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPublicLink = () => {
    const link = `${window.location.origin.replace(':5174', ':8000').replace(':5173', ':8000')}/public/${project.share_token}/`;
    navigator.clipboard.writeText(link);
    setPublicCopied(true);
    setTimeout(() => setPublicCopied(false), 2000);
  };

  const handlePublishSnapshot = async () => {
    setPublishing(true);
    try {
      await api.publishSnapshot(project.id);
      onProjectUpdate?.();
    } catch {} finally {
      setPublishing(false);
    }
  };

  const handleUnpublishSnapshot = async () => {
    setPublishing(true);
    try {
      await api.unpublishSnapshot(project.id);
      onProjectUpdate?.();
    } catch {} finally {
      setPublishing(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.inviteToProject(project.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      fetchMembers();
    } catch (err) {
      const msg = err.message;
      try { setError(JSON.parse(msg).detail); } catch { setError(msg); }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateMemberRole(project.id, userId, newRole);
      fetchMembers();
    } catch {}
  };

  const handleRemove = async (userId) => {
    try {
      await api.removeMember(project.id, userId);
      fetchMembers();
    } catch {}
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-header">
          <h3>Share "{project.name}"</h3>
          <button className="share-close" onClick={onClose}>×</button>
        </div>

        {/* Invite form */}
        <form className="share-invite-row" onSubmit={handleInvite}>
          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="share-invite-input"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="share-role-select"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button type="submit" className="share-invite-btn" disabled={loading || !inviteEmail.trim()}>
            Invite
          </button>
        </form>
        {error && <p className="share-error">{error}</p>}

        {/* Members list */}
        <div className="share-members">
          {members.map((m) => (
            <div key={m.user_id} className="share-member-row">
              <div className="share-member-avatar">
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="share-member-info">
                <span className="share-member-name">{m.name || m.email}</span>
                <span className="share-member-email">{m.email}</span>
              </div>
              {m.role === "owner" ? (
                <span className="share-owner-badge">Owner</span>
              ) : (
                <div className="share-member-actions">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                    className="share-role-select share-role-select--small"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                  <button
                    className="share-remove-btn"
                    onClick={() => handleRemove(m.user_id)}
                    title="Remove member"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Link sharing */}
        <div className="share-link-section">
          <div className="share-link-toggle">
            <div>
              <span className="share-link-label">Public link</span>
              <span className="share-link-desc">Anyone with the link can view</span>
            </div>
            <button
              className={`share-toggle${isLinkSharing ? " active" : ""}`}
              onClick={handleToggleLinkSharing}
            >
              <span className="share-toggle-knob" />
            </button>
          </div>
          {isLinkSharing && project.share_token && (
            <div className="share-link-actions">
              <button className="share-copy-btn" onClick={handleCopyLink}>
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button className="share-regen-btn" onClick={handleRegenerateToken}>
                Regenerate
              </button>
            </div>
          )}
        </div>

        {/* Public page */}
        {isLinkSharing && project.share_token && (
          <div className="share-link-section">
            <div className="share-link-toggle">
              <div>
                <span className="share-link-label">Public page</span>
                <span className="share-link-desc">
                  Shareable webpage version of your document
                </span>
              </div>
            </div>
            <div className="share-public-url">
              <code className="share-public-url-text">
                /public/{project.share_token?.slice(0, 8)}...
              </code>
              <button className="share-copy-btn" onClick={handleCopyPublicLink}>
                {publicCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="share-publish-mode">
              <label className="share-radio">
                <input
                  type="radio"
                  name="publishMode"
                  checked={!project.published_snapshot}
                  onChange={handleUnpublishSnapshot}
                  disabled={publishing}
                />
                <span>Live — always shows latest content</span>
              </label>
              <label className="share-radio">
                <input
                  type="radio"
                  name="publishMode"
                  checked={!!project.published_snapshot}
                  onChange={handlePublishSnapshot}
                  disabled={publishing}
                />
                <span>
                  Published version
                  {project.published_at && (
                    <> — frozen {new Date(project.published_at).toLocaleDateString()}</>
                  )}
                </span>
              </label>
              {project.published_snapshot && (
                <button
                  className="share-update-btn"
                  onClick={handlePublishSnapshot}
                  disabled={publishing}
                >
                  {publishing ? "Updating..." : "Update to latest"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
