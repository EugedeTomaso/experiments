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
