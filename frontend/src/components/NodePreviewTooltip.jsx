import { useEffect, useRef } from "react";
import { buildSnippet, timeAgo, wordCount } from "../utils";

export function NodePreviewTooltip({ node, rect, onMouseEnter, onMouseLeave }) {
  const tooltipRef = useRef(null);

  // Position the tooltip, ensuring it stays within viewport
  useEffect(() => {
    if (!tooltipRef.current || !rect) return;
    const el = tooltipRef.current;
    const tooltipRect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Position to the right of the tree item
    let top = rect.top;
    let left = rect.right + 8;

    // If tooltip goes below viewport, shift up
    if (top + tooltipRect.height > viewportHeight - 16) {
      top = viewportHeight - tooltipRect.height - 16;
    }
    if (top < 16) top = 16;

    // If tooltip goes past right edge, show to the left instead
    if (left + 280 > window.innerWidth - 16) {
      left = rect.left - 280 - 8;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [rect]);

  const isFolder = node.type === "folder";
  const wc = isFolder ? 0 : wordCount(node.content_md);
  const summary = node.summary ? buildSnippet(node.summary, 200) : null;
  const contentPreview = !isFolder && node.content_md
    ? buildSnippet(node.content_md, 300)
    : null;

  return (
    <div
      ref={tooltipRef}
      className="node-preview"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="node-preview-title">{node.title}</div>
      <div className="node-preview-type">
        {isFolder ? "Folder" : "File"}
        {node.updated_at && <> &middot; Updated {timeAgo(node.updated_at)}</>}
      </div>

      {summary && (
        <>
          <div className="node-preview-divider" />
          <div className="node-preview-summary">{summary}</div>
        </>
      )}

      {contentPreview && (!summary || contentPreview !== summary) && (
        <>
          <div className="node-preview-divider" />
          <div className="node-preview-content">{contentPreview}</div>
        </>
      )}

      {isFolder && node.children && (
        <>
          <div className="node-preview-divider" />
          <div className="node-preview-content">
            {node.children.length} item{node.children.length !== 1 ? "s" : ""} inside
          </div>
        </>
      )}

      {!isFolder && (
        <div className="node-preview-meta">
          {wc > 0 ? `${wc} words` : "Empty document"}
        </div>
      )}
    </div>
  );
}
