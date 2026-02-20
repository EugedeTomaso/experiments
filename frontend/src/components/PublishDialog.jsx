import { useState, useEffect } from "react";
import { api } from "../api";
import { TwitterThreadPreview } from "./TwitterThreadPreview";

const PLATFORM_LABELS = {
  medium: "Medium",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
};

export function PublishDialog({ platform, connection, node, project, onClose }) {
  const [title, setTitle] = useState(node?.title || project?.name || "");
  const [tags, setTags] = useState("");
  const [publishStatus, setPublishStatus] = useState("draft");
  const [addNumbering, setAddNumbering] = useState(true);
  const [tweetPreview, setTweetPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // For Twitter, fetch thread preview
  useEffect(() => {
    if (platform !== "twitter") return;
    const payload = {
      platform: "twitter",
      title,
      options: { add_numbering: addNumbering },
    };
    if (node) payload.node_id = node.id;
    else if (project) payload.project_id = project.id;

    api.previewPublish(payload)
      .then((data) => setTweetPreview(data.tweets || []))
      .catch(() => setTweetPreview(null));
  }, [platform, node, project, title, addNumbering]);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const payload = {
        platform,
        title,
        options: {},
      };
      if (node) payload.node_id = node.id;
      else if (project) payload.project_id = project.id;

      if (platform === "medium") {
        payload.options.publish_status = publishStatus;
        if (tags.trim()) {
          payload.options.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }
      if (platform === "twitter") {
        payload.options.add_numbering = addNumbering;
      }

      const record = await api.publish(payload);
      setResult(record);
    } catch (err) {
      setError(err.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="publish-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="publish-dialog">
        <div className="publish-header">
          <h2>Publish to {PLATFORM_LABELS[platform] || platform}</h2>
          <button className="publish-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="publish-body">
          {result ? (
            <div className="publish-success">
              <p>Published successfully!</p>
              {result.platform_url && (
                <p>
                  <a href={result.platform_url} target="_blank" rel="noopener noreferrer">
                    View on {PLATFORM_LABELS[platform]}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="publish-field">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {platform === "medium" && (
                <>
                  <div className="publish-field">
                    <label>Tags (comma-separated, max 5)</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="writing, technology, ai"
                    />
                  </div>
                  <div className="publish-field">
                    <label>Status</label>
                    <select value={publishStatus} onChange={(e) => setPublishStatus(e.target.value)}>
                      <option value="draft">Draft</option>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                    </select>
                  </div>
                </>
              )}

              {platform === "twitter" && (
                <>
                  <div className="publish-field">
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={addNumbering}
                        onChange={(e) => setAddNumbering(e.target.checked)}
                        style={{ width: "auto" }}
                      />
                      Add numbering (1/n, 2/n)
                    </label>
                  </div>
                  {tweetPreview && <TwitterThreadPreview tweets={tweetPreview} />}
                </>
              )}

              {error && (
                <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</div>
              )}
            </>
          )}
        </div>

        <div className="publish-footer">
          <div style={{ fontSize: 12, color: "var(--text-4)" }}>
            Publishing as {connection?.platform_username || "connected account"}
          </div>
          {result ? (
            <button className="publish-btn publish-btn-ghost" onClick={onClose}>
              Close
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="publish-btn publish-btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="publish-btn publish-btn-primary"
                onClick={handlePublish}
                disabled={publishing || !title.trim()}
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
