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
from .member_views import MemberDetailView, MemberListView
from .share_views import PublicShareView
from .link_preview import LinkPreviewView
from .internal_views import (
    InternalNodeContentView,
    InternalNodeDetailView,
    NodeAccessView,
    YjsStateView,
)
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
    AIAutocompleteView,
    AICommentReplyView,
    AIFactCheckView,
    AIReviewView,
    AIRouteAgentView,
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
    path("api/ai/fact-check", AIFactCheckView.as_view(), name="ai-fact-check"),
    path("api/ai/comment-reply", AICommentReplyView.as_view(), name="ai-comment-reply"),
    path("api/ai/autocomplete", AIAutocompleteView.as_view(), name="ai-autocomplete"),
    path("api/ai/route-agent", AIRouteAgentView.as_view(), name="ai-route-agent"),
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
    path("api/projects/<int:project_id>/members/", MemberListView.as_view(), name="member-list"),
    path("api/projects/<int:project_id>/members/<int:user_id>/", MemberDetailView.as_view(), name="member-detail"),
    path("api/shared/<uuid:token>/", PublicShareView.as_view(), name="public-share"),
    # Publish — OAuth
    path("api/publish/connect/<str:platform>/", OAuthInitiateView.as_view(), name="publish-connect"),
    path("api/publish/callback/<str:platform>/", OAuthCallbackView.as_view(), name="publish-callback"),
    path("api/publish/connections/", ConnectionListView.as_view(), name="publish-connections"),
    path("api/publish/connections/<int:pk>/", ConnectionDeleteView.as_view(), name="publish-connection-delete"),
    # Publish — Actions
    path("api/publish/", PublishView.as_view(), name="publish"),
    path("api/publish/preview/", PublishPreviewView.as_view(), name="publish-preview"),
    path("api/publish/history/", PublishHistoryView.as_view(), name="publish-history"),
    # Internal (collab server)
    path("api/internal/node-access/<int:node_id>/", NodeAccessView.as_view(), name="internal-node-access"),
    path("api/internal/nodes/<int:node_id>/yjs-state/", YjsStateView.as_view(), name="internal-yjs-state"),
    path("api/internal/nodes/<int:node_id>/content/", InternalNodeContentView.as_view(), name="internal-node-content"),
    path("api/internal/nodes/<int:node_id>/", InternalNodeDetailView.as_view(), name="internal-node-detail"),
]
