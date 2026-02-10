import { useEffect, useRef, useCallback } from "react";

export function CommentPopover({ comments, rect, onClose }) {
  const containerRef = useRef(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handleClose]);

  const style = {
    position: "fixed",
    top: rect.bottom + 8,
    left: Math.max(8, rect.left),
    zIndex: 200,
  };

  return (
    <div className="comment-popover" ref={containerRef} style={style}>
      {comments.map((c) => (
        <div key={c.id} className="comment-popover-item">
          <div className="comment-popover-body">{c.body}</div>
          <div className="comment-popover-meta">
            {new Date(c.created_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
