import React, { useEffect, useRef } from "react";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { TextSelection } from "@milkdown/kit/prose/state";
import { replaceAll } from "@milkdown/utils";
import { diffReplaceAll } from "./diffUpdate";
import { aiTextPlugin, aiTextPluginKey } from "./aiTextAppearPlugin";
import { ProsemirrorAdapterProvider, usePluginViewFactory } from "@prosemirror-adapter/react";
import { slash, SlashView } from "./components/SlashMenu";
import { selectionTooltip, SelectionToolbarView } from "./components/SelectionToolbar";
import { commentDecoPlugin, commentDecoPluginKey } from "./commentDecorationPlugin";
import "@milkdown/theme-nord/style.css";

function MarkdownEditorInner({ value, onChange, docId, comments = [], editorRef }) {
  const pluginViewFactory = usePluginViewFactory();
  const [loading, get] = useInstance();
  const shellRef = useRef(null);

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value || "");
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
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(slash)
        .use(selectionTooltip)
        .use(commentDecoPlugin)
        .use(aiTextPlugin)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            onChange?.(markdown);
          });
        }),
    [docId]
  );

  // Sync comments into the decoration plugin
  useEffect(() => {
    if (loading) return;
    get().action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const inlineComments = comments.filter((c) => c.quoted_text);
      const tr = view.state.tr.setMeta(commentDecoPluginKey, inlineComments);
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
    };
  }, [loading, get, editorRef]);

  return (
    <div className="editor-shell" ref={shellRef}>
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
