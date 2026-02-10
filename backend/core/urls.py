from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AIStreamView,
    AgentConfigViewSet,
    AgentViewSet,
    CommentViewSet,
    NodeSummaryView,
    NodeViewSet,
    ProjectViewSet,
    ProviderKeyViewSet,
    VersionViewSet,
    WorkspaceViewSet,
)

router = DefaultRouter()
router.register(r"workspaces", WorkspaceViewSet, basename="workspace")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"nodes", NodeViewSet, basename="node")
router.register(r"versions", VersionViewSet, basename="version")
router.register(r"comments", CommentViewSet, basename="comment")
router.register(r"agents", AgentViewSet, basename="agent")
router.register(r"agent-configs", AgentConfigViewSet, basename="agent-config")
router.register(r"provider-keys", ProviderKeyViewSet, basename="provider-key")

urlpatterns = [
    path("api/", include(router.urls)),
    path("api/ai/stream", AIStreamView.as_view(), name="ai-stream"),
    path("api/nodes/<int:node_id>/summary", NodeSummaryView.as_view(), name="node-summary"),
]
