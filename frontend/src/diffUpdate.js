import { editorViewCtx, parserCtx } from "@milkdown/core";
import { aiTextPluginKey } from "./aiTextAppearPlugin";

/**
 * Parse markdown into a ProseMirror doc and apply a minimal diff to the editor.
 *
 * Three-level diff:
 * 1. Content-block matching — skip empty paragraphs (structural noise from
 *    Enter+Enter in the editor vs \n\n in AI-generated markdown).
 * 2. Block-level prefix/suffix — find unchanged content blocks from both ends.
 * 3. Inline word-level — for content blocks that differ, find the character-level
 *    diff and only replace the changed text range.
 *
 * @param {string} markdown
 * @param {{ streaming?: boolean }} opts
 *   streaming: don't delete old blocks beyond what the new doc covers
 */
export function diffReplaceAll(markdown, { streaming = false } = {}) {
  return (ctx) => {
    const view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const newDoc = parser(markdown);
    if (!newDoc) return;

    const oldDoc = view.state.doc;

    // Collect ALL blocks (for position info) and content-only blocks (for matching)
    const oldAll = collectBlocks(oldDoc);
    const newAll = collectBlocks(newDoc);
    const oldContent = oldAll.filter((b) => !isEmptyParagraph(b.node));
    let newContent = newAll.filter((b) => !isEmptyParagraph(b.node));

    // Note: we no longer drop the last content block during streaming.
    // The inlineDiff function handles partial text correctly via
    // character-level prefix/suffix matching, and keeping the last block
    // enables the typewriter effect (text appears as the AI generates it).

    // Diagnostic logging for debugging streaming behavior
    if (typeof window !== "undefined" && window.__diffLog) {
      const eqResults = [];
      const len = Math.min(oldContent.length, newContent.length);
      for (let i = 0; i < len; i++) {
        eqResults.push({
          idx: i,
          oldText: oldContent[i].node.textContent.slice(0, 40),
          newText: newContent[i].node.textContent.slice(0, 40),
          eq: oldContent[i].node.eq(newContent[i].node),
          sameType: oldContent[i].node.type.name === newContent[i].node.type.name,
          oldAttrs: JSON.stringify(oldContent[i].node.attrs),
          newAttrs: JSON.stringify(newContent[i].node.attrs),
        });
      }
      window.__diffLog.push({
        streaming,
        oldContentCount: oldContent.length,
        newContentCount: newContent.length,
        eqResults,
      });
    }

    // --- Prefix matching on content blocks ---
    let prefix = 0;
    while (
      prefix < oldContent.length &&
      prefix < newContent.length &&
      oldContent[prefix].node.eq(newContent[prefix].node)
    ) {
      prefix++;
    }

    // --- Suffix matching on content blocks (skip during streaming) ---
    let suffix = 0;
    if (!streaming) {
      while (
        suffix < oldContent.length - prefix &&
        suffix < newContent.length - prefix &&
        oldContent[oldContent.length - 1 - suffix].node.eq(
          newContent[newContent.length - 1 - suffix].node
        )
      ) {
        suffix++;
      }
    }

    const oldStart = prefix;
    let oldEnd = oldContent.length - suffix;
    const newStart = prefix;
    const newEnd = newContent.length - suffix;

    if (streaming) {
      oldEnd = Math.min(oldStart + (newEnd - newStart), oldContent.length);
    }

    const oldCount = oldEnd - oldStart;
    const newCount = newEnd - newStart;
    if (oldCount === 0 && newCount === 0) return;

    // Compute the document range that covers the unmatched content blocks
    // INCLUDING any empty paragraphs between the matched prefix/suffix and
    // the unmatched zone. This ensures empty "spacer" paras get consumed.
    const rangeFrom = computeRangeStart(oldAll, oldContent, prefix);
    const rangeTo = computeRangeEnd(
      oldAll,
      oldContent,
      oldEnd,
      oldDoc.content.size
    );

    const tr = view.state.tr;
    const pairs = Math.min(oldCount, newCount);

    // Can we do inline diff? Only when old and new have the same number
    // of unmatched content blocks (1:1 pairing possible).
    if (oldCount === newCount) {
      // Process paired content blocks from end to start (preserves positions)
      for (let k = pairs - 1; k >= 0; k--) {
        const ob = oldContent[oldStart + k];
        const nb = newContent[newStart + k];

        if (
          ob.node.type === nb.node.type &&
          ob.node.isTextblock &&
          attrsEqual(ob.node, nb.node)
        ) {
          inlineDiff(tr, ob, nb);
        } else {
          tr.replaceWith(ob.offset, ob.offset + ob.size, nb.node);
        }
      }

      // Delete empty paragraphs that were between content blocks in the
      // unmatched range (they don't exist in the AI output).
      // Process from end to start to preserve positions.
      const unmatchedOldAll = oldAll.filter((b) => {
        return (
          isEmptyParagraph(b.node) &&
          b.offset >= rangeFrom &&
          b.offset + b.size <= rangeTo
        );
      });
      for (let i = unmatchedOldAll.length - 1; i >= 0; i--) {
        const emp = unmatchedOldAll[i];
        tr.delete(emp.offset, emp.offset + emp.size);
      }
    } else {
      // Different counts — bulk replace the whole range
      const newNodes = [];
      for (let i = newStart; i < newEnd; i++) {
        newNodes.push(newContent[i].node);
      }
      if (newNodes.length > 0) {
        tr.replaceWith(rangeFrom, rangeTo, newNodes);
      } else if (rangeFrom < rangeTo) {
        tr.delete(rangeFrom, rangeTo);
      }
    }

    if (tr.docChanged) {
      if (streaming) {
        tr.setMeta(aiTextPluginKey, "streaming");
      }
      view.dispatch(tr);
    }
  };
}

// ── Inline (word-level) diff within a single textblock ──────────────

function inlineDiff(tr, oldBlock, newBlock) {
  const oldText = oldBlock.node.textContent;
  const newText = newBlock.node.textContent;

  // Character-level common prefix
  let pre = 0;
  while (
    pre < oldText.length &&
    pre < newText.length &&
    oldText[pre] === newText[pre]
  ) {
    pre++;
  }

  // Character-level common suffix
  let suf = 0;
  while (
    suf < oldText.length - pre &&
    suf < newText.length - pre &&
    oldText[oldText.length - 1 - suf] ===
      newText[newText.length - 1 - suf]
  ) {
    suf++;
  }

  const contentStart = oldBlock.offset + 1; // +1 for block opening token

  // Text identical → marks or inline structure differ → replace whole content
  if (pre + suf >= oldText.length && pre + suf >= newText.length) {
    tr.replaceWith(
      contentStart,
      contentStart + oldBlock.node.content.size,
      newBlock.node.content
    );
    return;
  }

  const oldContentSize = oldBlock.node.content.size;
  const newContentSize = newBlock.node.content.size;

  // For pure-text blocks (no inline atoms), character positions map 1:1
  // to ProseMirror content positions. Use surgical replacement.
  if (oldContentSize === oldText.length && newContentSize === newText.length) {
    const from = contentStart + pre;
    const to = contentStart + oldText.length - suf;
    const slice = newBlock.node.content.cut(pre, newText.length - suf);
    tr.replaceWith(from, to, slice);
  } else {
    // Inline atoms present — fall back to replacing entire block content
    tr.replaceWith(
      contentStart,
      contentStart + oldContentSize,
      newBlock.node.content
    );
  }
}

// ── Range computation ───────────────────────────────────────────────

/**
 * Position in the old doc where the unmatched zone starts.
 * Goes back from the first unmatched content block to include any preceding
 * empty paragraphs that sit between the matched prefix and the first
 * unmatched content block.
 */
function computeRangeStart(allBlocks, contentBlocks, prefixLen) {
  if (prefixLen >= contentBlocks.length) {
    // All content blocks matched — range starts at end of last content block
    const last = contentBlocks[contentBlocks.length - 1];
    return last ? last.offset + last.size : 0;
  }
  const firstUnmatched = contentBlocks[prefixLen];
  // Walk backwards in allBlocks to include empty paras before firstUnmatched
  let from = firstUnmatched.offset;
  for (let i = 0; i < allBlocks.length; i++) {
    if (allBlocks[i].offset === firstUnmatched.offset) {
      // Check preceding blocks for empty paragraphs
      let j = i - 1;
      while (j >= 0 && isEmptyParagraph(allBlocks[j].node)) {
        // Only include this empty para if it's after the last prefix content block
        if (
          prefixLen > 0 &&
          allBlocks[j].offset >=
            contentBlocks[prefixLen - 1].offset +
              contentBlocks[prefixLen - 1].size
        ) {
          from = allBlocks[j].offset;
        }
        j--;
      }
      break;
    }
  }
  return from;
}

/**
 * Position in the old doc where the unmatched zone ends.
 * Extends forward from the last unmatched content block to include any
 * trailing empty paragraphs before the matched suffix.
 */
function computeRangeEnd(allBlocks, contentBlocks, oldEnd, docSize) {
  if (oldEnd <= 0) return 0;
  if (oldEnd > contentBlocks.length) return docSize;

  const lastUnmatched = contentBlocks[oldEnd - 1];
  let to = lastUnmatched.offset + lastUnmatched.size;

  // Walk forward in allBlocks to include empty paras after lastUnmatched
  for (let i = 0; i < allBlocks.length; i++) {
    if (allBlocks[i].offset === lastUnmatched.offset) {
      let j = i + 1;
      while (j < allBlocks.length && isEmptyParagraph(allBlocks[j].node)) {
        to = allBlocks[j].offset + allBlocks[j].size;
        j++;
      }
      break;
    }
  }
  return to;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function collectBlocks(doc) {
  const blocks = [];
  doc.forEach((node, offset) => {
    blocks.push({ node, offset, size: node.nodeSize });
  });
  return blocks;
}

export function isEmptyParagraph(node) {
  return (
    node.type.name === "paragraph" && node.content.size === 0
  );
}

function attrsEqual(a, b) {
  const aa = a.attrs;
  const ba = b.attrs;
  if (aa === ba) return true;
  const keys = Object.keys(aa);
  if (keys.length !== Object.keys(ba).length) return false;
  return keys.every((k) => aa[k] === ba[k]);
}
