/**
 * Callout / Alert blocks plugin for Milkdown.
 *
 * Supports GFM-alert-style syntax:
 *   > [!NOTE]
 *   > Content here.
 *
 * Types: note, tip, warning, caution, important, toggle
 *
 * Toggle type renders as a <details>/<summary> collapsible section:
 *   > [!TOGGLE] Summary text
 *   > Hidden content here.
 */
import { remarkStringifyOptionsCtx } from "@milkdown/core";
import { $command, $nodeSchema, $remark } from "@milkdown/kit/utils";
import { blockquoteSchema } from "@milkdown/kit/preset/commonmark";
import { wrapIn } from "@milkdown/kit/prose/commands";

const CALLOUT_TYPES = ["note", "tip", "warning", "caution", "important", "toggle"];
const CALLOUT_RE = /^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT|TOGGLE)\]\s*/i;

/* ---------- Labels for display ---------- */
const CALLOUT_LABELS = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  caution: "Caution",
  important: "Important",
};

/* ---------- remark parse plugin ---------- */
// Walks MDAST tree, finds blockquote nodes whose first paragraph
// starts with [!TYPE], strips the marker, sets node.data.calloutType.
function remarkCallout() {
  return (tree) => {
    walkForCallouts(tree);
  };
}

function walkForCallouts(node) {
  if (!node.children) return;
  for (const child of node.children) walkForCallouts(child);

  for (const child of node.children) {
    if (child.type !== "blockquote" || !child.children?.length) continue;

    const first = child.children[0];
    if (first.type !== "paragraph" || !first.children?.length) continue;

    const firstInline = first.children[0];
    if (!firstInline || firstInline.type !== "text") continue;

    const match = firstInline.value.match(CALLOUT_RE);
    if (!match) continue;

    const calloutType = match[1].toLowerCase();
    // For toggle type, the rest of the first line is the summary
    const remainder = firstInline.value.slice(match[0].length);

    child.data = { ...child.data, calloutType };

    if (calloutType === "toggle" && remainder.trim()) {
      child.data.toggleSummary = remainder.trim();
    }

    // Strip the marker from the text
    if (remainder.trim()) {
      firstInline.value = remainder;
    } else {
      // Remove the first inline text entirely
      first.children.shift();
      // If the paragraph is now empty, remove it
      if (first.children.length === 0) {
        child.children.shift();
      }
    }
  }
}

export const calloutRemarkPlugin = $remark("callout", () => remarkCallout);

/* ---------- Callout node schema ---------- */
export const calloutSchema = $nodeSchema("callout", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: {
    type: { default: "note" },
    summary: { default: "" },
  },
  parseDOM: [
    {
      tag: "div[data-callout]",
      getAttrs: (dom) => ({
        type: dom.getAttribute("data-callout") || "note",
        summary: dom.getAttribute("data-summary") || "",
      }),
    },
  ],
  toDOM: (node) => {
    if (node.attrs.type === "toggle") {
      const details = document.createElement("details");
      details.setAttribute("data-callout", "toggle");
      details.setAttribute("data-summary", node.attrs.summary || "");
      details.className = "callout callout-toggle";
      details.open = true;

      const summary = document.createElement("summary");
      summary.className = "callout-toggle-summary";
      summary.textContent = node.attrs.summary || "Toggle";

      const content = document.createElement("div");
      content.className = "callout-toggle-content";

      details.appendChild(summary);
      details.appendChild(content);
      return { dom: details, contentDOM: content };
    }
    return [
      "div",
      {
        "data-callout": node.attrs.type,
        class: `callout callout-${node.attrs.type}`,
      },
      0,
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === "blockquote" && !!node.data?.calloutType,
    runner: (state, node, type) => {
      const calloutType = node.data.calloutType;
      const summary = node.data.toggleSummary || "";
      state
        .openNode(type, { type: calloutType, summary })
        .next(node.children)
        .closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "callout",
    runner: (state, node) => {
      const marker =
        node.attrs.type === "toggle" && node.attrs.summary
          ? `[!${node.attrs.type.toUpperCase()}] ${node.attrs.summary}`
          : `[!${node.attrs.type.toUpperCase()}]`;

      state.openNode("blockquote");
      // Insert the marker as the first paragraph
      state.openNode("paragraph");
      if (typeof state.addText === "function") {
        state.addText(marker);
      }
      state.closeNode();
      // Then serialize the content
      state.next(node.content);
      state.closeNode();
    },
  },
}));

/* ---------- Patch blockquote to skip callout nodes ---------- */
export const patchedBlockquote = blockquoteSchema.extendSchema(
  (prev) => (ctx) => {
    const base = prev(ctx);
    return {
      ...base,
      parseMarkdown: {
        ...base.parseMarkdown,
        match: (node) => node.type === "blockquote" && !node.data?.calloutType,
      },
    };
  }
);

/* ---------- Commands for inserting callouts ---------- */
export const insertCalloutCommand = $command(
  "InsertCallout",
  (ctx) =>
    (calloutType = "note") =>
      wrapIn(calloutSchema.type(ctx), { type: calloutType, summary: "" })
);

/* ---------- Config helper: register stringify handler ---------- */
export function configCalloutStringify(ctx) {
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    handlers: {
      ...prev.handlers,
      callout: (node, _, state) => {
        // Callout nodes are serialized as blockquotes by the toMarkdown runner
        // This handler should not normally fire, but acts as a safety net
        const content = state.containerFlow(node, {});
        return content;
      },
    },
  }));
}

/* ---------- Plugin array ---------- */
export const calloutPlugin = [
  calloutRemarkPlugin,
  calloutSchema.node,
  calloutSchema.ctx,
  patchedBlockquote,
  insertCalloutCommand,
];
