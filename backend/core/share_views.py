from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Node, Project
from .serializers import NodeSerializer


class PublicShareView(APIView):
    """GET /api/shared/{token}/ — public read-only access to a shared project."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        project = Project.objects.filter(
            share_token=token, visibility="link_viewable"
        ).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        nodes = Node.objects.filter(project=project).order_by("order", "created_at")
        return Response({
            "project": {
                "id": project.id,
                "name": project.name,
                "project_type": project.project_type,
                "brief": project.brief,
            },
            "nodes": NodeSerializer(nodes, many=True).data,
        })
