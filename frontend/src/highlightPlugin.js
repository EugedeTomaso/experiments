/**
 * Highlight mark plugin for Milkdown.
 *
 * Adds a <mark> highlight mark with:
 * - Toolbar toggle (via toggleHighlightCommand)
 * - Input rule: ==text== converts to highlight
 * - Markdown round-trip: serializes as <mark>text</mark> HTML
 */
import { remarkStringifyOptionsCtx } from "@milkdown/core";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { markRule } from "@milkdown/kit/prose";
import { $command, $markAttr, $markSchema, $inputRule, $remark } from "@milkdown/kit/utils";

/* ---------- remark parse plugin ---------- */
// Walks MDAST tree and converts <mark>...</mark> HTML inline sequences
// into { type: 'highlight', children: [...] } container nodes.
function remarkHighlight() {
  return (tree) => {
    walkChildren(tree);
  };
}

function walkChildren(node) {
  if (!node.children) return;
  // First recurse into children
  for (const child of node.children) walkChildren(child);

  let i = 0;
  while (i < node.children.length) {
    const child = node.children[i];
    if (child.type === "html" && child.value.trim().toLowerCase() === "<mark>") {
      // Find matching </mark>
      let j = i + 1;
      let found = false;
      while (j < node.children.length) {
        const end = node.children[j];
        if (end.type === "html" && end.value.trim().toLowerCase() === "</mark>") {
          // Wrap content between <mark> and </mark> in a highlight node
          const content = node.children.slice(i + 1, j);
          const highlightNode = { type: "highlight", children: content };
          node.children.splice(i, j - i + 1, highlightNode);
          found = true;
          break;
        }
        j++;
      }
      if (!found) i++;
    } else {
      i++;
    }
  }
}

export const highlightRemarkPlugin = $remark("highlight", () => remarkHighlight);

/* ---------- mark schema ---------- */
export const highlightAttr = $markAttr("highlight");

export const highlightSchema = $markSchema("highlight", (ctx) => ({
  parseDOM: [
    { tag: "mark" },
    {
      style: "background-color",
      getAttrs: (value) =>
        (value && value.includes("255") && value.includes("212")) ? null : false,
    },
  ],
  toDOM: (mark) => ["mark", ctx.get(highlightAttr.key)(mark)],
  parseMarkdown: {
    match: (node) => node.type === "highlight",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "highlight",
    runner: (state, mark) => {
      state.withMark(mark, "highlight");
    },
  },
}));

/* ---------- command ---------- */
export const toggleHighlightCommand = $command(
  "ToggleHighlight",
  (ctx) => () => toggleMark(highlightSchema.type(ctx))
);

/* ---------- input rule: ==text== ---------- */
export const highlightInputRule = $inputRule((ctx) =>
  markRule(/(?<!=)==([^=]+)==(?!=)/, highlightSchema.type(ctx))
);

/* ---------- config helper: register stringify handler ---------- */
export function configHighlightStringify(ctx) {
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    handlers: {
      ...prev.handlers,
      highlight: (node, _, state) => {
        const content = state.containerPhrasing(node, {
          before: "",
          after: "",
        });
        return `<mark>${content}</mark>`;
      },
    },
  }));
}

/* ---------- plugin array ---------- */
export const highlightPlugin = [
  highlightRemarkPlugin,
  highlightAttr,
  highlightSchema.mark,
  highlightSchema.ctx,
  toggleHighlightCommand,
  highlightInputRule,
];
