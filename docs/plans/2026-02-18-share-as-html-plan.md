# Share as HTML — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side rendered public pages so users can share project documents via a URL that anyone can view in a browser.

**Architecture:** Django views render markdown to HTML using the `markdown` library (already a dependency). Templates are served at `/public/<token>/` URLs without authentication. The existing `share_token` and `visibility` fields on Project gate access. A `published_snapshot` JSONField on Project enables "freeze" mode.

**Tech Stack:** Django templates, Python `markdown` library, CSS (no JS frameworks for public pages)

**Design doc:** `docs/plans/2026-02-18-share-as-html-design.md`

---

### Task 1: Add published_snapshot fields to Project model

**Files:**
- Modify: `backend/core/models.py:19-42` (Project model)
- Create: `backend/core/migrations/0012_project_published_snapshot.py`

**Step 1: Add fields to Project model**

In `backend/core/models.py`, add two fields to the `Project` model after `share_token` (line 40):

```python
published_snapshot = models.JSONField(null=True, blank=True, default=None)
published_at = models.DateTimeField(null=True, blank=True)
```

`published_snapshot` stores a serialized node tree when frozen: `[{id, title, type, parent_id, order, content_md}, ...]`. When `null`, the public page serves live content.

**Step 2: Generate and run migration**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core -n project_published_snapshot
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 3: Copy files to Docker mount**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/migrations/0012_project_published_snapshot.py /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/0012_project_published_snapshot.py
```

**Step 4: Commit**

```bash
git add backend/core/models.py backend/core/migrations/0012_project_published_snapshot.py
git commit -m "feat: add published_snapshot fields to Project model"
```

---

### Task 2: Create the public page Django template

**Files:**
- Create: `backend/core/templates/core/public_page.html`

**Step 1: Create template directory**

```bash
mkdir -p backend/core/templates/core
```

**Step 2: Write the single/multi-document template**

Create `backend/core/templates/core/public_page.html` — a self-contained HTML page with embedded CSS. Template receives context: `project_name`, `node_title`, `body_html`, `nav_nodes` (list of {id, title, type, depth, active}), `base_url`, `is_multi_node`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ node_title }} — {{ project_name }}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: #1a1a1a;
  background: #fff;
}

/* Layout */
.page { display: flex; min-height: 100vh; }

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #e5e5e3;
  padding: 2rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6b6b6b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 1.25rem 1rem;
}

.sidebar a {
  display: block;
  padding: 0.375rem 1.25rem;
  color: #37352f;
  text-decoration: none;
  font-size: 0.875rem;
  border-radius: 4px;
  margin: 1px 0.5rem;
}
.sidebar a:hover { background: #f3f3f1; }
.sidebar a.active { background: #f3f3f1; font-weight: 600; }
.sidebar .depth-1 { padding-left: 2.25rem; }
.sidebar .depth-2 { padding-left: 3.25rem; }
.sidebar .depth-3 { padding-left: 4.25rem; }

.content {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

/* No sidebar — center content */
.page--single .content {
  max-width: 720px;
  margin: 0 auto;
}

/* Typography */
.content h1 {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}
.content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}
.content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
}
.content p { margin-bottom: 1rem; }
.content ul, .content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
.content li { margin-bottom: 0.25rem; }

.content blockquote {
  border-left: 3px solid #e5e5e3;
  padding-left: 1rem;
  color: #555;
  margin: 1rem 0;
}

.content code {
  background: #f4f4f2;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.875em;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
.content pre {
  background: #f4f4f2;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1rem 0;
}
.content pre code {
  background: none;
  padding: 0;
  font-size: 0.8125rem;
}

.content img { max-width: 100%; height: auto; border-radius: 4px; }

.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}
.content th, .content td {
  border: 1px solid #e5e5e3;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.content th { background: #f9f9f8; font-weight: 600; }

.content hr {
  border: none;
  border-top: 1px solid #e5e5e3;
  margin: 2rem 0;
}

/* Mobile */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  .mobile-nav {
    display: block;
    border-bottom: 1px solid #e5e5e3;
    padding: 0.75rem 1rem;
  }
  .mobile-nav summary {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b6b6b;
    cursor: pointer;
  }
  .mobile-nav a {
    display: block;
    padding: 0.375rem 0;
    color: #37352f;
    text-decoration: none;
    font-size: 0.875rem;
  }
  .mobile-nav a.active { font-weight: 600; }
  .content { padding: 2rem 1rem 3rem; }
}
@media (min-width: 769px) {
  .mobile-nav { display: none; }
}
</style>
</head>
<body>
<div class="page {% if not is_multi_node %}page--single{% endif %}">
  {% if is_multi_node %}
  <!-- Desktop sidebar -->
  <nav class="sidebar">
    <div class="sidebar-title">{{ project_name }}</div>
    {% for nav in nav_nodes %}
    <a href="{{ base_url }}{{ nav.id }}/"
       class="depth-{{ nav.depth }}{% if nav.active %} active{% endif %}">
      {{ nav.title }}
    </a>
    {% endfor %}
  </nav>
  {% endif %}

  {% if is_multi_node %}
  <!-- Mobile navigation -->
  <nav class="mobile-nav">
    <details>
      <summary>{{ project_name }} — Navigation</summary>
      {% for nav in nav_nodes %}
      <a href="{{ base_url }}{{ nav.id }}/"
         {% if nav.active %}class="active"{% endif %}>
        {{ nav.title }}
      </a>
      {% endfor %}
    </details>
  </nav>
  {% endif %}

  <main class="content">
    <h1>{{ node_title }}</h1>
    {{ body_html|safe }}
  </main>
</div>
</body>
</html>
```

**Step 3: Commit**

```bash
git add backend/core/templates/core/public_page.html
git commit -m "feat: add public page HTML template"
```

---

### Task 3: Create the public page Django view

**Files:**
- Create: `backend/core/public_views.py`
- Modify: `backend/core/urls.py`

**Step 1: Write the view**

Create `backend/core/public_views.py`:

```python
import markdown as md_lib
from django.http import Http404
from django.shortcuts import render

from .export_utils import collect_project_content
from .models import Node, Project


def public_page(request, token, node_id=None):
    """Render a public read-only HTML page for a shared project."""
    project = Project.objects.filter(
        share_token=token, visibility="link_viewable"
    ).first()
    if not project:
        raise Http404

    nodes_with_depth = collect_project_content(project.id)
    is_multi_node = len(nodes_with_depth) > 1
    base_url = f"/public/{token}/"

    # Build navigation list (file nodes only)
    nav_nodes = []
    file_nodes = []
    for node, depth in nodes_with_depth:
        if node.type == Node.NodeType.FILE:
            file_nodes.append((node, depth))
            nav_nodes.append({
                "id": node.id,
                "title": node.title,
                "depth": depth,
                "active": False,
            })

    if not file_nodes:
        raise Http404

    # Determine which node to render
    if node_id is not None:
        target = None
        for node, depth in file_nodes:
            if node.id == node_id:
                target = node
                break
        if not target:
            raise Http404
    else:
        target = file_nodes[0][0]

    # Mark active node in nav
    for nav in nav_nodes:
        nav["active"] = nav["id"] == target.id

    # Get content — from snapshot if published, else live
    if project.published_snapshot:
        snapshot_map = {item["id"]: item for item in project.published_snapshot}
        content_md = snapshot_map.get(target.id, {}).get("content_md", "")
    else:
        content_md = target.content_md

    body_html = md_lib.markdown(
        content_md,
        extensions=["extra", "codehilite", "smarty", "tables"],
    )

    return render(request, "core/public_page.html", {
        "project_name": project.name,
        "node_title": target.title,
        "body_html": body_html,
        "nav_nodes": nav_nodes,
        "base_url": base_url,
        "is_multi_node": is_multi_node,
    })
```

**Step 2: Add URL patterns**

In `backend/core/urls.py`, add import at top (after line 20):

```python
from .public_views import public_page
```

Add URL patterns in `urlpatterns` (after line 102, in a new "Public pages" section):

```python
    # Public pages (HTML)
    path("public/<uuid:token>/", public_page, name="public-page"),
    path("public/<uuid:token>/<int:node_id>/", public_page, name="public-page-node"),
```

**Step 3: Copy files to Docker mount**

```bash
cp backend/core/public_views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/public_views.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
```

**Step 4: Test manually**

Open a project in the app, enable link sharing (if not already), note the share_token. Then visit: `http://localhost:8000/public/<share_token>/`

**Step 5: Commit**

```bash
git add backend/core/public_views.py backend/core/urls.py
git commit -m "feat: add public page view and URL routing"
```

---

### Task 4: Add publish snapshot API endpoint

**Files:**
- Modify: `backend/core/views.py:38-63` (ProjectViewSet)
- Modify: `backend/core/serializers.py:22-45` (ProjectSerializer)

**Step 1: Add published fields to serializer**

In `backend/core/serializers.py`, update `ProjectSerializer.Meta.fields` (line 28) to include `published_snapshot` and `published_at`:

```python
fields = [
    "id", "name", "project_type", "project_extension", "brief",
    "auto_context", "context_nodes", "workspace", "owner",
    "visibility", "share_token", "published_snapshot", "published_at",
    "created_at", "updated_at",
    "current_user_role",
]
```

Add them to `read_only_fields` (line 33):

```python
read_only_fields = ["workspace", "owner", "share_token", "published_snapshot", "published_at", "created_at", "updated_at"]
```

**Step 2: Add publish-snapshot action to ProjectViewSet**

In `backend/core/views.py`, add a new action to `ProjectViewSet` (after `perform_update`, ~line 63):

```python
@action(detail=True, methods=["post"], url_path="publish-snapshot")
def publish_snapshot(self, request, pk=None):
    """Freeze current content as the published snapshot."""
    project = self.get_object()
    role = get_user_role(request.user, project)
    if role not in ("owner", "admin", "editor"):
        return Response(status=status.HTTP_403_FORBIDDEN)

    nodes = Node.objects.filter(project=project).order_by("order", "created_at")
    snapshot = []
    for node in nodes:
        snapshot.append({
            "id": node.id,
            "title": node.title,
            "type": node.type,
            "parent_id": node.parent_id,
            "order": node.order,
            "content_md": node.content_md,
        })
        # Also create a Version record for each file node
        if node.type == Node.NodeType.FILE and node.content_md:
            Version.objects.create(node=node, content_md=node.content_md)

    from django.utils import timezone
    project.published_snapshot = snapshot
    project.published_at = timezone.now()
    project.save(update_fields=["published_snapshot", "published_at"])

    return Response(ProjectSerializer(project, context={"request": request}).data)

@action(detail=True, methods=["post"], url_path="unpublish-snapshot")
def unpublish_snapshot(self, request, pk=None):
    """Switch back to live content mode."""
    project = self.get_object()
    role = get_user_role(request.user, project)
    if role not in ("owner", "admin", "editor"):
        return Response(status=status.HTTP_403_FORBIDDEN)

    project.published_snapshot = None
    project.published_at = None
    project.save(update_fields=["published_snapshot", "published_at"])

    return Response(ProjectSerializer(project, context={"request": request}).data)
```

Add missing imports at top of `views.py`: `from .models import ... Version` (ensure Version is imported).

**Step 3: Copy files to Docker mount**

```bash
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
```

**Step 4: Test the endpoints**

```bash
# Publish snapshot
curl -X POST http://localhost:8000/api/projects/<id>/publish-snapshot/ -H "Authorization: Bearer <token>"

# Unpublish
curl -X POST http://localhost:8000/api/projects/<id>/unpublish-snapshot/ -H "Authorization: Bearer <token>"
```

**Step 5: Commit**

```bash
git add backend/core/views.py backend/core/serializers.py
git commit -m "feat: add publish/unpublish snapshot API endpoints"
```

---

### Task 5: Add "Public page" section to ShareDialog

**Files:**
- Modify: `frontend/src/components/ShareDialog.jsx`
- Modify: `frontend/src/api.js`

**Step 1: Add API methods**

In `frontend/src/api.js`, add two new methods (near the other project-related methods):

```javascript
publishSnapshot(projectId) {
  return request(`/api/projects/${projectId}/publish-snapshot/`, {
    method: "POST",
  });
},

unpublishSnapshot(projectId) {
  return request(`/api/projects/${projectId}/unpublish-snapshot/`, {
    method: "POST",
  });
},
```

**Step 2: Update ShareDialog**

In `frontend/src/components/ShareDialog.jsx`, add state for public page:

After line 12 (`const [copied, setCopied] = useState(false);`):

```javascript
const [publicCopied, setPublicCopied] = useState(false);
const [publishing, setPublishing] = useState(false);
```

Add handlers after `handleCopyLink` (after line 54):

```javascript
const handleCopyPublicLink = () => {
  const link = `${window.location.origin.replace(':5174', ':8000').replace(':5173', ':8000')}/public/${project.share_token}/`;
  navigator.clipboard.writeText(link);
  setPublicCopied(true);
  setTimeout(() => setPublicCopied(false), 2000);
};

const handlePublishSnapshot = async () => {
  setPublishing(true);
  try {
    await api.publishSnapshot(project.id);
    onProjectUpdate?.();
  } catch {} finally {
    setPublishing(false);
  }
};

const handleUnpublishSnapshot = async () => {
  setPublishing(true);
  try {
    await api.unpublishSnapshot(project.id);
    onProjectUpdate?.();
  } catch {} finally {
    setPublishing(false);
  }
};
```

Add the "Public page" section in JSX, after the "Link sharing" `</div>` (after line 180):

```jsx
{/* Public page */}
{isLinkSharing && project.share_token && (
  <div className="share-link-section">
    <div className="share-link-toggle">
      <div>
        <span className="share-link-label">Public page</span>
        <span className="share-link-desc">
          Shareable webpage version of your document
        </span>
      </div>
    </div>
    <div className="share-public-url">
      <code className="share-public-url-text">
        /public/{project.share_token?.slice(0, 8)}...
      </code>
      <button className="share-copy-btn" onClick={handleCopyPublicLink}>
        {publicCopied ? "Copied!" : "Copy link"}
      </button>
    </div>
    <div className="share-publish-mode">
      <label className="share-radio">
        <input
          type="radio"
          name="publishMode"
          checked={!project.published_snapshot}
          onChange={handleUnpublishSnapshot}
          disabled={publishing}
        />
        <span>Live — always shows latest content</span>
      </label>
      <label className="share-radio">
        <input
          type="radio"
          name="publishMode"
          checked={!!project.published_snapshot}
          onChange={handlePublishSnapshot}
          disabled={publishing}
        />
        <span>
          Published version
          {project.published_at && (
            <> — frozen {new Date(project.published_at).toLocaleDateString()}</>
          )}
        </span>
      </label>
      {project.published_snapshot && (
        <button
          className="share-update-btn"
          onClick={handlePublishSnapshot}
          disabled={publishing}
        >
          {publishing ? "Updating..." : "Update to latest"}
        </button>
      )}
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ShareDialog.jsx frontend/src/api.js
git commit -m "feat: add public page section to ShareDialog"
```

---

### Task 6: Add CSS styles for ShareDialog public page section

**Files:**
- Modify: `frontend/src/App.css` (search for `.share-` selectors)

**Step 1: Add styles**

Find the existing `.share-link-section` styles in `App.css` and add new styles after them:

```css
.share-public-url {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0 0.75rem;
}

.share-public-url-text {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--text-2);
  background: var(--surface-inset);
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-publish-mode {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
}

.share-radio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-1);
  cursor: pointer;
}

.share-radio input[type="radio"] {
  accent-color: var(--text-1);
}

.share-update-btn {
  align-self: flex-start;
  font-size: 0.75rem;
  color: var(--text-2);
  background: var(--surface-inset);
  border: none;
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  margin-top: 0.25rem;
}
.share-update-btn:hover {
  background: var(--border-subtle);
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add CSS for public page share controls"
```

---

### Task 7: Copy all backend files to Docker mount and verify

**Step 1: Copy all modified backend files**

```bash
cp backend/core/models.py /Users/eugeniodetomaso/Projects/experiments/backend/core/models.py
cp backend/core/views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/views.py
cp backend/core/serializers.py /Users/eugeniodetomaso/Projects/experiments/backend/core/serializers.py
cp backend/core/urls.py /Users/eugeniodetomaso/Projects/experiments/backend/core/urls.py
cp backend/core/public_views.py /Users/eugeniodetomaso/Projects/experiments/backend/core/public_views.py
mkdir -p /Users/eugeniodetomaso/Projects/experiments/backend/core/templates/core
cp backend/core/templates/core/public_page.html /Users/eugeniodetomaso/Projects/experiments/backend/core/templates/core/public_page.html
cp -r backend/core/migrations/ /Users/eugeniodetomaso/Projects/experiments/backend/core/migrations/
```

**Step 2: Run migration in Docker**

```bash
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 3: Verify by visiting a public page**

1. Open the app at `http://localhost:5174`
2. Open a project, go to Share, enable "Public link"
3. Copy the public page URL
4. Open it in an incognito window at `http://localhost:8000/public/<token>/`
5. Verify: clean article layout, correct content, sidebar for multi-node projects

**Step 4: Test snapshot publish/unpublish**

1. In ShareDialog, select "Published version" radio
2. Refresh the public page — content should still show
3. Edit the document in the app
4. Refresh the public page — should still show old content (frozen)
5. Switch back to "Live" — should show updated content
