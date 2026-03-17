import React, { useEffect, useRef, useCallback } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { history } from "@milkdown/plugin-history";
import { TextSelection, Plugin } from "@milkdown/kit/prose/state";
import { replaceAll } from "@milkdown/utils";
import { $prose } from "@milkdown/kit/utils";
import { diffReplaceAll } from "./diffUpdate";
import { aiTextPlugin, aiTextPluginKey } from "./aiTextAppearPlugin";
import { ProsemirrorAdapterProvider, usePluginViewFactory } from "@prosemirror-adapter/react";
import { slash, SlashView } from "./components/SlashMenu";
import { selectionTooltip, SelectionToolbarView } from "./components/SelectionToolbar";
import { reviewerTooltip, ReviewerToolbarView } from "./components/ReviewerToolbar";
import { commentDecoPlugin, commentDecoPluginKey } from "./commentDecorationPlugin";
import { applySuggestion } from "./commentPositions";
import { linkPreviewPlugin } from "./linkPreviewPlugin";
import { highlightPlugin, configHighlightStringify } from "./highlightPlugin";
import { calloutPlugin, configCalloutStringify } from "./calloutPlugin";
import { mermaidPlugin } from "./mermaidPlugin";
import { createMarginAvatarPlugin } from "./marginAvatarPlugin";
import "@milkdown/theme-nord/style.css";

function MarkdownEditorInner({ value, onChange, docId, comments = [], focusedCommentId, flashCommentId, editorRef, readOnly = false, currentRole, collabSession, reviewerMode = false, aiIntensity = "silent", onRequestGhostText }) {
  const pluginViewFactory = usePluginViewFactory();
  const [loading, get] = useInstance();
  const shellRef = useRef(null);
  const ghostTimerRef = useRef(null);
  const ghostAbortRef = useRef(null);
  const prevDocIdRef = useRef(docId);
  const suppressOnChangeRef = useRef(false);

  useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          if (!collabSession) {
            ctx.set(defaultValueCtx, value || "");
          }
          if (reviewerMode) {
            ctx.set(reviewerTooltip.key, {
              view: pluginViewFactory({
                component: ReviewerToolbarView,
              }),
            });
          } else {
            ctx.set(slash.key, {
              view: pluginViewFactory({
                component: SlashView,
              }),
            });
            ctx.set(selectionTooltip.key, {
              view: pluginViewFactory({
                component: SelectionToolbarView,
              }),
            });
          }
          if (readOnly && !reviewerMode) {
            ctx.update(editorViewOptionsCtx, (prev) => ({
              ...prev,
              editable: () => false,
            }));
          }
        })
        .config(nord)
        .config(configHighlightStringify)
        .config(configCalloutStringify)
        .use(commonmark)
        .use(gfm)
        .use(highlightPlugin)
        .use(calloutPlugin);

      if (collabSession) {
        for (const plugin of collabSession.prosemirrorPlugins) {
          editor.use($prose(() => plugin));
        }
        editor.use(createMarginAvatarPlugin(collabSession.awareness));
      } else {
        editor.use(history);
      }

      editor.use(listener);

      if (reviewerMode) {
        editor.use(reviewerTooltip);
        editor.use($prose(() => new Plugin({
          filterTransaction(tr) {
            return !tr.docChanged;
          },
        })));
      } else {
        editor.use(slash).use(selectionTooltip);
      }

      editor
        .use(commentDecoPlugin)
        .use(aiTextPlugin)
        .use(linkPreviewPlugin)
        .use(mermaidPlugin)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            if (suppressOnChangeRef.current) return;
            onChange?.(markdown);
          });
        });

      return editor;
    },
    [!!collabSession, reviewerMode]
  );

  // When docId changes, swap content instantly via replaceAll (no editor recreation)
  useEffect(() => {
    if (prevDocIdRef.current === docId) return;
    prevDocIdRef.current = docId;
    if (loading || collabSession) return;
    const editor = get();
    if (!editor?.action) return;
    try {
      suppressOnChangeRef.current = true;
      editor.action(replaceAll(value || ""));
      // Reset undo history for the new document
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        // Clear AI text plugin state
        view.dispatch(view.state.tr.setMeta(aiTextPluginKey, "clear"));
      });
      // Re-enable onChange on next microtask (after listener fires)
      Promise.resolve().then(() => { suppressOnChangeRef.current = false; });
    } catch {
      suppressOnChangeRef.current = false;
    }
  }, [docId, value, loading, get, collabSession]);

  // Sync comments + focus/flash state into the decoration plugin
  useEffect(() => {
    if (loading) return;
    const editor = get();
    if (!editor?.action) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setMeta(commentDecoPluginKey, {
        comments,
        focusedId: focusedCommentId,
        flashId: flashCommentId,
      });
      view.dispatch(tr);
    });
  }, [comments, focusedCommentId, flashCommentId, loading, get]);

  // Expose scrollToPos to parent
  useEffect(() => {
    if (loading || !editorRef) return;
    editorRef.current = {
      scrollToPos(from, to) {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          try {
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, from, to)
            );
            view.dispatch(tr.scrollIntoView());
            view.focus();
          } catch (_) {
            // Position out of range
          }
        });
      },
      focus() {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.focus();
        });
      },
      getView() {
        try {
          let view = null;
          get().action((ctx) => { view = ctx.get(editorViewCtx); });
          return view;
        } catch {
          return null;
        }
      },
      replaceContent(markdown) {
        get().action(replaceAll(markdown));
      },
      replaceContentDiff(markdown, opts) {
        get().action(diffReplaceAll(markdown, opts));
      },
      clearAiHighlights() {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(aiTextPluginKey, "clear"));
        });
      },
      showDiffHighlights() {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(aiTextPluginKey, "show-diff"));
        });
      },
      hideAiDiffHighlights() {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(aiTextPluginKey, "hide-diff"));
        });
      },
      hasDiffData() {
        try {
          let result = false;
          get().action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const pluginState = aiTextPluginKey.getState(view.state);
            result = !!(pluginState && pluginState.savedOldDoc);
          });
          return result;
        } catch {
          return false;
        }
      },
      getDiffStats() {
        try {
          let stats = null;
          get().action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const pluginState = aiTextPluginKey.getState(view.state);
            stats = pluginState?.stats || null;
          });
          return stats;
        } catch {
          return null;
        }
      },
      applySuggestion(quotedText, suggestedText, hintFrom) {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          return applySuggestion(view, quotedText, suggestedText, hintFrom);
        });
      },
      getSelection() {
        try {
          let sel = null;
          get().action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { from, to } = view.state.selection;
            if (from === to) return;
            const text = view.state.doc.textBetween(from, to, " ");
            if (text.trim()) sel = { from, to, text };
          });
          return sel;
        } catch {
          return null;
        }
      },
      compareWithVersion(markdown) {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);
          const oldDoc = parser(markdown);
          if (!oldDoc) return;
          // Set the parsed version as the comparison baseline
          const tr = view.state.tr.setMeta(aiTextPluginKey, { action: "set-compare-doc", doc: oldDoc });
          view.dispatch(tr);
          // Show the diff
          const tr2 = view.state.tr.setMeta(aiTextPluginKey, "show-diff");
          view.dispatch(tr2);
        });
      },
      showGhostText(text, pos) {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(aiTextPluginKey, {
            action: "show-ghost",
            text,
            pos,
          }));
        });
      },
      clearGhostText() {
        get().action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(aiTextPluginKey, { action: "clear-ghost" }));
        });
      },
    };
  }, [loading, get, editorRef]);

  // Helper to get the ProseMirror EditorView safely
  const getView = useCallback(() => {
    if (loading) return null;
    let view = null;
    try {
      get().action((ctx) => { view = ctx.get(editorViewCtx); });
    } catch { /* editor not ready */ }
    return view;
  }, [loading, get]);

  // Ghost text: pause detection — fires after 2s of inactivity
  useEffect(() => {
    if (aiIntensity === "silent" || readOnly) return;
    const view = getView();
    if (!view) return;

    const handleKeyUp = (e) => {
      // Don't trigger on modifier keys, navigation, or Tab/Escape
      if (e.key === "Tab" || e.key === "Escape" || e.key === "Shift" ||
          e.key === "Control" || e.key === "Alt" || e.key === "Meta" ||
          e.key.startsWith("Arrow")) return;

      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      if (ghostAbortRef.current) { ghostAbortRef.current.abort(); ghostAbortRef.current = null; }

      ghostTimerRef.current = setTimeout(() => {
        const { state } = view;
        const { from, to } = state.selection;
        // Only trigger on cursor (not range selection)
        if (from !== to) return;
        // Get context: up to 500 chars before cursor
        const textBefore = state.doc.textBetween(
          Math.max(0, from - 500), from, "\n"
        );
        // Only suggest if there's meaningful content
        if (textBefore.trim().length > 20) {
          onRequestGhostText?.(textBefore, from);
        }
      }, 2000);
    };

    const clearGhost = (e) => {
      // Don't clear on Tab (handled separately for accept) or Escape
      if (e.key === "Tab" || e.key === "Escape") return;
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      if (ghostAbortRef.current) { ghostAbortRef.current.abort(); ghostAbortRef.current = null; }
    };

    view.dom.addEventListener("keyup", handleKeyUp);
    view.dom.addEventListener("keydown", clearGhost);

    return () => {
      view.dom.removeEventListener("keyup", handleKeyUp);
      view.dom.removeEventListener("keydown", clearGhost);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      if (ghostAbortRef.current) { ghostAbortRef.current.abort(); ghostAbortRef.current = null; }
    };
  }, [getView, aiIntensity, readOnly, onRequestGhostText]);

  // Ghost text: Tab to accept, Escape to dismiss
  useEffect(() => {
    const view = getView();
    if (!view) return;

    const handleKeyDown = (e) => {
      const pluginState = aiTextPluginKey.getState(view.state);
      if (!pluginState?.ghostText) return;

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const { text, pos } = pluginState.ghostText;
        // insertText changes the doc, which auto-clears ghost in the plugin's apply
        const tr = view.state.tr.insertText(text, pos);
        view.dispatch(tr);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        view.dispatch(view.state.tr.setMeta(aiTextPluginKey, { action: "clear-ghost" }));
        return;
      }
    };

    // Use capture phase to intercept before ProseMirror/Milkdown Tab handling
    view.dom.addEventListener("keydown", handleKeyDown, true);

    return () => {
      view.dom.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [getView]);

  return (
    <div
      className={`editor-shell${readOnly ? " editor-readonly" : ""}${reviewerMode ? " editor-reviewer" : ""}${currentRole === "commenter" ? " editor-commenter" : ""}`}
      ref={shellRef}
    >
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor(props) {
  return (
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
        <MarkdownEditorInner {...props} />
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  );
}
