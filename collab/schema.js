/**
 * Milkdown headless schema for markdown <-> Yjs conversion.
 *
 * Runs Milkdown in Node.js with a jsdom shim to extract the ProseMirror
 * schema, parser, and serializer. This ensures the collab server uses the
 * exact same schema as the frontend editor (commonmark + gfm presets).
 */

import { JSDOM } from "jsdom";

// ProseMirror / Milkdown require a DOM environment.
// Set up globals before any Milkdown imports.
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");

function shimGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
}

shimGlobal("document", dom.window.document);
shimGlobal("window", dom.window);
shimGlobal("navigator", dom.window.navigator);
shimGlobal("Node", dom.window.Node);
shimGlobal("HTMLElement", dom.window.HTMLElement);
shimGlobal("DocumentFragment", dom.window.DocumentFragment);
shimGlobal("DOMParser", dom.window.DOMParser);
shimGlobal("MutationObserver", dom.window.MutationObserver);
shimGlobal("CustomEvent", dom.window.CustomEvent);

// Milkdown's @milkdown/ctx timer system uses bare addEventListener/removeEventListener/dispatchEvent
// at the global scope (in browsers these delegate to `window`). We bind to the jsdom window so
// jsdom's CustomEvent instances are recognized by jsdom's EventTarget implementation.
shimGlobal("addEventListener", dom.window.addEventListener.bind(dom.window));
shimGlobal("removeEventListener", dom.window.removeEventListener.bind(dom.window));
shimGlobal("dispatchEvent", dom.window.dispatchEvent.bind(dom.window));

// Dynamic imports after DOM shim is in place
const { Editor, rootCtx, schemaCtx, parserCtx, serializerCtx } = await import(
  "@milkdown/core"
);
const { commonmark } = await import("@milkdown/preset-commonmark");
const { gfm } = await import("@milkdown/preset-gfm");

const {
  yXmlFragmentToProseMirrorRootNode,
  prosemirrorToYXmlFragment,
} = await import("y-prosemirror");

let _schema = null;
let _parser = null;
let _serializer = null;
let _initPromise = null;

async function ensureInitialized() {
  if (_schema) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Create a headless Milkdown editor to extract schema, parser, serializer.
    // We provide document.body as the root so EditorView has somewhere to mount.
    //
    // IMPORTANT: We keep the editor alive (no destroy) because the commonmark
    // serializer closures reference `ctx` at runtime — e.g. the paragraph
    // serializer reads `editorViewCtx` to decide empty-line handling.
    // Destroying the editor removes those context values and breaks serialization.
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, dom.window.document.body);
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const ctx = editor.ctx;
    _schema = ctx.get(schemaCtx);
    _parser = ctx.get(parserCtx);
    _serializer = ctx.get(serializerCtx);

    console.log("[schema] Milkdown headless initialized — schema nodes:", Object.keys(_schema.nodes).join(", "));
  })();

  return _initPromise;
}

/**
 * Get the ProseMirror schema (lazy-initialized).
 */
export async function getSchema() {
  await ensureInitialized();
  return _schema;
}

/**
 * Parse a markdown string into a ProseMirror document node.
 */
export async function markdownToProseMirrorDoc(markdown) {
  await ensureInitialized();
  return _parser(markdown);
}

/**
 * Serialize a ProseMirror document node to a markdown string.
 */
export async function proseMirrorDocToMarkdown(doc) {
  await ensureInitialized();
  return _serializer(doc);
}

/**
 * Initialize a Y.XmlFragment from a markdown string.
 * Parses markdown -> ProseMirror doc -> populates the named XmlFragment.
 */
export async function markdownToYXmlFragment(ydoc, fragmentName, markdown) {
  await ensureInitialized();
  const doc = _parser(markdown);
  const fragment = ydoc.getXmlFragment(fragmentName);

  ydoc.transact(() => {
    prosemirrorToYXmlFragment(doc, fragment);
  });

  return fragment;
}

/**
 * Convert a Y.XmlFragment back to a markdown string.
 * Reads XmlFragment -> ProseMirror doc -> serializes to markdown.
 */
export async function yXmlFragmentToMarkdown(ydoc, fragmentName) {
  await ensureInitialized();
  const fragment = ydoc.getXmlFragment(fragmentName);
  const doc = yXmlFragmentToProseMirrorRootNode(fragment, _schema);
  return _serializer(doc);
}
