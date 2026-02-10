import { useState, useEffect, useRef, useCallback } from "react";

export function CommentInput({ rect, onSubmit, onCancel }) {
  const [body, setBody] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCancel = useCallback(() => onCancel(), [onCancel]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handleCancel]);

  const handleSubmit = () => {
    if (body.trim()) {
      onSubmit(body.trim());
    }
  };

  const style = {
    position: "fixed",
    top: rect.bottom + 8,
    left: Math.max(8, rect.left),
    zIndex: 200,
  };

  return (
    <div className="comment-input-float" ref={containerRef} style={style}>
      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add your comment..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") handleCancel();
        }}
      />
      <div className="comment-input-float-actions">
        <button className="ghost" onClick={handleCancel}>
          Cancel
        </button>
        <button className="primary" onClick={handleSubmit} disabled={!body.trim()}>
          Post
        </button>
      </div>
    </div>
  );
}
