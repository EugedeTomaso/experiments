import { useCallback, useState } from "react";
import { api } from "../api";

export function ReportBuilder({ review, comments, onCommentDelete, onSubmitted }) {
  const [summary, setSummary] = useState(review.summary || "");
  const [verdict, setVerdict] = useState(review.verdict || "");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateReview(review.id, { summary, verdict });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  }, [review.id, summary, verdict]);

  const handleSubmit = useCallback(async () => {
    if (!summary.trim()) {
      alert("Please write a summary before submitting.");
      return;
    }
    if (!verdict) {
      alert("Please select a verdict before submitting.");
      return;
    }
    if (!confirm("Submit this review? The writer will be able to see it.")) return;
    setSubmitting(true);
    try {
      await api.updateReview(review.id, { summary, verdict });
      await api.submitReview(review.id);
      onSubmitted?.();
    } catch (err) {
      alert(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }, [review.id, summary, verdict, onSubmitted]);

  const grouped = {};
  comments.forEach((c) => {
    const key = c.node_title || `Node ${c.node}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  if (showPreview) {
    return (
      <div className="report-builder">
        <button className="btn-text" onClick={() => setShowPreview(false)}>&larr; Back to editor</button>
        <div className="report-preview">
          <h3>Review Report Preview</h3>
          <div className="report-preview__verdict">
            Verdict: <strong>{verdict || "(not set)"}</strong>
          </div>
          <div className="report-preview__summary">
            <h4>Summary</h4>
            <p>{summary || "(no summary)"}</p>
          </div>
          <div className="report-preview__comments">
            <h4>Comments ({comments.length})</h4>
            {Object.entries(grouped).map(([nodeTitle, nodeComments]) => (
              <div key={nodeTitle} className="report-preview__group">
                <h5>{nodeTitle}</h5>
                {nodeComments.map((c) => (
                  <div key={c.id} className="report-preview__comment">
                    <span className={`comment-type-tag comment-type-tag--${c.comment_type}`}>{c.comment_type}</span>
                    <span>{c.body}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-builder">
      <div className="report-builder__section">
        <label className="report-builder__label">Verdict</label>
        <select
          className="report-builder__select"
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
        >
          <option value="">Select...</option>
          <option value="promising">Promising</option>
          <option value="needs_work">Needs Work</option>
          <option value="publish_ready">Publish Ready</option>
        </select>
      </div>

      <div className="report-builder__section">
        <label className="report-builder__label">Summary</label>
        <textarea
          className="report-builder__textarea"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write your overall assessment..."
          rows={6}
        />
      </div>

      <div className="report-builder__section">
        <label className="report-builder__label">Inline Comments ({comments.length})</label>
        {Object.entries(grouped).length === 0 ? (
          <p className="report-builder__empty">No comments yet. Select text in the editor to add comments.</p>
        ) : (
          Object.entries(grouped).map(([nodeTitle, nodeComments]) => (
            <div key={nodeTitle} className="report-builder__group">
              <h5 className="report-builder__group-title">{nodeTitle}</h5>
              {nodeComments.map((c) => (
                <div key={c.id} className="report-builder__comment">
                  <span className={`comment-type-tag comment-type-tag--${c.comment_type}`}>{c.comment_type}</span>
                  <span className="report-builder__comment-body">{c.body}</span>
                  <button className="btn-text" onClick={() => onCommentDelete(c.id)}>&times;</button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="report-builder__actions">
        <button className="btn-secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button className="btn-secondary" onClick={() => setShowPreview(true)}>
          Preview
        </button>
        <button className="report-builder__submit" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
