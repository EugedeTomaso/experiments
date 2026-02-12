import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { collectBlocks, isEmptyParagraph } from "./diffUpdate";

export const aiTextPluginKey = new PluginKey("ai-text-appear");

const INIT_STATE = { decos: DecorationSet.empty, savedOldDoc: null, mode: "idle" };

function createCursorWidget() {
  const span = document.createElement("span");
  span.className = "ai-cursor";
  span.setAttribute("aria-hidden", "true");
  return span;
}

/**
 * Extract the inserted text ranges from a transaction's step maps.
 * Each step's new content range is mapped to final-doc coordinates.
 */
function getInsertedRanges(tr) {
  const ranges = [];

  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i];
    if (!step.slice || step.slice.content.size === 0) continue;

    const mapping = tr.mapping.slice(i + 1);
    const from = mapping.map(step.from, -1);
    const to = mapping.map(step.from + step.slice.content.size, 1);

    if (to > from) {
      ranges.push({ from, to });
    }
  }

  return ranges;
}

// ── Diff computation ────────────────────────────────────────────────

function computeDiffDecos(oldDoc, newDoc) {
  const decos = [];

  const oldAll = collectBlocks(oldDoc);
  const newAll = collectBlocks(newDoc);
  const oldContent = oldAll.filter((b) => !isEmptyParagraph(b.node));
  const newContent = newAll.filter((b) => !isEmptyParagraph(b.node));

  // Prefix matching
  let prefix = 0;
  while (
    prefix < oldContent.length &&
    prefix < newContent.length &&
    oldContent[prefix].node.eq(newContent[prefix].node)
  ) {
    prefix++;
  }

  // Suffix matching
  let suffix = 0;
  while (
    suffix < oldContent.length - prefix &&
    suffix < newContent.length - prefix &&
    oldContent[oldContent.length - 1 - suffix].node.eq(
      newContent[newContent.length - 1 - suffix].node
    )
  ) {
    suffix++;
  }

  const oldStart = prefix;
  const oldEnd = oldContent.length - suffix;
  const newStart = prefix;
  const newEnd = newContent.length - suffix;

  const oldCount = oldEnd - oldStart;
  const newCount = newEnd - newStart;

  if (oldCount === 0 && newCount === 0) {
    return DecorationSet.create(newDoc, []);
  }

  const pairs = Math.min(oldCount, newCount);

  // Process paired blocks
  for (let k = 0; k < pairs; k++) {
    const ob = oldContent[oldStart + k];
    const nb = newContent[newStart + k];

    if (
      ob.node.type === nb.node.type &&
      ob.node.isTextblock
    ) {
      // Character-level diff
      const oldText = ob.node.textContent;
      const newText = nb.node.textContent;

      let pre = 0;
      while (pre < oldText.length && pre < newText.length && oldText[pre] === newText[pre]) {
        pre++;
      }

      let suf = 0;
      while (
        suf < oldText.length - pre &&
        suf < newText.length - pre &&
        oldText[oldText.length - 1 - suf] === newText[newText.length - 1 - suf]
      ) {
        suf++;
      }

      const contentStart = nb.offset + 1; // +1 for block opening token
      const deletedText = oldText.slice(pre, oldText.length - suf);
      const addedFrom = pre;
      const addedTo = newText.length - suf;

      // Highlight added text
      if (addedTo > addedFrom) {
        const from = contentStart + addedFrom;
        const to = contentStart + addedTo;
        if (from >= 0 && to <= newDoc.content.size && to > from) {
          try {
            decos.push(Decoration.inline(from, to, { class: "ai-diff-add" }));
          } catch (_) {}
        }
      }

      // Show deleted text as widget
      if (deletedText) {
        const pos = contentStart + pre;
        if (pos >= 0 && pos <= newDoc.content.size) {
          try {
            decos.push(
              Decoration.widget(
                pos,
                () => {
                  const span = document.createElement("span");
                  span.className = "ai-diff-del";
                  span.textContent = deletedText;
                  return span;
                },
                { side: -1 }
              )
            );
          } catch (_) {}
        }
      }
    } else {
      // Different block types — mark entire new block as addition
      const from = nb.offset + 1;
      const to = nb.offset + 1 + nb.node.content.size;
      if (from < to && to <= newDoc.content.size) {
        try {
          decos.push(Decoration.inline(from, to, { class: "ai-diff-add" }));
        } catch (_) {}
      }
    }
  }

  // Extra new blocks (additions)
  for (let k = pairs; k < newCount; k++) {
    const nb = newContent[newStart + k];
    if (nb.node.isTextblock && nb.node.content.size > 0) {
      const from = nb.offset + 1;
      const to = nb.offset + 1 + nb.node.content.size;
      if (from < to && to <= newDoc.content.size) {
        try {
          decos.push(Decoration.inline(from, to, { class: "ai-diff-add" }));
        } catch (_) {}
      }
    }
  }

  // Extra old blocks (deletions) — show as widget at boundary
  if (oldCount > pairs) {
    // Find the position to insert the deletion widget
    let insertPos;
    if (pairs > 0) {
      const lastPaired = newContent[newStart + pairs - 1];
      insertPos = lastPaired.offset + lastPaired.size;
    } else if (newStart > 0) {
      const prevBlock = newContent[newStart - 1];
      insertPos = prevBlock.offset + prevBlock.size;
    } else {
      insertPos = 0;
    }

    for (let k = pairs; k < oldCount; k++) {
      const ob = oldContent[oldStart + k];
      const text = ob.node.textContent;
      if (text && insertPos >= 0 && insertPos <= newDoc.content.size) {
        try {
          decos.push(
            Decoration.widget(
              insertPos,
              () => {
                const span = document.createElement("span");
                span.className = "ai-diff-del";
                span.textContent = text;
                return span;
              },
              { side: 1 }
            )
          );
        } catch (_) {}
      }
    }
  }

  return decos.length > 0
    ? DecorationSet.create(newDoc, decos)
    : DecorationSet.empty;
}

// ── Plugin ──────────────────────────────────────────────────────────

export const aiTextPlugin = $prose(() => {
  return new Plugin({
    key: aiTextPluginKey,
    state: {
      init() {
        return INIT_STATE;
      },
      apply(tr, oldState, _oldState, newState) {
        const meta = tr.getMeta(aiTextPluginKey);

        if (meta === "clear") {
          return INIT_STATE;
        }

        // Hide diff decorations but keep savedOldDoc for toggle
        if (meta === "hide-diff" || meta === "auto-hide-diff") {
          if (oldState.mode === "diff") {
            return { decos: DecorationSet.empty, savedOldDoc: oldState.savedOldDoc, mode: "diff-hidden" };
          }
          return oldState;
        }

        // Auto-clear diff on user document edits (not cursor moves)
        if ((oldState.mode === "diff" || oldState.mode === "diff-hidden") && !meta && tr.docChanged) {
          return INIT_STATE;
        }

        if (meta === "show-diff") {
          if (!oldState.savedOldDoc) {
            return INIT_STATE;
          }
          const diffDecos = computeDiffDecos(oldState.savedOldDoc, newState.doc);
          return { decos: diffDecos, savedOldDoc: oldState.savedOldDoc, mode: "diff" };
        }

        if (meta === "streaming" && tr.docChanged) {
          // Save old doc on first streaming transaction
          const savedOldDoc = oldState.mode !== "streaming"
            ? _oldState.doc
            : oldState.savedOldDoc;

          // Map old decorations to new positions
          let mapped = oldState.decos.map(tr.mapping, tr.doc);

          // Remove old cursor widget
          const oldCursors = [];
          mapped.find().forEach((d) => {
            if (d.spec?.isCursor) oldCursors.push(d);
          });
          if (oldCursors.length) {
            mapped = mapped.remove(oldCursors);
          }

          // Find new text ranges from the transaction's steps
          const insertedRanges = getInsertedRanges(tr);
          const newDecos = [];

          for (const { from, to } of insertedRanges) {
            if (from >= 0 && to <= newState.doc.content.size && to > from) {
              try {
                newDecos.push(
                  Decoration.inline(from, to, { class: "ai-text-new" })
                );
              } catch (_) {}
            }
          }

          // Add cursor widget at the end of the last inserted range
          if (insertedRanges.length > 0) {
            const lastPos = Math.max(...insertedRanges.map((r) => r.to));
            if (lastPos > 0 && lastPos <= newState.doc.content.size) {
              try {
                newDecos.push(
                  Decoration.widget(lastPos, createCursorWidget, {
                    side: 1,
                    isCursor: true,
                  })
                );
              } catch (_) {}
            }
          }

          return {
            decos: mapped.add(newState.doc, newDecos),
            savedOldDoc,
            mode: "streaming",
          };
        }

        // Normal transaction: map existing decorations
        if (tr.docChanged && oldState.decos !== DecorationSet.empty) {
          return {
            ...oldState,
            decos: oldState.decos.map(tr.mapping, tr.doc),
          };
        }
        return oldState;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state).decos;
      },
    },
  });
});
