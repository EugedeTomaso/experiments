/**
 * Resolves stored comments to current ProseMirror document positions.
 *
 * Each comment may have quoted_text + position_from/position_to from creation time.
 * This utility re-anchors them against the current document state.
 *
 * Returns: [{ comment, from, to, status }]
 *   status: "anchored" | "orphaned" | "document-level"
 */

function buildTextMap(doc) {
  const chars = [];
  const posMap = [];

  doc.descendants((node, pos) => {
    if (node.isText) {
      for (let i = 0; i < node.text.length; i++) {
        posMap.push(pos + i);
        chars.push(node.text[i]);
      }
    } else if (node.isBlock && chars.length > 0) {
      posMap.push(pos);
      chars.push("\n");
    }
  });

  return { text: chars.join(""), posMap };
}

function findInDoc(doc, textMap, quotedText, hintFrom) {
  const { text, posMap } = textMap;

  // First: try exact match at the stored position
  if (hintFrom != null) {
    try {
      const candidate = doc.textBetween(hintFrom, hintFrom + quotedText.length, "\n");
      if (candidate === quotedText) {
        return { from: hintFrom, to: hintFrom + quotedText.length };
      }
    } catch (_) {
      // Position out of range — fall through to text search
    }
  }

  // Fallback: search the flat text for all occurrences
  const matches = [];
  let idx = text.indexOf(quotedText);
  while (idx !== -1) {
    const from = posMap[idx];
    const endIdx = idx + quotedText.length - 1;
    const to = endIdx < posMap.length ? posMap[endIdx] + 1 : from + quotedText.length;
    matches.push({ from, to });
    idx = text.indexOf(quotedText, idx + 1);
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Multiple matches: pick the one closest to hintFrom
  if (hintFrom != null) {
    matches.sort((a, b) => Math.abs(a.from - hintFrom) - Math.abs(b.from - hintFrom));
  }
  return matches[0];
}

export function resolveCommentPositions(doc, comments) {
  if (!doc || !comments?.length) return [];

  const textMap = buildTextMap(doc);

  return comments.map((comment) => {
    if (!comment.quoted_text) {
      return { comment, from: null, to: null, status: "document-level" };
    }

    const match = findInDoc(doc, textMap, comment.quoted_text, comment.position_from);
    if (match) {
      return { comment, from: match.from, to: match.to, status: "anchored" };
    }

    return { comment, from: null, to: null, status: "orphaned" };
  });
}
