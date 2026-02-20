from .models import Node


def collect_project_content(project_id):
    """Return [(node, depth), ...] in depth-first tree order, sorted by `order`."""
    nodes = list(
        Node.objects.filter(project_id=project_id).order_by("order", "created_at")
    )
    by_parent = {}
    for n in nodes:
        by_parent.setdefault(n.parent_id, []).append(n)

    result = []

    def walk(parent_id, depth):
        for child in by_parent.get(parent_id, []):
            result.append((child, depth))
            if child.type == Node.NodeType.FOLDER:
                walk(child.id, depth + 1)

    walk(None, 0)
    return result


def build_combined_markdown(nodes_with_depth):
    """Combine all nodes into a single markdown string.

    Folders become headings at their depth level.
    Files contribute their content_md.
    """
    parts = []
    for node, depth in nodes_with_depth:
        if node.type == Node.NodeType.FOLDER:
            heading_level = min(depth + 1, 6)
            parts.append(f"{'#' * heading_level} {node.title}\n")
        elif node.type == Node.NodeType.FILE:
            if node.content_md:
                parts.append(node.content_md)
    return "\n\n".join(parts)
