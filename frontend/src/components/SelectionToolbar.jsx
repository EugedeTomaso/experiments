import { editorViewCtx } from "@milkdown/kit/core";
import { tooltipFactory, TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import { useInstance } from "@milkdown/react";
import { usePluginViewContext } from "@prosemirror-adapter/react";
import { useEffect, useRef } from "react";

export const selectionTooltip = tooltipFactory("selection-toolbar");

export function SelectionToolbarView() {
  const ref = useRef(null);
  const buttonRef = useRef(null);
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
        const { state } = view;
        const { selection } = state;
        if (selection.empty) return false;
        const text = state.doc.textBetween(selection.from, selection.to, "\n");
        return text.trim().length > 0;
      },
    });

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [loading]);

  // Save current selection on every view update so it's available even if
  // focus is lost before the click handler fires.
  useEffect(() => {
    if (!view) return;
    const { selection } = view.state;
    if (!selection.empty) {
      const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
      if (text.trim().length > 0) {
        savedSelection.current = { from: selection.from, to: selection.to, text };
      }
    }
  });

  useEffect(() => {
    tooltipProvider.current?.update(view, prevState);
  });

  // Use a native mousedown listener directly on the button element so that
  // preventDefault() fires before any browser focus-change behavior.
  // React's onMouseDown uses event delegation (handler at root), which can
  // fire too late — ProseMirror may lose focus/selection before it runs.
  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn || loading) return;

    const handler = (e) => {
      e.preventDefault();

      const sel = savedSelection.current;
      if (!sel) return;

      get().action((ctx) => {
        const editorView = ctx.get(editorViewCtx);
        const coords = editorView.coordsAtPos(sel.from);
        const rect = {
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          right: coords.right,
        };

        editorView.dom.dispatchEvent(
          new CustomEvent("comment-selection-request", {
            detail: { from: sel.from, to: sel.to, text: sel.text, rect },
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
      <button className="selection-toolbar-btn" ref={buttonRef}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Comment
      </button>
    </div>
  );
}
