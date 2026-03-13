import { editorViewCtx } from "@milkdown/kit/core";
import { tooltipFactory, TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { toggleHighlightCommand } from "../highlightPlugin";
import { callCommand } from "@milkdown/kit/utils";
import { useInstance } from "@milkdown/react";
import { usePluginViewContext } from "@prosemirror-adapter/react";
import { useEffect, useRef, useState } from "react";

export const selectionTooltip = tooltipFactory("selection-toolbar");

function isMarkActive(state, markType) {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!markType.isInSet(state.storedMarks || $from.marks());
  return state.doc.rangeHasMark(from, to, markType);
}

const BoldIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);

const ItalicIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);

const StrikethroughIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h6" />
    <path d="M8 20h7a3 3 0 0 0 3-3v0a3 3 0 0 0-3-3H6" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
);

const CodeIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const HighlightIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const CommentIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const AskAIIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9.937 4.562 11.5 1l1.563 3.562L16.625 6.5l-3.562 1.063L11.5 11.125 9.937 7.563 6.375 6.5Z" fill="currentColor"/>
    <path d="M17 10.5 18.25 8l1.25 2.5L22 11.75l-2.5 1.25L18.25 15.5 17 13l-2.5-1.25Z" fill="currentColor"/>
  </svg>
);

export function SelectionToolbarView() {
  const ref = useRef(null);
  const commentBtnRef = useRef(null);
  const aiBtnRef = useRef(null);
  const boldBtnRef = useRef(null);
  const italicBtnRef = useRef(null);
  const strikeBtnRef = useRef(null);
  const codeBtnRef = useRef(null);
  const highlightBtnRef = useRef(null);
  const tooltipProvider = useRef(null);
  const savedSelection = useRef(null);
  const suppressed = useRef(false);
  const { view, prevState } = usePluginViewContext();
  const [loading, get] = useInstance();
  const [activeMarks, setActiveMarks] = useState({
    strong: false,
    emphasis: false,
    strikethrough: false,
    inlineCode: false,
  });

  useEffect(() => {
    const div = ref.current;
    if (loading || !div) return;

    tooltipProvider.current = new TooltipProvider({
      content: div,
      debounce: 200,
      shouldShow(view) {
        const { state } = view;
        const { selection } = state;
        if (selection.empty) {
          suppressed.current = false;
          return false;
        }
        if (suppressed.current) return false;
        const text = state.doc.textBetween(selection.from, selection.to, "\n");
        return text.trim().length > 0;
      },
    });

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [loading]);

  // Save current selection and detect active marks on every view update
  useEffect(() => {
    if (!view) return;
    const { selection } = view.state;
    if (!selection.empty) {
      const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
      if (text.trim().length > 0) {
        savedSelection.current = { from: selection.from, to: selection.to, text };
      }
    }

    // Detect active marks
    const schema = view.state.schema;
    setActiveMarks({
      strong: schema.marks.strong ? isMarkActive(view.state, schema.marks.strong) : false,
      emphasis: schema.marks.emphasis ? isMarkActive(view.state, schema.marks.emphasis) : false,
      strikethrough: schema.marks.strikethrough ? isMarkActive(view.state, schema.marks.strikethrough) : false,
      inlineCode: schema.marks.inlineCode ? isMarkActive(view.state, schema.marks.inlineCode) : false,
      highlight: schema.marks.highlight ? isMarkActive(view.state, schema.marks.highlight) : false,
    });
  });

  useEffect(() => {
    tooltipProvider.current?.update(view, prevState);
  });

  // Bold
  useEffect(() => {
    const btn = boldBtnRef.current;
    if (!btn || loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      get().action(callCommand(toggleStrongCommand.key));
    };
    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Italic
  useEffect(() => {
    const btn = italicBtnRef.current;
    if (!btn || loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      get().action(callCommand(toggleEmphasisCommand.key));
    };
    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Strikethrough
  useEffect(() => {
    const btn = strikeBtnRef.current;
    if (!btn || loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      get().action(callCommand(toggleStrikethroughCommand.key));
    };
    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Inline Code
  useEffect(() => {
    const btn = codeBtnRef.current;
    if (!btn || loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      get().action(callCommand(toggleInlineCodeCommand.key));
    };
    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Highlight
  useEffect(() => {
    const btn = highlightBtnRef.current;
    if (!btn || loading) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      get().action(callCommand(toggleHighlightCommand.key));
    };
    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Comment button — reuses existing logic
  useEffect(() => {
    const btn = commentBtnRef.current;
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

      suppressed.current = true;
      tooltipProvider.current?.hide();
    };

    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  // Ask AI button
  useEffect(() => {
    const btn = aiBtnRef.current;
    if (!btn || loading) return;

    const handler = (e) => {
      e.preventDefault();

      const sel = savedSelection.current;
      if (!sel) return;

      get().action((ctx) => {
        const editorView = ctx.get(editorViewCtx);
        editorView.dom.dispatchEvent(
          new CustomEvent("ai-selection-request", {
            detail: { from: sel.from, to: sel.to, text: sel.text },
            bubbles: true,
          })
        );
      });

      suppressed.current = true;
      tooltipProvider.current?.hide();
    };

    btn.addEventListener("mousedown", handler);
    return () => btn.removeEventListener("mousedown", handler);
  }, [loading, get]);

  return (
    <div className="selection-toolbar-anchor" ref={ref}>
      <div className="selection-toolbar">
        <button
          className={`fmt-btn${activeMarks.strong ? " fmt-btn-active" : ""}`}
          title="Bold (⌘B)"
          ref={boldBtnRef}
        >
          {BoldIcon}
        </button>
        <button
          className={`fmt-btn${activeMarks.emphasis ? " fmt-btn-active" : ""}`}
          title="Italic (⌘I)"
          ref={italicBtnRef}
        >
          {ItalicIcon}
        </button>
        <button
          className={`fmt-btn${activeMarks.strikethrough ? " fmt-btn-active" : ""}`}
          title="Strikethrough"
          ref={strikeBtnRef}
        >
          {StrikethroughIcon}
        </button>
        <button
          className={`fmt-btn${activeMarks.inlineCode ? " fmt-btn-active" : ""}`}
          title="Code"
          ref={codeBtnRef}
        >
          {CodeIcon}
        </button>
        <button
          className={`fmt-btn${activeMarks.highlight ? " fmt-btn-active" : ""}`}
          title="Highlight (⌘⇧H)"
          ref={highlightBtnRef}
        >
          {HighlightIcon}
        </button>
        <div className="fmt-separator" />
        <button
          className="fmt-btn fmt-btn-comment"
          title="Comment"
          ref={commentBtnRef}
        >
          {CommentIcon}
          <span className="fmt-comment-label">Comment</span>
        </button>
        <button
          className="fmt-btn fmt-btn-ai"
          title="Ask AI"
          ref={aiBtnRef}
        >
          {AskAIIcon}
          <span className="fmt-comment-label">Ask AI</span>
        </button>
      </div>
    </div>
  );
}
