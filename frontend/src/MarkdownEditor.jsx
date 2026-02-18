import React, { useEffect, useRef } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { history } from "@milkdown/plugin-history";
import { TextSelection } from "@milkdown/kit/prose/state";
import { replaceAll } from "@milkdown/utils";
import { $prose } from "@milkdown/kit/utils";
import { diffReplaceAll } from "./diffUpdate";
import { aiTextPlugin, aiTextPluginKey } from "./aiTextAppearPlugin";
import { ProsemirrorAdapterProvider, usePluginViewFactory } from "@prosemirror-adapter/react";
import { slash, SlashView } from "./components/SlashMenu";
import { selectionTooltip, SelectionToolbarView } from "./components/SelectionToolbar";
import { commentDecoPlugin, commentDecoPluginKey } from "./commentDecorationPlugin";
import { applySuggestion } from "./commentPositions";
import { linkPreviewPlugin } from "./linkPreviewPlugin";
import { highlightPlugin, configHighlightStringify } from "./highlightPlugin";
import { calloutPlugin, configCalloutStringify } from "./calloutPlugin";
import { mermaidPlugin } from "./mermaidPlugin";
import { createMarginAvatarPlugin } from "./marginAvatarPlugin";
import "@milkdown/theme-nord/style.css";

function MarkdownEditorInner({ value, onChange, docId, comments = [], editorRef, readOnly = false, currentRole, collabSession }) {
  const pluginViewFactory = usePluginViewFactory();
  const [loading, get] = useInstance();
  const shellRef = useRef(null);

  useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          if (!collabSession) {
            ctx.set(defaultValueCtx, value || "");
          }
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
          if (readOnly) {
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

      editor
        .use(listener)
        .use(slash)
        .use(selectionTooltip)
        .use(commentDecoPlugin)
        .use(aiTextPlugin)
        .use(linkPreviewPlugin)
        .use(mermaidPlugin)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            onChange?.(markdown);
          });
        });

      return editor;
    },
    [docId, !!collabSession]
  );

  // Sync comments into the decoration plugin
  useEffect(() => {
    if (loading) return;
    get().action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.setMeta(commentDecoPluginKey, comments);
      view.dispatch(tr);
    });
  }, [comments, loading, get]);

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
    };
  }, [loading, get, editorRef]);

  return (
    <div
      className={`editor-shell${readOnly ? " editor-readonly" : ""}${currentRole === "commenter" ? " editor-commenter" : ""}`}
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
