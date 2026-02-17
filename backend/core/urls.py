from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .auth_views import (
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)
from .export_views import ExportFormatsView, NodeExportView, ProjectExportView
from .invitation_views import (
    AcceptInvitationView,
    DeclineInvitationView,
    InvitationListView,
    InviteView,
)
from .link_preview import LinkPreviewView
from .publish_views import (
    ConnectionDeleteView,
    ConnectionListView,
    OAuthCallbackView,
    OAuthInitiateView,
    PublishHistoryView,
    PublishPreviewView,
    PublishView,
)
from .views import (
    AICommentReplyView,
    AIReviewView,
    AIStreamView,
    AgentConfigViewSet,
    AgentViewSet,
    CommentViewSet,
    ConversationViewSet,
    MemoryViewSet,
    MessageViewSet,
    NodeSearchView,
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
router.register(r"conversations", ConversationViewSet, basename="conversation")
router.register(r"messages", MessageViewSet, basename="message")
router.register(r"memories", MemoryViewSet, basename="memory")

urlpatterns = [
    # Auth
    path("api/auth/register/", RegisterView.as_view(), name="auth-register"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("api/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/auth/password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("api/auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    # App
    path("api/", include(router.urls)),
    path("api/ai/stream", AIStreamView.as_view(), name="ai-stream"),
    path("api/ai/review", AIReviewView.as_view(), name="ai-review"),
    path("api/ai/comment-reply", AICommentReplyView.as_view(), name="ai-comment-reply"),
    path("api/nodes/<int:node_id>/summary", NodeSummaryView.as_view(), name="node-summary"),
    path("api/search/", NodeSearchView.as_view(), name="node-search"),
    path("api/link-preview/", LinkPreviewView.as_view(), name="link-preview"),
    # Export
    path("api/export/node/<int:node_id>/", NodeExportView.as_view(), name="node-export"),
    path("api/export/project/<int:project_id>/", ProjectExportView.as_view(), name="project-export"),
    path("api/export/formats/", ExportFormatsView.as_view(), name="export-formats"),
    # Sharing
    path("api/projects/<int:project_id>/invite/", InviteView.as_view(), name="project-invite"),
    path("api/invitations/", InvitationListView.as_view(), name="invitation-list"),
    path("api/invitations/<int:pk>/accept/", AcceptInvitationView.as_view(), name="invitation-accept"),
    path("api/invitations/<int:pk>/decline/", DeclineInvitationView.as_view(), name="invitation-decline"),
    # Publish — OAuth
    path("api/publish/connect/<str:platform>/", OAuthInitiateView.as_view(), name="publish-connect"),
    path("api/publish/callback/<str:platform>/", OAuthCallbackView.as_view(), name="publish-callback"),
    path("api/publish/connections/", ConnectionListView.as_view(), name="publish-connections"),
    path("api/publish/connections/<int:pk>/", ConnectionDeleteView.as_view(), name="publish-connection-delete"),
    # Publish — Actions
    path("api/publish/", PublishView.as_view(), name="publish"),
    path("api/publish/preview/", PublishPreviewView.as_view(), name="publish-preview"),
    path("api/publish/history/", PublishHistoryView.as_view(), name="publish-history"),
]
