# Share as HTML — Public Page Design

## Overview

Add a "Public page" feature that renders project documents as server-side HTML pages accessible via a tokenized URL. Visitors see a clean, minimalist article-style page without needing to log in or use the app.

## URLs

- `/public/<project_share_token>/` — Shows the project's content. If single-node project, renders that node directly. If multi-node, shows an index or the first document with sidebar navigation.
- `/public/<project_share_token>/<node_id>/` — Renders a specific node within a project, with sidebar showing the full document tree.

Reuses the existing `share_token` on the `Project` model. No new tokens needed.

## Data Model Changes

**Project model** — add one field:
- `published_version` (ForeignKey to `Version`, nullable, on_delete=SET_NULL) — When null, the public page serves live content (current state of each node). When set, serves the snapshot from that version.

No changes to the `Node` model.

## Backend

### Django View

A new `PublicPageView` (standard Django view, not DRF) that:

1. Looks up `Project` by `share_token`, validates `visibility` allows public access
2. If `published_version` is set, loads content from that Version snapshot
3. If live, loads current node content from the database
4. Converts markdown to HTML using Python `markdown` library (with extensions: tables, fenced_code, codehilite, toc)
5. Renders a Django template with the HTML content and navigation data

### URL Configuration

Add to `backend/core/urls.py` (outside `/api/` prefix):
```
/public/<token>/
/public/<token>/<node_id>/
```

### Version Freezing

When user clicks "Publish current version":
1. Create a new `Version` snapshot (or select an existing one)
2. Set `project.published_version = version`
3. Public page now serves that frozen content

When user clicks "Update to latest" or switches back to live:
1. Set `project.published_version = None`

## Frontend Changes

### ShareDialog Enhancement

Add a "Public page" section below the existing email sharing section:

```
─────────────────────────────────────
Public page
─────────────────────────────────────
[ Toggle: Enable public page ]

When enabled:
  URL: https://domain.com/public/abc123/  [Copy]

  Content mode:
  ( ) Live — always shows latest content
  ( ) Published version — frozen at Feb 18, 2026
      [Update to latest]
─────────────────────────────────────
```

- Toggle reuses the existing `link_viewable` visibility flag (or a new `public_page_enabled` flag)
- Copy button copies the public URL to clipboard
- "Published version" radio triggers version snapshot creation via API

## Template Design

### Single Document View

```
┌─────────────────────────────────────────────┐
│                                             │
│           Document Title (h1)               │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Rendered markdown content. Clean sans-     │
│  serif typography (Inter / System UI).      │
│  Max-width 720px, centered. White bg.       │
│                                             │
│  Headings, paragraphs, lists, code blocks,  │
│  images, tables — all styled.               │
│                                             │
└─────────────────────────────────────────────┘
```

### Multi-Document View (Project)

```
┌──────────────┬──────────────────────────────┐
│              │                              │
│  Intro       │    Document Title (h1)       │
│  Chapter 1   │                              │
│    Scene 1   │    Rendered content...       │
│  ► Scene 2   │                              │
│  Chapter 2   │                              │
│    Scene 3   │                              │
│              │                              │
└──────────────┴──────────────────────────────┘
```

- Sidebar: plain HTML links, no JavaScript required
- Active node highlighted
- Mobile: sidebar collapses via `<details>` element or CSS toggle

### Typography & Styling

- Font: `Inter, -apple-system, system-ui, sans-serif`
- Body: 16px, line-height 1.75, color `#1a1a1a`
- Max-width: 720px, centered with `margin: 0 auto`
- Background: white (`#ffffff`)
- Headings: tighter letter-spacing, heavier weight
- Code blocks: light gray background, monospace font
- All CSS inline in the template (no external stylesheet needed)

## Security

- Share token in URL is the sole access control
- Token can be regenerated from ShareDialog (already implemented) to revoke access
- No authentication required to view public pages
- Rate limiting recommended for production

## Scope

### In scope (v1)
- Public page rendering for single nodes and multi-node projects
- Sidebar navigation for projects
- Live content mode
- Version freezing via existing Version system
- ShareDialog UI for enabling/configuring public page
- Responsive mobile layout

### Out of scope (future)
- Custom domains
- Analytics/view tracking
- Password protection
- Custom CSS/themes
- Comments on public pages
- SEO meta tags (og:image, etc.) — could be added later
