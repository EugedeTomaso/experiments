import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEWER_TOOLS,
  REVIEWER_TREE_ICONS,
  getChatThinkingMessage,
  getToolThinkingMessage,
} from "./reviewerPanelConfig.js";

test("reviewer tools use named icon ids instead of emoji glyphs", () => {
  for (const tool of REVIEWER_TOOLS) {
    assert.match(tool.icon, /^[a-z-]+$/);
  }
});

test("tree icons are configured with named ids", () => {
  assert.deepEqual(REVIEWER_TREE_ICONS, {
    folder: "folder",
    file: "file",
  });
});

test("tool thinking messages are stable and wrap by tool", () => {
  assert.equal(getToolThinkingMessage("genre", 0), "Mapping genre signals");
  assert.equal(getToolThinkingMessage("genre", 3), "Checking conventions against the manuscript");
  assert.equal(getToolThinkingMessage("genre", 4), "Mapping genre signals");
});

test("chat thinking messages rotate predictably", () => {
  assert.equal(getChatThinkingMessage(0), "Reading the current passage");
  assert.equal(getChatThinkingMessage(1), "Tracing the tension under the scene");
  assert.equal(getChatThinkingMessage(4), "Reading the current passage");
});
