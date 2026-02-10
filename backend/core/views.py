from django.http import StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .llm import stream_chat
from .models import Agent, AgentConfig, Comment, Node, Project, ProviderKey, Version, Workspace
from .serializers import (
    AgentConfigSerializer,
    AgentSerializer,
    CommentSerializer,
    NodeSerializer,
    ProjectSerializer,
    ProviderKeySerializer,
    VersionSerializer,
    WorkspaceSerializer,
)
from .utils import ensure_hardcoded_provider_keys, get_hardcoded_provider_key


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by("created_at")
    serializer_class = ProjectSerializer


class NodeViewSet(viewsets.ModelViewSet):
    serializer_class = NodeSerializer

    def get_queryset(self):
        queryset = Node.objects.all().order_by("order", "created_at")
        project_id = self.request.query_params.get("project")
        parent_id = self.request.query_params.get("parent")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if parent_id is not None:
            queryset = queryset.filter(parent_id=parent_id)
        return queryset


class VersionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = VersionSerializer

    def get_queryset(self):
        queryset = Version.objects.all().order_by("-created_at")
        node_id = self.request.query_params.get("node")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        return queryset


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer

    def get_queryset(self):
        queryset = Comment.objects.all().order_by("created_at")
        node_id = self.request.query_params.get("node")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        return queryset


class AgentViewSet(viewsets.ModelViewSet):
    serializer_class = AgentSerializer

    def get_queryset(self):
        queryset = Agent.objects.all().order_by("name")
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset


class AgentConfigViewSet(viewsets.ModelViewSet):
    serializer_class = AgentConfigSerializer

    def get_queryset(self):
        queryset = AgentConfig.objects.select_related("agent").order_by("created_at")
        scope_type = self.request.query_params.get("scope_type")
        project_id = self.request.query_params.get("project")
        node_id = self.request.query_params.get("node")
        if scope_type:
            queryset = queryset.filter(scope_type=scope_type)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="resolve")
    def resolve(self, request):
        node_id = request.query_params.get("node")
        project_id = request.query_params.get("project")

        if node_id:
            try:
                node = Node.objects.select_related("project", "parent").get(id=node_id)
            except Node.DoesNotExist:
                return Response({"detail": "Node not found"}, status=404)
            project = node.project
        elif project_id:
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                return Response({"detail": "Project not found"}, status=404)
            node = None
        else:
            return Response({"detail": "node or project is required"}, status=400)

        merged = {}
        last_agent_id = None
        last_agent_name = None
        inherited = False

        def apply_config(cfg):
            nonlocal merged, last_agent_id, last_agent_name
            if cfg.agent:
                merged.update(cfg.agent.config or {})
                last_agent_id = cfg.agent.id
                last_agent_name = cfg.agent.name
            else:
                merged.update(cfg.config or {})

        project_config = (
            AgentConfig.objects.select_related("agent")
            .filter(scope_type=AgentConfig.ScopeType.PROJECT, project=project)
            .first()
        )
        if project_config:
            apply_config(project_config)

        if node:
            chain = []
            current = node
            while current is not None:
                chain.append(current)
                current = current.parent
            for item in reversed(chain):
                config = (
                    AgentConfig.objects.select_related("agent")
                    .filter(node=item)
                    .first()
                )
                if config:
                    apply_config(config)

        if last_agent_id and node:
            direct_config = (
                AgentConfig.objects.select_related("agent")
                .filter(node=node)
                .first()
            )
            if not direct_config or (direct_config.agent_id != last_agent_id):
                inherited = True

        return Response({
            "config": merged,
            "agent_id": last_agent_id,
            "agent_name": last_agent_name,
            "inherited": inherited,
        })


class ProviderKeyViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderKeySerializer

    def get_queryset(self):
        ensure_hardcoded_provider_keys()
        return ProviderKey.objects.all().order_by("provider")


class AIStreamView(APIView):
    def post(self, request):
        provider = request.data.get("provider")
        if not provider:
            return Response({"detail": "provider is required"}, status=400)

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response(
                {"detail": "Provider key missing"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            generator = stream_chat(provider, api_key, request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        response = StreamingHttpResponse(generator, content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        return response
