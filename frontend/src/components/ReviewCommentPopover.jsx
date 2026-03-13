import { useCallback, useEffect, useRef, useState } from "react";

const COMMENT_TYPES = [
  { id: "praise", label: "Praise", color: "#2b8a3e" },
  { id: "suggestion", label: "Suggestion", color: "#e67700" },
  { id: "issue", label: "Issue", color: "#c92a2a" },
  { id: "note", label: "Note", color: "#868e96" },
];

export function ReviewCommentPopover({
  selection,
  onSave,
  onCancel,
  onExpand,
  containerRef,
  existingComment,
}) {
  const [commentType, setCommentType] = useState(existingComment?.comment_type || "note");
  const [body, setBody] = useState(existingComment?.body || "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onCancel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  const handleSave = useCallback(async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await onSave({
        body: body.trim(),
        comment_type: commentType,
        quoted_text: selection.text,
        position_from: selection.from,
        position_to: selection.to,
      });
    } finally {
      setSaving(false);
    }
  }, [body, commentType, selection, onSave]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  const style = {};
  if (selection?.rect && containerRef?.current) {
    const containerRect = containerRef.current.getBoundingClientRect();
    style.position = "absolute";
    style.top = selection.rect.bottom - containerRect.top + 8;
    style.left = Math.max(0, selection.rect.left - containerRect.left - 60);
  }

  if (existingComment) {
    return (
      <div className="review-comment-popover review-comment-popover--view" ref={popoverRef} style={style}>
        <div className="review-comment-popover__header">
          <span className={`rcp-type-badge rcp-type-badge--${existingComment.comment_type}`}>
            {existingComment.comment_type}
          </span>
        </div>
        <div className="review-comment-popover__body-text">{existingComment.body}</div>
        {existingComment.quoted_text && (
          <div className="review-comment-popover__quote">&ldquo;{existingComment.quoted_text}&rdquo;</div>
        )}
      </div>
    );
  }

  return (
    <div className="review-comment-popover" ref={popoverRef} style={style}>
      <div className="rcp-type-row">
        {COMMENT_TYPES.map((t) => (
          <button
            key={t.id}
            className={`rcp-type-btn${commentType === t.id ? " rcp-type-btn--active" : ""}`}
            style={{ "--type-color": t.color }}
            onMouseDown={(e) => { e.preventDefault(); setCommentType(t.id); }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="rcp-textarea"
        placeholder="Write your comment..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <div className="rcp-actions">
        <button
          className="rcp-save"
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          disabled={!body.trim() || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {onExpand && (
          <button
            className="rcp-expand"
            onMouseDown={(e) => {
              e.preventDefault();
              onExpand({ body, comment_type: commentType, ...selection });
              onCancel();
            }}
          >
            Expand in panel &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
