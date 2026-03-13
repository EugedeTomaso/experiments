import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { collectBlocks, isEmptyParagraph } from "./diffUpdate";

export const aiTextPluginKey = new PluginKey("ai-text-appear");

const INIT_STATE = { decos: DecorationSet.empty, savedOldDoc: null, mode: "idle", stats: null, ghostText: null };

function createCursorWidget() {
  const span = document.createElement("span");
  span.className = "ai-cursor";
  span.setAttribute("aria-hidden", "true");
  return span;
}

function createGhostWidget(text) {
  return () => {
    const span = document.createElement("span");
    span.className = "ai-ghost-text";
    span.textContent = text;
    span.setAttribute("aria-hidden", "true");
    return span;
  };
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
  const stats = { modified: 0, added: 0, deleted: 0 };

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
    return { decoSet: DecorationSet.create(newDoc, []), stats };
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

      if (addedTo > addedFrom || deletedText) {
        stats.modified++;
      }

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
      stats.modified++;
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
    stats.added++;
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
    stats.deleted += oldCount - pairs;

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

  const decoSet = decos.length > 0
    ? DecorationSet.create(newDoc, decos)
    : DecorationSet.empty;
  return { decoSet, stats };
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

        // Ghost text actions
        if (meta && typeof meta === "object" && meta.action === "show-ghost") {
          const { text, pos } = meta;
          if (!text || pos == null || pos < 0 || pos > newState.doc.content.size) {
            return oldState;
          }
          try {
            const ghostDeco = Decoration.widget(pos, createGhostWidget(text), {
              side: 1,
              isGhost: true,
            });
            // Merge ghost decoration with existing diff/streaming decos
            const ghostDecoSet = DecorationSet.create(newState.doc, [ghostDeco]);
            const mergedDecos = oldState.decos !== DecorationSet.empty
              ? oldState.decos.add(newState.doc, [ghostDeco])
              : ghostDecoSet;
            return { ...oldState, decos: mergedDecos, ghostText: { pos, text } };
          } catch (_) {
            return oldState;
          }
        }

        if (meta && typeof meta === "object" && meta.action === "clear-ghost") {
          if (!oldState.ghostText) return oldState;
          // Remove ghost widget decorations from the set
          const ghostDecos = oldState.decos.find(
            0, newState.doc.content.size + 1,
            (spec) => spec.isGhost
          );
          if (ghostDecos.length > 0) {
            const newDecoSet = oldState.decos.remove(ghostDecos);
            return { ...oldState, decos: newDecoSet, ghostText: null };
          }
          return { ...oldState, ghostText: null };
        }

        // Set a comparison doc (for version comparison)
        if (meta && typeof meta === "object" && meta.action === "set-compare-doc") {
          return { ...oldState, savedOldDoc: meta.doc, mode: "idle" };
        }

        // Hide diff decorations but keep savedOldDoc for toggle
        if (meta === "hide-diff" || meta === "auto-hide-diff") {
          if (oldState.mode === "diff") {
            return { ...oldState, decos: DecorationSet.empty, mode: "diff-hidden" };
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
          const { decoSet, stats } = computeDiffDecos(oldState.savedOldDoc, newState.doc);
          return { decos: decoSet, savedOldDoc: oldState.savedOldDoc, mode: "diff", stats };
        }

        if (meta === "streaming" && tr.docChanged) {
          // Save old doc on first streaming transaction
          const savedOldDoc = oldState.mode !== "streaming"
            ? _oldState.doc
            : oldState.savedOldDoc;

          // Only show cursor widget — no inline decorations to avoid
          // flickering from animation restarts on DOM recreation.
          const newDecos = [];
          const insertedRanges = getInsertedRanges(tr);

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
            decos: DecorationSet.create(newState.doc, newDecos),
            savedOldDoc,
            mode: "streaming",
          };
        }

        // Normal transaction: map existing decorations
        if (tr.docChanged) {
          // Always clear ghost text on any document change
          if (oldState.ghostText) {
            if (oldState.decos !== DecorationSet.empty) {
              // Remove ghost decos, map remaining
              const ghostDecos = oldState.decos.find(
                0, _oldState.doc.content.size + 1,
                (spec) => spec.isGhost
              );
              const withoutGhost = ghostDecos.length > 0
                ? oldState.decos.remove(ghostDecos)
                : oldState.decos;
              const mapped = withoutGhost !== DecorationSet.empty
                ? withoutGhost.map(tr.mapping, tr.doc)
                : DecorationSet.empty;
              return { ...oldState, decos: mapped, ghostText: null };
            }
            return { ...oldState, decos: DecorationSet.empty, ghostText: null };
          }
          if (oldState.decos !== DecorationSet.empty) {
            return {
              ...oldState,
              decos: oldState.decos.map(tr.mapping, tr.doc),
            };
          }
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
