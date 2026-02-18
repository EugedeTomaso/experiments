import base64

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Node, YjsState
from .permissions import get_user_role


class InternalAPIMixin:
    """Mixin that checks X-Internal-Key header instead of JWT auth."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def check_internal_key(self, request):
        key = request.META.get("HTTP_X_INTERNAL_KEY", "")
        if key != settings.INTERNAL_API_KEY:
            return False
        return True


class NodeAccessView(InternalAPIMixin, APIView):
    """GET /api/internal/node-access/{node_id}/?user_id={id}"""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response(
                {"detail": "user_id required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node = Node.objects.select_related("project__owner").get(id=node_id)
        except Node.DoesNotExist:
            return Response({"allowed": False, "role": None})

        try:
            user = User.objects.get(id=int(user_id))
        except (User.DoesNotExist, ValueError):
            return Response({"allowed": False, "role": None})

        role = get_user_role(user, node.project)
        return Response({"allowed": role is not None, "role": role})


class InternalNodeDetailView(InternalAPIMixin, APIView):
    """GET /api/internal/nodes/{node_id}/ — returns node data for collab server."""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response({
            "id": node.id,
            "title": node.title,
            "content_md": node.content_md,
            "project_id": node.project_id,
        })


class YjsStateView(InternalAPIMixin, APIView):
    """GET/PATCH /api/internal/nodes/{node_id}/yjs-state/"""

    def get(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            yjs = YjsState.objects.get(node_id=node_id)
        except YjsState.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response({
            "state": base64.b64encode(bytes(yjs.state)).decode(),
            "updated_at": yjs.updated_at,
        })

    def patch(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        state_b64 = request.data.get("state")
        if not state_b64:
            return Response(
                {"detail": "state required"}, status=status.HTTP_400_BAD_REQUEST
            )

        state_bytes = base64.b64decode(state_b64)
        yjs, _ = YjsState.objects.update_or_create(
            node_id=node_id,
            defaults={"state": state_bytes},
        )
        return Response({"status": "ok"})


class InternalNodeContentView(InternalAPIMixin, APIView):
    """PATCH /api/internal/nodes/{node_id}/content/ — update content_md from collab server."""

    def patch(self, request, node_id):
        if not self.check_internal_key(request):
            return Response(status=status.HTTP_403_FORBIDDEN)

        content_md = request.data.get("content_md")
        if content_md is None:
            return Response(
                {"detail": "content_md required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        node.content_md = content_md
        node.save(update_fields=["content_md", "updated_at"])
        return Response({"status": "ok"})
