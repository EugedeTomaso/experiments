/**
 * Mermaid diagram plugin for Milkdown.
 *
 * Detects code blocks with language "mermaid" and renders them as SVG diagrams
 * using the mermaid.js library. The source code block is hidden by default and
 * the rendered diagram appears below it as a Decoration.widget() with
 * Edit/Expand toolbar buttons.
 */
import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

let mermaidModule = null;
let mermaidReady = false;

// Lazy-load mermaid (it's large) and initialize once
async function getMermaid() {
  if (mermaidReady) return mermaidModule;
  if (!mermaidModule) {
    const m = await import("mermaid");
    mermaidModule = m.default || m;
    mermaidModule.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      fontFamily: "inherit",
      suppressErrorRendering: true,
    });
    mermaidReady = true;
  }
  return mermaidModule;
}

export const mermaidPluginKey = new PluginKey("mermaid-diagrams");

// Simple hash for caching
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

// Cache: hash → rendered SVG string
const svgCache = new Map();
// Track pending renders to avoid duplicates
const pendingRenders = new Set();
// Track which blocks are in editing mode (by content hash)
const editingBlocks = new Set();

function findMermaidBlocks(doc) {
  const results = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "code_block" && node.attrs.language === "mermaid") {
      results.push({ offset, size: node.nodeSize, code: node.textContent });
    }
  });
  return results;
}

let renderCounter = 0;

function showExpandOverlay(svgHtml) {
  const overlay = document.createElement("div");
  overlay.className = "mermaid-overlay";
  overlay.innerHTML = svgHtml;

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  const onKey = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
}

function setSvgContent(container, svg) {
  const content = container.querySelector(".mermaid-content");
  if (content) {
    content.innerHTML = svg;
  }
}

function createDiagramWidget(code, view) {
  const container = document.createElement("div");
  container.className = "mermaid-diagram";
  container.contentEditable = "false";

  const hash = hashCode(code);

  // Toolbar with Edit and Expand buttons
  const toolbar = document.createElement("div");
  toolbar.className = "mermaid-toolbar";

  const editBtn = document.createElement("button");
  editBtn.className = "mermaid-edit-btn";
  editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit';
  editBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Toggle editing state via ProseMirror transaction so it survives DOM rebuilds
    if (editingBlocks.has(hash)) {
      editingBlocks.delete(hash);
    } else {
      editingBlocks.add(hash);
    }
    if (view) {
      view.dispatch(view.state.tr.setMeta(mermaidPluginKey, { toggleEdit: hash }));
    }
    // If now editing, focus the source code block
    if (editingBlocks.has(hash)) {
      requestAnimationFrame(() => {
        const source = container.previousElementSibling;
        if (source) {
          const codeEl = source.querySelector("code") || source;
          codeEl.focus();
        }
      });
    }
  });

  const expandBtn = document.createElement("button");
  expandBtn.className = "mermaid-expand-btn";
  expandBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Expand';
  expandBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cachedSvg = svgCache.get(hash);
    if (cachedSvg && !cachedSvg.includes("mermaid-error")) {
      showExpandOverlay(cachedSvg);
    }
  });

  toolbar.appendChild(editBtn);
  toolbar.appendChild(expandBtn);

  // Content area for the SVG
  const content = document.createElement("div");
  content.className = "mermaid-content";

  container.appendChild(toolbar);
  container.appendChild(content);

  // If cached, render immediately
  if (svgCache.has(hash)) {
    content.innerHTML = svgCache.get(hash);
    container.setAttribute("data-hash", hash);
    return container;
  }

  // Show loading skeleton
  content.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';

  // Render async
  if (!pendingRenders.has(hash)) {
    pendingRenders.add(hash);
    const id = `mermaid-${++renderCounter}`;
    getMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => {
        // Check for mermaid error SVG
        if (svg.includes('class="error-text"')) {
          throw new Error("Invalid diagram syntax");
        }
        svgCache.set(hash, svg);
        pendingRenders.delete(hash);
        // Update all widgets with this hash
        document.querySelectorAll(`.mermaid-diagram[data-hash="${hash}"]`).forEach((el) => {
          setSvgContent(el, svg);
        });
        // Also update this container directly
        setSvgContent(container, svg);
      })
      .catch((err) => {
        const errMsg = typeof err === "string" ? err : err?.message || "Invalid diagram syntax";
        const errorHtml = `<div class="mermaid-error">${escapeHtml(errMsg)}</div>`;
        svgCache.set(hash, errorHtml);
        pendingRenders.delete(hash);
        setSvgContent(container, errorHtml);
      });
  }

  container.setAttribute("data-hash", hash);
  return container;
}

function escapeHtml(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

function buildDecorations(doc) {
  const blocks = findMermaidBlocks(doc);
  if (!blocks.length) return DecorationSet.empty;

  const decos = [];
  for (const { offset, size, code } of blocks) {
    if (!code.trim()) continue;

    const hash = hashCode(code);
    const isEditing = editingBlocks.has(hash);

    // Hide the source code block (shown via :focus-within or mermaid-editing CSS)
    decos.push(
      Decoration.node(offset, offset + size, {
        class: isEditing ? "mermaid-source mermaid-editing" : "mermaid-source",
      })
    );

    // Inject rendered SVG widget after the code block
    decos.push(
      Decoration.widget(offset + size, (view) => createDiagramWidget(code, view), {
        side: 1,
        key: `mermaid-${hash}`,
      })
    );
  }
  return DecorationSet.create(doc, decos);
}

export const mermaidPlugin = $prose(
  () =>
    new Plugin({
      key: mermaidPluginKey,
      state: {
        init(_, state) {
          return buildDecorations(state.doc);
        },
        apply(tr, old) {
          const meta = tr.getMeta(mermaidPluginKey);
          if (!tr.docChanged && !meta?.toggleEdit) return old;
          return buildDecorations(tr.doc);
        },
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    })
);
