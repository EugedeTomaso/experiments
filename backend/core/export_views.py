from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .export_utils import collect_project_content
from .exporters import FORMAT_EXPORTERS, FORMATS_BY_TYPE
from .models import Node, Project


class NodeExportView(APIView):
    """Export a single document node to the requested format."""

    def post(self, request, node_id):
        fmt = request.data.get("format")
        if not fmt:
            return Response({"detail": "format is required"}, status=status.HTTP_400_BAD_REQUEST)

        node = Node.objects.filter(id=node_id, type=Node.NodeType.FILE).first()
        if not node:
            return Response({"detail": "File node not found"}, status=status.HTTP_404_NOT_FOUND)

        exporter_cls = FORMAT_EXPORTERS.get(fmt)
        if not exporter_cls:
            return Response(
                {"detail": f"Unsupported format: {fmt}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_type = node.project.project_type or "freeform"

        exporter = exporter_cls(
            title=node.title,
            project_type=project_type,
            content_md=node.content_md,
        )

        try:
            data = exporter.export()
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        response = HttpResponse(data, content_type=exporter.content_type)
        safe_title = node.title.replace('"', "'")
        response["Content-Disposition"] = f'attachment; filename="{safe_title}.{exporter.file_extension}"'
        return response


class ProjectExportView(APIView):
    """Export an entire project (all nodes combined) to the requested format."""

    def post(self, request, project_id):
        fmt = request.data.get("format")
        if not fmt:
            return Response({"detail": "format is required"}, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        exporter_cls = FORMAT_EXPORTERS.get(fmt)
        if not exporter_cls:
            return Response(
                {"detail": f"Unsupported format: {fmt}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nodes_with_depth = collect_project_content(project_id)
        if not nodes_with_depth:
            return Response({"detail": "Project has no content"}, status=status.HTTP_404_NOT_FOUND)

        project_type = project.project_type or "freeform"

        exporter = exporter_cls(
            title=project.name,
            project_type=project_type,
            nodes_with_depth=nodes_with_depth,
        )

        try:
            data = exporter.export()
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        response = HttpResponse(data, content_type=exporter.content_type)
        safe_title = project.name.replace('"', "'")
        response["Content-Disposition"] = f'attachment; filename="{safe_title}.{exporter.file_extension}"'
        return response


class ExportFormatsView(APIView):
    """Return available export formats for a given project type."""

    def get(self, request):
        project_type = request.query_params.get("type", "freeform")
        formats = FORMATS_BY_TYPE.get(project_type, FORMATS_BY_TYPE["freeform"])
        return Response({"formats": formats})
