import secrets

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .export_utils import build_combined_markdown, collect_project_content
from .models import Node, PlatformConnection, Project, PublishRecord
from .publishers import OAUTH_CONFIG, PUBLISHERS
from .serializers import PlatformConnectionSerializer, PublishRecordSerializer


# ---------------------------------------------------------------------------
# OAuth Flow
# ---------------------------------------------------------------------------

OAUTH_SUCCESS_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Connected</title></head>
<body>
<script>
  window.opener && window.opener.postMessage(
    {type: "oauth-success", platform: "%s"}, "*"
  );
  window.close();
</script>
<p>Connected! You can close this window.</p>
</body>
</html>
"""


class OAuthInitiateView(APIView):
    """Start the OAuth flow for a platform.

    Returns a JSON response with the authorization URL that the frontend
    should open in a popup window.
    """

    def get(self, request, platform):
        config = OAUTH_CONFIG.get(platform)
        if not config:
            return Response(
                {"detail": f"Unknown platform: {platform}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate state token for CSRF protection
        state = secrets.token_urlsafe(32)
        request.session[f"oauth_state_{platform}"] = state

        client_id = getattr(settings, f"{platform.upper()}_CLIENT_ID", "")
        callback_url = request.build_absolute_uri(f"/api/publish/callback/{platform}/")

        scopes = " ".join(config["scopes"])
        params = (
            f"?client_id={client_id}"
            f"&redirect_uri={callback_url}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
        )

        # Twitter uses PKCE
        if platform == "twitter":
            import hashlib
            import base64

            code_verifier = secrets.token_urlsafe(64)
            request.session[f"oauth_verifier_{platform}"] = code_verifier
            code_challenge = (
                base64.urlsafe_b64encode(
                    hashlib.sha256(code_verifier.encode()).digest()
                )
                .rstrip(b"=")
                .decode()
            )
            params += f"&code_challenge={code_challenge}&code_challenge_method=S256"

        auth_url = config["authorize_url"] + params
        return Response({"auth_url": auth_url})


class OAuthCallbackView(APIView):
    """Handle the OAuth callback from the platform."""

    permission_classes = [AllowAny]

    def get(self, request, platform):
        config = OAUTH_CONFIG.get(platform)
        if not config:
            return HttpResponse("Unknown platform", status=400)

        code = request.GET.get("code")
        state = request.GET.get("state")

        if not code:
            return HttpResponse("Missing authorization code", status=400)

        # Verify state
        expected_state = request.session.pop(f"oauth_state_{platform}", None)
        if state != expected_state:
            return HttpResponse("Invalid state parameter", status=400)

        # Exchange code for tokens
        import httpx

        client_id = getattr(settings, f"{platform.upper()}_CLIENT_ID", "")
        client_secret = getattr(settings, f"{platform.upper()}_CLIENT_SECRET", "")
        callback_url = request.build_absolute_uri(f"/api/publish/callback/{platform}/")

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": callback_url,
        }

        # Twitter PKCE
        if platform == "twitter":
            verifier = request.session.pop(f"oauth_verifier_{platform}", "")
            token_data["code_verifier"] = verifier

        try:
            resp = httpx.post(config["token_url"], data=token_data)
            resp.raise_for_status()
            tokens = resp.json()
        except Exception as exc:
            return HttpResponse(f"Token exchange failed: {exc}", status=500)

        access_token = tokens.get("access_token", "")
        refresh_token = tokens.get("refresh_token", "")

        # Fetch user info
        publisher_cls = PUBLISHERS.get(platform)
        user_info = {"user_id": "", "username": ""}
        if publisher_cls and access_token:
            try:
                publisher = publisher_cls(access_token)
                user_info = publisher.get_user_info()
            except Exception:
                pass

        # Save connection
        conn, _ = PlatformConnection.objects.update_or_create(
            platform=platform,
            defaults={
                "platform_user_id": user_info.get("user_id", ""),
                "platform_username": user_info.get("username", ""),
            },
        )
        conn.set_access_token(access_token)
        if refresh_token:
            conn.set_refresh_token(refresh_token)
        conn.save()

        return HttpResponse(OAUTH_SUCCESS_HTML % platform, content_type="text/html")


# ---------------------------------------------------------------------------
# Connection Management
# ---------------------------------------------------------------------------


class ConnectionListView(APIView):
    """List all connected platforms."""

    def get(self, request):
        connections = PlatformConnection.objects.all()
        serializer = PlatformConnectionSerializer(connections, many=True)
        return Response(serializer.data)


class ConnectionDeleteView(APIView):
    """Disconnect a platform."""

    def delete(self, request, pk):
        try:
            conn = PlatformConnection.objects.get(pk=pk)
            conn.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PlatformConnection.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Publish Actions
# ---------------------------------------------------------------------------


class PublishView(APIView):
    """Publish content to a connected platform."""

    def post(self, request):
        platform = request.data.get("platform")
        node_id = request.data.get("node_id")
        project_id = request.data.get("project_id")
        title = request.data.get("title", "")
        options = request.data.get("options", {})

        if not platform:
            return Response({"detail": "platform is required"}, status=status.HTTP_400_BAD_REQUEST)

        conn = PlatformConnection.objects.filter(platform=platform).first()
        if not conn:
            return Response(
                {"detail": f"Not connected to {platform}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get content
        content = ""
        node = None
        project = None

        if node_id:
            node = Node.objects.filter(id=node_id).first()
            if not node:
                return Response({"detail": "Node not found"}, status=status.HTTP_404_NOT_FOUND)
            content = node.content_md
            title = title or node.title
        elif project_id:
            project = Project.objects.filter(id=project_id).first()
            if not project:
                return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
            nodes_with_depth = collect_project_content(project_id)
            content = build_combined_markdown(nodes_with_depth)
            title = title or project.name
        else:
            return Response(
                {"detail": "node_id or project_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Publish
        publisher_cls = PUBLISHERS.get(platform)
        if not publisher_cls:
            return Response(
                {"detail": f"No publisher for {platform}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        access_token = conn.get_access_token()
        publisher = publisher_cls(access_token)

        try:
            result = publisher.publish(title, content, options)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Record
        record = PublishRecord.objects.create(
            platform_connection=conn,
            node=node,
            project=project,
            title=title,
            platform_post_id=result.get("post_id", ""),
            platform_url=result.get("url", ""),
        )

        return Response(PublishRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class PublishPreviewView(APIView):
    """Preview how content will appear on a platform (e.g., Twitter thread split)."""

    def post(self, request):
        platform = request.data.get("platform")
        node_id = request.data.get("node_id")
        project_id = request.data.get("project_id")
        title = request.data.get("title", "")
        options = request.data.get("options", {})

        # Get content
        content = ""
        if node_id:
            node = Node.objects.filter(id=node_id).first()
            if node:
                content = node.content_md
                title = title or node.title
        elif project_id:
            nodes_with_depth = collect_project_content(project_id)
            content = build_combined_markdown(nodes_with_depth)

        if platform == "twitter":
            from .publishers.twitter import TwitterPublisher

            publisher = TwitterPublisher("")
            tweets = publisher.preview_thread(title, content, options)
            return Response({"platform": "twitter", "tweets": tweets})

        # For other platforms, return the raw content that would be published
        return Response({
            "platform": platform,
            "title": title,
            "content": content,
            "content_length": len(content),
        })


class PublishHistoryView(APIView):
    """Return publish history."""

    def get(self, request):
        records = PublishRecord.objects.select_related("platform_connection").all()[:50]
        serializer = PublishRecordSerializer(records, many=True)
        return Response(serializer.data)
