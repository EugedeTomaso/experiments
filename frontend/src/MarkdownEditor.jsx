import React from "react";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import "@milkdown/theme-nord/style.css";

function MarkdownEditorInner({ value, onChange, docId }) {
  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value || "");
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            onChange?.(markdown);
          });
        }),
    [docId]
  );

  return (
    <div className="editor-shell">
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor(props) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} />
    </MilkdownProvider>
  );
}
