import { editorViewCtx } from "@milkdown/kit/core";
import { tooltipFactory, TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import { useInstance } from "@milkdown/react";
import { usePluginViewContext } from "@prosemirror-adapter/react";
import { useEffect, useRef } from "react";

export const reviewerTooltip = tooltipFactory("reviewer-toolbar");

const CommentIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export function ReviewerToolbarView() {
  const ref = useRef(null);
  const commentBtnRef = useRef(null);
  const tooltipProvider = useRef(null);
  const savedSelection = useRef(null);
  const { view, prevState } = usePluginViewContext();
  const [loading, get] = useInstance();

  useEffect(() => {
    const div = ref.current;
    if (loading || !div) return;

    tooltipProvider.current = new TooltipProvider({
      content: div,
      debounce: 200,
      shouldShow(view) {
        const { selection } = view.state;
        if (selection.empty) return false;
        const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
        return text.trim().length > 0;
      },
    });

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [loading]);

  useEffect(() => {
    if (!view) return;
    const { selection } = view.state;
    if (!selection.empty) {
      const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
      if (text.trim().length > 0) {
        savedSelection.current = { from: selection.from, to: selection.to, text };
      }
    }
  }, [view, prevState]);

  useEffect(() => {
    tooltipProvider.current?.update(view, prevState);
  }, [view, prevState]);

  useEffect(() => {
    const btn = commentBtnRef.current;
    if (!btn || loading) return;

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const sel = savedSelection.current;
      if (!sel) return;

      get().action((ctx) => {
        const editorView = ctx.get(editorViewCtx);
        const coords = editorView.coordsAtPos(sel.from);
        editorView.dom.dispatchEvent(
          new CustomEvent("review-comment-request", {
            detail: {
              from: sel.from,
              to: sel.to,
              text: sel.text,
              rect: { top: coords.top, bottom: coords.bottom, left: coords.left, right: coords.right },
            },
            bubbles: true,
          })
        );
      });

      tooltipProvider.current?.hide();
    };

    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  return (
    <div className="selection-toolbar-anchor" ref={ref}>
      <div className="selection-toolbar reviewer-toolbar">
        <button
          className="fmt-btn fmt-btn-comment"
          title="Add review comment"
          ref={commentBtnRef}
        >
          {CommentIcon}
          <span className="fmt-comment-label">Comment</span>
        </button>
      </div>
    </div>
  );
}
