import * as Y from "yjs";
import { getYjsState, saveYjsState, saveNodeContent, getNodeContent } from "./auth.js";
import { markdownToYXmlFragment, yXmlFragmentToMarkdown } from "./schema.js";

const BINARY_DEBOUNCE_MS = 5_000; // 5s for binary state
const MARKDOWN_DEBOUNCE_MS = 30_000; // 30s for markdown conversion

export function createPersistence(nodeId, ydoc) {
  let binaryTimer = null;
  let markdownTimer = null;
  let destroyed = false;

  function scheduleBinarySave() {
    if (destroyed) return;
    clearTimeout(binaryTimer);
    binaryTimer = setTimeout(async () => {
      if (destroyed) return;
      const state = Y.encodeStateAsUpdate(ydoc);
      await saveYjsState(nodeId, Buffer.from(state)).catch((err) => {
        console.error(
          `[persistence node:${nodeId}] binary save failed:`,
          err.message
        );
      });
    }, BINARY_DEBOUNCE_MS);
  }

  function scheduleMarkdownSave() {
    if (destroyed) return;
    clearTimeout(markdownTimer);
    markdownTimer = setTimeout(async () => {
      if (destroyed) return;
      const markdown = await yXmlFragmentToMarkdown(ydoc, "prosemirror");
      await saveNodeContent(nodeId, markdown).catch((err) => {
        console.error(
          `[persistence node:${nodeId}] markdown save failed:`,
          err.message
        );
      });
    }, MARKDOWN_DEBOUNCE_MS);
  }

  // Listen for changes
  ydoc.on("update", () => {
    scheduleBinarySave();
    scheduleMarkdownSave();
  });

  return {
    async load() {
      // Try binary state first
      const binaryState = await getYjsState(nodeId);
      if (binaryState) {
        Y.applyUpdate(ydoc, new Uint8Array(binaryState));
        console.log(`[persistence node:${nodeId}] loaded from binary state`);
        return;
      }

      // Fall back to markdown
      const nodeData = await getNodeContent(nodeId);
      if (nodeData && nodeData.content_md) {
        await markdownToYXmlFragment(ydoc, "prosemirror", nodeData.content_md);
        console.log(
          `[persistence node:${nodeId}] loaded from markdown → Yjs`
        );
      }
    },

    async flush() {
      clearTimeout(binaryTimer);
      clearTimeout(markdownTimer);
      const state = Y.encodeStateAsUpdate(ydoc);
      await saveYjsState(nodeId, Buffer.from(state)).catch((err) => {
        console.error(
          `[persistence node:${nodeId}] flush binary failed:`,
          err.message
        );
      });
      const markdown = await yXmlFragmentToMarkdown(ydoc, "prosemirror");
      await saveNodeContent(nodeId, markdown).catch((err) => {
        console.error(
          `[persistence node:${nodeId}] flush markdown failed:`,
          err.message
        );
      });
    },

    destroy() {
      destroyed = true;
      clearTimeout(binaryTimer);
      clearTimeout(markdownTimer);
    },
  };
}
