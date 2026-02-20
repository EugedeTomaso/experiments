import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { api } from "./api";

export const linkPreviewPluginKey = new PluginKey("link-preview");

// ── Client-side cache ────────────────────────────────────────────────

const previewCache = new Map();
const pendingFetches = new Set();

// ── XSS helper ───────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Paragraph-is-bare-URL detection ──────────────────────────────────

function findBookmarkParagraphs(doc) {
  const results = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph") return;
    if (node.childCount !== 1) return;
    const child = node.firstChild;
    if (!child || !child.isText) return;
    if (child.marks.length !== 1) return;
    const mark = child.marks[0];
    if (mark.type.name !== "link") return;
    if (child.text !== mark.attrs.href) return;
    results.push({ offset, size: node.nodeSize, url: mark.attrs.href });
  });
  return results;
}

// ── Bookmark card DOM ────────────────────────────────────────────────

function createBookmarkCard(url) {
  const card = document.createElement("div");
  card.className = "bookmark-card";
  card.contentEditable = "false";
  card.dataset.url = url;

  const cached = previewCache.get(url);
  if (cached) {
    renderCardContent(card, cached);
  } else {
    renderCardSkeleton(card, url);
    fetchPreview(url, card);
  }

  card.addEventListener("click", () => window.open(url, "_blank", "noopener"));
  return card;
}

function renderCardSkeleton(card, url) {
  let domain;
  try { domain = new URL(url).hostname; } catch { domain = url; }
  card.innerHTML = `
    <div class="bookmark-card-body bookmark-card-loading">
      <div class="bookmark-card-skeleton-line" style="width:60%"></div>
      <div class="bookmark-card-skeleton-line" style="width:90%"></div>
      <div class="bookmark-card-skeleton-line" style="width:40%"></div>
    </div>
  `;
}

function renderCardContent(card, data) {
  const left = `
    <div class="bookmark-card-body">
      <div class="bookmark-card-title">${escapeHtml(data.title || data.url)}</div>
      ${data.description ? `<div class="bookmark-card-desc">${escapeHtml(data.description)}</div>` : ""}
      <div class="bookmark-card-meta">
        ${data.favicon ? `<img class="bookmark-card-favicon" src="${escapeHtml(data.favicon)}" alt="" onerror="this.style.display='none'" />` : ""}
        <span class="bookmark-card-domain">${escapeHtml(data.domain || data.url)}</span>
      </div>
    </div>
  `;
  const right = data.image
    ? `<div class="bookmark-card-thumb"><img src="${escapeHtml(data.image)}" alt="" onerror="this.parentElement.style.display='none'" /></div>`
    : "";
  card.innerHTML = left + right;
}

function fetchPreview(url, card) {
  if (pendingFetches.has(url)) return;
  pendingFetches.add(url);

  api.fetchLinkPreview(url)
    .then((data) => {
      previewCache.set(url, data);
      if (card.isConnected) {
        renderCardContent(card, data);
      }
    })
    .catch(() => {
      let domain;
      try { domain = new URL(url).hostname; } catch { domain = url; }
      const fallback = { url, title: "", description: "", image: "", favicon: "", domain };
      previewCache.set(url, fallback);
      if (card.isConnected) {
        renderCardContent(card, fallback);
      }
    })
    .finally(() => pendingFetches.delete(url));
}

// ── Hover tooltip ────────────────────────────────────────────────────

let hoverTooltip = null;
let hoverTimeout = null;
let currentHoverUrl = null;

function showHoverTooltip(anchorEl, url) {
  hideHoverTooltip();
  currentHoverUrl = url;

  const data = previewCache.get(url);

  const tip = document.createElement("div");
  tip.className = "link-hover-tooltip";
  tip.contentEditable = "false";

  if (data && data.title) {
    tip.innerHTML = `
      <div class="link-hover-meta">
        ${data.favicon ? `<img class="link-hover-favicon" src="${escapeHtml(data.favicon)}" alt="" onerror="this.style.display='none'" />` : ""}
        <span class="link-hover-domain">${escapeHtml(data.domain)}</span>
      </div>
      <div class="link-hover-title">${escapeHtml(data.title)}</div>
    `;
  } else {
    let domain;
    try { domain = new URL(url).hostname; } catch { domain = url; }
    tip.innerHTML = `
      <div class="link-hover-meta">
        <span class="link-hover-domain">${escapeHtml(domain)}</span>
      </div>
    `;
    if (!previewCache.has(url) && !pendingFetches.has(url)) {
      pendingFetches.add(url);
      api.fetchLinkPreview(url)
        .then((d) => {
          previewCache.set(url, d);
          if (currentHoverUrl === url && hoverTooltip) {
            showHoverTooltip(anchorEl, url);
          }
        })
        .catch(() => {})
        .finally(() => pendingFetches.delete(url));
    }
  }

  const rect = anchorEl.getBoundingClientRect();
  tip.style.position = "fixed";
  tip.style.left = `${rect.left}px`;
  tip.style.top = `${rect.bottom + 6}px`;
  tip.style.zIndex = "200";

  document.body.appendChild(tip);
  hoverTooltip = tip;

  requestAnimationFrame(() => {
    if (!hoverTooltip) return;
    const tipRect = hoverTooltip.getBoundingClientRect();
    if (tipRect.right > window.innerWidth - 12) {
      hoverTooltip.style.left = `${window.innerWidth - tipRect.width - 12}px`;
    }
    if (tipRect.bottom > window.innerHeight - 12) {
      hoverTooltip.style.top = `${rect.top - tipRect.height - 6}px`;
    }
  });
}

function hideHoverTooltip() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  if (hoverTooltip) {
    hoverTooltip.remove();
    hoverTooltip = null;
  }
  currentHoverUrl = null;
}

// ── Decoration builder ───────────────────────────────────────────────

function buildDecorations(doc) {
  const bookmarks = findBookmarkParagraphs(doc);
  if (bookmarks.length === 0) return DecorationSet.empty;

  const decos = [];
  for (const { offset, size, url } of bookmarks) {
    decos.push(
      Decoration.node(offset, offset + size, {
        class: "bookmark-para",
      })
    );
    decos.push(
      Decoration.widget(
        offset + size,
        () => createBookmarkCard(url),
        { side: -1, key: `bookmark-${url}` }
      )
    );
  }
  return DecorationSet.create(doc, decos);
}

// ── The Plugin ───────────────────────────────────────────────────────

export const linkPreviewPlugin = $prose(() => {
  return new Plugin({
    key: linkPreviewPluginKey,
    state: {
      init(_, state) {
        return buildDecorations(state.doc);
      },
      apply(tr, oldDecos) {
        if (!tr.docChanged) return oldDecos;
        return buildDecorations(tr.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleDOMEvents: {
        mouseover(view, event) {
          const target = event.target;
          if (!(target instanceof HTMLAnchorElement)) return false;
          if (target.closest(".bookmark-para")) return false;
          if (target.closest("[contenteditable='false']")) return false;
          const url = target.href;
          if (!url) return false;

          if (hoverTimeout) clearTimeout(hoverTimeout);
          hoverTimeout = setTimeout(() => showHoverTooltip(target, url), 300);
          return false;
        },
        mouseout(view, event) {
          const target = event.target;
          if (target instanceof HTMLAnchorElement) {
            const related = event.relatedTarget;
            if (related && hoverTooltip && (hoverTooltip === related || hoverTooltip.contains(related))) {
              return false;
            }
            hideHoverTooltip();
          }
          return false;
        },
      },
    },
    view() {
      return {
        destroy() {
          hideHoverTooltip();
        },
      };
    },
  });
});
