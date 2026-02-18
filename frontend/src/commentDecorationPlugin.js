import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { resolveCommentPositions } from "./commentPositions";

export const commentDecoPluginKey = new PluginKey("comment-decorations");

function buildDecorations(doc, comments) {
  // Render all comments passed in — filtering is done by the caller
  const resolved = resolveCommentPositions(doc, comments);
  const decos = [];

  for (const { comment, from, to, status } of resolved) {
    if (status === "anchored" && from != null && to != null && from < to) {
      const classes = ["comment-highlight"];
      if (comment.author_type === "assistant") {
        classes.push("comment-highlight--ai");
      }
      if (comment.suggested_text) {
        classes.push("comment-highlight--suggestion");
      }
      if (comment.status === "approved") {
        classes.push("comment-highlight--approved");
      } else if (comment.status === "rejected") {
        classes.push("comment-highlight--rejected");
      }
      if (comment.comment_type === "fact_check" && comment.verdict) {
        classes.push(`comment-highlight--${comment.verdict}`);
      }

      try {
        decos.push(
          Decoration.inline(from, to, {
            class: classes.join(" "),
            "data-comment-id": String(comment.id),
          }, {
            commentId: comment.id,
          })
        );
      } catch (_) {
        // Invalid range — skip
      }
    }
  }

  return DecorationSet.create(doc, decos);
}

export const commentDecoPlugin = $prose(() => {
  return new Plugin({
    key: commentDecoPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldDecos) {
        const newComments = tr.getMeta(commentDecoPluginKey);
        if (newComments !== undefined) {
          return buildDecorations(tr.doc, newComments);
        }
        if (tr.docChanged) {
          return oldDecos.map(tr.mapping, tr.doc);
        }
        return oldDecos;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleClick(view, pos, event) {
        const decos = this.getState(view.state);
        const found = decos.find(pos, pos);
        if (found.length > 0) {
          const commentIds = found
            .map((d) => d.spec.commentId)
            .filter(Boolean);
          if (commentIds.length) {
            const rect = event.target.getBoundingClientRect();
            view.dom.dispatchEvent(
              new CustomEvent("comment-highlight-click", {
                detail: { commentIds, rect },
                bubbles: true,
              })
            );
            return true;
          }
        }
        return false;
      },
    },
  });
});
