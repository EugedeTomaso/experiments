import * as Y from "yjs";
import { getYjsState, saveYjsState, saveNodeContent, getNodeContent } from "./auth.js";

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
      // TODO: Task 5 will add schema.js for Yjs -> ProseMirror -> Markdown conversion
      // For now, skip markdown persistence (binary state is sufficient for MVP)
      console.log(`[persistence node:${nodeId}] markdown save placeholder`);
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
        // TODO: Task 5 will add markdown -> Yjs conversion via schema.js
        // For now, store raw markdown in a Y.Text as placeholder
        const ytext = ydoc.getText("raw-markdown");
        ytext.insert(0, nodeData.content_md);
        console.log(
          `[persistence node:${nodeId}] loaded from markdown (placeholder)`
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
      // TODO: flush markdown too once schema.js is ready
    },

    destroy() {
      destroyed = true;
      clearTimeout(binaryTimer);
      clearTimeout(markdownTimer);
    },
  };
}
