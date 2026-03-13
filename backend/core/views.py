import json
import uuid
from datetime import timedelta

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .llm import (
    generate_critique_sync,
    generate_review_sync,
    generate_summary_sync,
    route_agent_sync,
    stream_chat,
    PROVIDERS,
    _sync_anthropic_review,
    _sync_openai_compatible_review,
)
from django.db.models import Count, Q
from .permissions import (
    get_accessible_projects,
    get_project_for_object,
    get_user_role,
    require_project_role,
    user_can_access_project,
)

from .models import Agent, AgentConfig, Comment, Conversation, Critique, CritiqueMessage, CritiqueThread, Memory, Message, Node, Project, ProviderKey, Version, Workspace
from .serializers import (
    AgentConfigSerializer,
    AgentSerializer,
    CommentSerializer,
    ConversationSerializer,
    CritiqueMessageSerializer,
    CritiqueSerializer,
    MemorySerializer,
    MessageSerializer,
    NodeSerializer,
    ProjectSerializer,
    ProviderKeySerializer,
    VersionSerializer,
    WorkspaceSerializer,
)
from .utils import ensure_hardcoded_provider_keys, get_hardcoded_provider_key


# ---------------------------------------------------------------------------
# Default agents seeded on every new project
# ---------------------------------------------------------------------------

DEFAULT_AGENTS = [
    {
        "name": "The Mirror",
        "config": {
            "system_prompt": (
                "You are The Mirror. Your role is to reflect back the writer's ideas "
                "in different words, helping them see if they communicated what they "
                "intended. Never suggest changes — only reformulate and ask 'Is this "
                "what you meant?' Be precise, neutral, and Socratic. Use questions, "
                "not statements."
            ),
            "temperature": 0.3,
        },
    },
    {
        "name": "The Challenger",
        "config": {
            "system_prompt": (
                "You are The Challenger. Your role is to question the writer's ideas, "
                "find logical gaps, and play devil's advocate. Ask 'Do you really "
                "believe this? What would someone who disagrees say?' Be intellectually "
                "provocative but respectful. Push the writer to think harder, never to "
                "give up."
            ),
            "temperature": 0.6,
        },
    },
    {
        "name": "The Polisher",
        "config": {
            "system_prompt": (
                "You are The Polisher. Your role is pure editing craft — cut unnecessary "
                "words, tighten sentences, improve rhythm and flow. Never comment on the "
                "ideas or content — only on the writing itself. Be terse and surgical. "
                "Show, don't explain. When suggesting changes, just show the improved "
                "version."
            ),
            "temperature": 0.2,
        },
    },
    {
        "name": "The Explorer",
        "config": {
            "system_prompt": (
                "You are The Explorer. Your role is to expand the writer's thinking — "
                "bring references, draw connections to other ideas, suggest tangential "
                "angles they haven't considered. Say things like 'This reminds me of...' "
                "and 'Have you considered...?' Be curious, associative, and expansive. "
                "Open doors, don't close them."
            ),
            "temperature": 0.8,
        },
    },
]


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return get_accessible_projects(self.request.user).order_by("created_at")

    def perform_create(self, serializer):
        project = serializer.save()
        for agent_data in DEFAULT_AGENTS:
            Agent.objects.get_or_create(
                project=project,
                name=agent_data["name"],
                defaults={"config": agent_data["config"]},
            )

    @action(detail=True, methods=["post"], url_path="regenerate-share-token")
    def regenerate_share_token(self, request, pk=None):
        project = self.get_object()
        role = get_user_role(request.user, project)
        if role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        project.share_token = uuid.uuid4()
        project.save(update_fields=["share_token"])
        return Response({"share_token": str(project.share_token)})

    def perform_update(self, serializer):
        require_project_role(self.request.user, serializer.instance, "editor")
        instance = serializer.save()
        # Auto-generate share_token when enabling link sharing
        if instance.visibility == "link_viewable" and not instance.share_token:
            instance.share_token = uuid.uuid4()
            instance.save(update_fields=["share_token"])

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance, "editor")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="publish-snapshot")
    def publish_snapshot(self, request, pk=None):
        """Freeze current content as the published snapshot."""
        project = self.get_object()
        role = get_user_role(request.user, project)
        if role not in ("owner", "admin", "editor"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        nodes = Node.objects.filter(project=project).order_by("order", "created_at")
        snapshot = []
        for node in nodes:
            snapshot.append({
                "id": node.id,
                "title": node.title,
                "type": node.type,
                "parent_id": node.parent_id,
                "order": node.order,
                "content_md": node.content_md,
            })
            # Also create a Version record for each file node
            if node.type == Node.NodeType.FILE and node.content_md:
                Version.objects.create(node=node, content_md=node.content_md)

        project.published_snapshot = snapshot
        project.published_at = timezone.now()
        project.save(update_fields=["published_snapshot", "published_at"])

        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="unpublish-snapshot")
    def unpublish_snapshot(self, request, pk=None):
        """Switch back to live content mode."""
        project = self.get_object()
        role = get_user_role(request.user, project)
        if role not in ("owner", "admin", "editor"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        project.published_snapshot = None
        project.published_at = None
        project.save(update_fields=["published_snapshot", "published_at"])

        return Response(ProjectSerializer(project, context={"request": request}).data)


class NodeViewSet(viewsets.ModelViewSet):
    serializer_class = NodeSerializer

    def get_queryset(self):
        accessible_projects = get_accessible_projects(self.request.user)
        queryset = Node.objects.filter(
            project__in=accessible_projects
        ).order_by("order", "created_at")

        project_id = self.request.query_params.get("project")
        parent_id = self.request.query_params.get("parent")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if parent_id is not None:
            queryset = queryset.filter(parent_id=parent_id)
        return queryset

    def perform_create(self, serializer):
        require_project_role(
            self.request.user, serializer.validated_data["project"], "editor"
        )
        serializer.save()

    def perform_update(self, serializer):
        require_project_role(self.request.user, serializer.instance.project, "editor")
        serializer.save()

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance.project, "editor")
        instance.delete()


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
        queryset = Comment.objects.select_related("agent", "node__project").filter(
            node__project__in=get_accessible_projects(self.request.user)
        ).annotate(
            reply_count=Count("replies")
        ).order_by("created_at")
        node_id = self.request.query_params.get("node")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        root_only = self.request.query_params.get("root_only")
        if root_only == "true":
            queryset = queryset.filter(parent__isnull=True)
        return queryset

    def perform_create(self, serializer):
        require_project_role(
            self.request.user, serializer.validated_data["node"].project, "commenter"
        )
        serializer.save()

    def perform_update(self, serializer):
        require_project_role(self.request.user, serializer.instance.node.project, "commenter")
        serializer.save()

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance.node.project, "commenter")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        comment = self.get_object()
        require_project_role(request.user, comment.node.project, "editor")
        comment.status = Comment.Status.APPROVED
        comment.save(update_fields=["status"])
        return Response(CommentSerializer(comment).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        comment = self.get_object()
        require_project_role(request.user, comment.node.project, "commenter")
        comment.status = Comment.Status.REJECTED
        comment.save(update_fields=["status"])
        return Response(CommentSerializer(comment).data)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        comment = self.get_object()
        require_project_role(request.user, comment.node.project, "commenter")
        comment.status = Comment.Status.RESOLVED
        comment.save(update_fields=["status"])
        return Response(CommentSerializer(comment).data)


class AgentViewSet(viewsets.ModelViewSet):
    serializer_class = AgentSerializer

    def get_queryset(self):
        queryset = Agent.objects.filter(
            project__in=get_accessible_projects(self.request.user)
        ).order_by("name")
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        require_project_role(
            self.request.user, serializer.validated_data["project"], "editor"
        )
        serializer.save()

    def perform_update(self, serializer):
        require_project_role(self.request.user, serializer.instance.project, "editor")
        serializer.save()

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance.project, "editor")
        instance.delete()


class AgentConfigViewSet(viewsets.ModelViewSet):
    serializer_class = AgentConfigSerializer

    def get_queryset(self):
        accessible_projects = get_accessible_projects(self.request.user)
        queryset = AgentConfig.objects.select_related("agent").filter(
            Q(project__in=accessible_projects) | Q(node__project__in=accessible_projects)
        ).order_by("created_at")
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

        if not user_can_access_project(request.user, project):
            return Response({"detail": "Project not found"}, status=404)

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

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        if project is None:
            project = serializer.validated_data["node"].project
        require_project_role(self.request.user, project, "editor")
        serializer.save()

    def perform_update(self, serializer):
        project = get_project_for_object(serializer.instance)
        require_project_role(self.request.user, project, "editor")
        serializer.save()

    def perform_destroy(self, instance):
        project = get_project_for_object(instance)
        require_project_role(self.request.user, project, "editor")
        instance.delete()


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        queryset = Conversation.objects.filter(
            node__project__in=get_accessible_projects(self.request.user)
        ).annotate(
            message_count=Count("messages")
        ).order_by("-updated_at")
        node_id = self.request.query_params.get("node")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        return queryset

    def perform_create(self, serializer):
        require_project_role(
            self.request.user, serializer.validated_data["node"].project, "commenter"
        )
        serializer.save()

    def perform_update(self, serializer):
        require_project_role(self.request.user, serializer.instance.node.project, "commenter")
        serializer.save()

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance.node.project, "commenter")
        instance.delete()


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer

    def get_queryset(self):
        queryset = Message.objects.select_related("routed_agent").filter(
            conversation__node__project__in=get_accessible_projects(self.request.user)
        ).order_by("created_at")
        conversation_id = self.request.query_params.get("conversation")
        if conversation_id:
            queryset = queryset.filter(conversation_id=conversation_id)
        return queryset

    def perform_create(self, serializer):
        require_project_role(
            self.request.user,
            serializer.validated_data["conversation"].node.project,
            "commenter",
        )
        message = serializer.save()
        # Touch conversation updated_at
        Conversation.objects.filter(id=message.conversation_id).update(
            updated_at=timezone.now()
        )

    def perform_update(self, serializer):
        require_project_role(
            self.request.user, serializer.instance.conversation.node.project, "commenter"
        )
        serializer.save()

    def perform_destroy(self, instance):
        require_project_role(self.request.user, instance.conversation.node.project, "commenter")
        instance.delete()


class ProviderKeyViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderKeySerializer

    def get_queryset(self):
        ensure_hardcoded_provider_keys()
        return ProviderKey.objects.all().order_by("provider")


class MemoryViewSet(viewsets.ModelViewSet):
    serializer_class = MemorySerializer

    def get_queryset(self):
        queryset = Memory.objects.filter(user=self.request.user)
        scope = self.request.query_params.get("scope")
        project_id = self.request.query_params.get("project")

        if scope:
            queryset = queryset.filter(scope=scope)
        if project_id:
            queryset = queryset.filter(
                Q(scope="user") | Q(project_id=project_id)
            )
        return queryset.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="resolve")
    def resolve(self, request):
        project_id = request.query_params.get("project")
        queryset = Memory.objects.filter(user=request.user)
        if project_id:
            queryset = queryset.filter(
                Q(scope="user") | Q(project_id=project_id)
            )
        else:
            queryset = queryset.filter(scope="user")

        user_memories = []
        project_memories = []
        for mem in queryset:
            if mem.scope == "user":
                user_memories.append({"id": mem.id, "content": mem.content})
            else:
                project_memories.append({"id": mem.id, "content": mem.content})

        return Response({
            "user_memories": user_memories,
            "project_memories": project_memories,
        })


class AIStreamView(APIView):
    def post(self, request):
        provider = request.data.get("provider")
        model = request.data.get("model")
        print(f"[AIStream] provider={provider}, model={model}", flush=True)
        if not provider:
            return Response({"detail": "provider is required"}, status=400)

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        print(f"[AIStream] db_key_len={len(api_key) if api_key else 0}, has_provider_key={provider_key is not None}", flush=True)
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
            print(f"[AIStream] fallback_key_len={len(api_key) if api_key else 0}", flush=True)
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


class AIRouteAgentView(APIView):
    def post(self, request):
        try:
            project_id = int(request.data.get("project_id"))
        except (TypeError, ValueError):
            return Response({"detail": "project_id must be an integer"}, status=400)
        query = request.data.get("query", "").strip()

        if not query:
            return Response(
                {"detail": "query is required"}, status=400
            )

        # Verify the user has access to this project
        project = Project.objects.filter(
            Q(owner=request.user) | Q(memberships__user=request.user, memberships__accepted=True),
            id=project_id,
        ).first()
        if not project:
            return Response({"detail": "Project not found"}, status=404)

        agents = list(Agent.objects.filter(project=project).order_by("id"))

        # 0 agents → return empty (use default)
        if not agents:
            return Response({"agent_id": None, "agent_name": None, "config": {}})

        # 1 agent → return it directly, skip LLM call
        if len(agents) == 1:
            agent = agents[0]
            return Response({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "config": agent.config,
            })

        # 2+ agents → route via LLM
        agents_desc_lines = []
        for i, agent in enumerate(agents, 1):
            prompt_preview = (agent.config.get("system_prompt") or "")[:200]
            agents_desc_lines.append(f'{i}. "{agent.name}" — {prompt_preview}')
        agents_desc = "\n".join(agents_desc_lines)

        # Use the first agent's provider/model for routing
        router_provider = agents[0].config.get("provider", "deepseek")
        router_model = agents[0].config.get("model", "deepseek-chat")

        provider_key = ProviderKey.objects.filter(provider=router_provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(router_provider)
        if not api_key:
            # Can't route without API key — return first agent as fallback
            agent = agents[0]
            return Response({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "config": agent.config,
            })

        try:
            result = route_agent_sync(
                router_provider, api_key, router_model, query, agents_desc
            )
            choice = int(result.strip().split()[0])
        except (ValueError, IndexError):
            choice = 0
        except Exception:
            choice = 0

        if 1 <= choice <= len(agents):
            agent = agents[choice - 1]
        else:
            return Response({"agent_id": None, "agent_name": None, "config": {}})

        return Response({
            "agent_id": agent.id,
            "agent_name": agent.name,
            "config": agent.config,
        })


class AIAutocompleteView(APIView):
    def post(self, request):
        text = request.data.get("text", "").strip()
        if not text:
            return Response({"detail": "text is required"}, status=400)

        context = request.data.get("context", "")

        from .llm import AUTOCOMPLETE_PROVIDER
        provider_key = ProviderKey.objects.filter(provider=AUTOCOMPLETE_PROVIDER).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(AUTOCOMPLETE_PROVIDER)
        if not api_key:
            return Response({"detail": "OpenRouter key missing"}, status=400)

        try:
            from .llm import generate_autocomplete_sync
            completion = generate_autocomplete_sync(api_key, text, context)
            return Response({"completion": completion})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)


SUMMARY_DEBOUNCE = timedelta(minutes=15)


class NodeSummaryView(APIView):
    def post(self, request, node_id):
        node = Node.objects.filter(id=node_id, type=Node.NodeType.FILE).first()
        if not node:
            return Response({"detail": "File node not found"}, status=404)
        if not user_can_access_project(request.user, node.project):
            return Response({"detail": "File node not found"}, status=404)

        # Debounce: reject if file was edited within the last 15 min
        now = timezone.now()
        since_edit = now - node.updated_at
        if since_edit < SUMMARY_DEBOUNCE:
            remaining = int((SUMMARY_DEBOUNCE - since_edit).total_seconds())
            return Response(
                {"detail": "File was edited recently", "retry_after_seconds": remaining},
                status=429,
            )

        # Freshness: if summary is up to date, return it without regenerating
        if node.summary and node.summary_updated_at and node.summary_updated_at >= node.updated_at:
            return Response({
                "summary": node.summary,
                "summary_updated_at": node.summary_updated_at,
            })

        # Must have content to summarize
        if not node.content_md or not node.content_md.strip():
            return Response({"detail": "No content to summarize"}, status=400)

        # Resolve provider + model from request body
        provider = request.data.get("provider")
        model = request.data.get("model")
        if not provider or not model:
            return Response({"detail": "provider and model are required"}, status=400)

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response({"detail": "Provider key missing"}, status=400)

        try:
            summary_text = generate_summary_sync(provider, api_key, model, node.title, node.content_md)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)

        node.summary = summary_text
        node.summary_updated_at = now
        node.save(update_fields=["summary", "summary_updated_at"])

        return Response({
            "summary": node.summary,
            "summary_updated_at": node.summary_updated_at,
        })


class NodeSearchView(APIView):
    """Full-text search across node title, summary, and content."""

    def get(self, request):
        project_id = request.query_params.get("project")
        q = request.query_params.get("q", "").strip()
        if not project_id or not q:
            return Response([])
        project = get_accessible_projects(request.user).filter(id=project_id).first()
        if not project:
            return Response([])

        try:
            from django.contrib.postgres.search import (
                SearchHeadline,
                SearchQuery,
                SearchRank,
                SearchVector,
            )

            search_vector = (
                SearchVector("title", weight="A")
                + SearchVector("summary", weight="B")
                + SearchVector("content_md", weight="C")
            )
            search_query = SearchQuery(q, search_type="websearch")

            results = (
                Node.objects.filter(project=project)
                .annotate(
                    rank=SearchRank(search_vector, search_query),
                    headline=SearchHeadline(
                        "content_md",
                        search_query,
                        start_sel="<mark>",
                        stop_sel="</mark>",
                        max_words=30,
                        min_words=15,
                    ),
                )
                .filter(rank__gt=0)
                .order_by("-rank")[:20]
            )
        except Exception:
            # Fallback to simple icontains search
            results = (
                Node.objects.filter(project=project)
                .filter(
                    Q(title__icontains=q)
                    | Q(content_md__icontains=q)
                    | Q(summary__icontains=q)
                )
                .order_by("-updated_at")[:20]
            )
            data = []
            for node in results:
                snippet = ""
                if node.content_md:
                    idx = node.content_md.lower().find(q.lower())
                    if idx >= 0:
                        start = max(0, idx - 60)
                        end = min(len(node.content_md), idx + len(q) + 60)
                        snippet = node.content_md[start:end]
                data.append({
                    "id": node.id,
                    "title": node.title,
                    "type": node.type,
                    "parent": node.parent_id,
                    "summary": (node.summary or "")[:150],
                    "headline": snippet,
                    "updated_at": node.updated_at.isoformat(),
                    "word_count": len(node.content_md.strip().split()) if node.content_md else 0,
                })
            return Response(data)

        data = []
        for node in results:
            data.append({
                "id": node.id,
                "title": node.title,
                "type": node.type,
                "parent": node.parent_id,
                "summary": (node.summary or "")[:150],
                "headline": node.headline,
                "updated_at": node.updated_at.isoformat(),
                "word_count": len(node.content_md.strip().split()) if node.content_md else 0,
            })
        return Response(data)


class AIReviewView(APIView):
    def post(self, request):
        node_id = request.data.get("node_id")
        provider = request.data.get("provider")
        model = request.data.get("model")
        focus = request.data.get("focus", "all")
        selection_from = request.data.get("selection_from")
        selection_to = request.data.get("selection_to")

        if not node_id or not provider or not model:
            return Response(
                {"detail": "node_id, provider, and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        node = Node.objects.filter(id=node_id, type=Node.NodeType.FILE).first()
        if not node:
            return Response({"detail": "File node not found"}, status=404)
        if not user_can_access_project(request.user, node.project):
            return Response({"detail": "File node not found"}, status=404)
        require_project_role(request.user, node.project, "commenter")

        content = node.content_md or ""
        if not content.strip():
            return Response({"detail": "No content to review"}, status=400)

        offset = 0
        if selection_from is not None and selection_to is not None:
            offset = int(selection_from)
            content = content[offset:int(selection_to)]

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response({"detail": "Provider key missing"}, status=400)

        try:
            review_items = generate_review_sync(
                provider, api_key, model, content, focus
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)

        comments = []
        for item in review_items:
            quoted = item.get("quoted_text", "")
            pos_from = None
            pos_to = None
            if quoted:
                idx = content.find(quoted)
                if idx >= 0:
                    pos_from = idx + offset
                    pos_to = idx + len(quoted) + offset

            comment = Comment.objects.create(
                node=node,
                body=item.get("body", ""),
                author_type=Comment.AuthorType.ASSISTANT,
                author_label="Assistant",
                status=Comment.Status.OPEN,
                quoted_text=quoted,
                suggested_text=item.get("suggested_text", ""),
                position_from=pos_from,
                position_to=pos_to,
            )
            comments.append(comment)

        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CritiqueViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CritiqueSerializer

    def get_queryset(self):
        qs = Critique.objects.filter(
            node__project__in=get_accessible_projects(self.request.user)
        )
        node_id = self.request.query_params.get("node_id")
        if node_id:
            qs = qs.filter(node_id=node_id)
        return qs.order_by("-created_at")


class AICritiqueView(APIView):
    def post(self, request):
        node_id = request.data.get("node_id")
        provider = request.data.get("provider", "deepseek")
        model = request.data.get("model", "deepseek-chat")

        if not node_id:
            return Response({"error": "node_id is required"}, status=400)

        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response({"error": "Node not found"}, status=404)
        if not user_can_access_project(request.user, node.project):
            return Response({"error": "Node not found"}, status=404)
        require_project_role(request.user, node.project, "commenter")

        content = node.content_md or ""
        if not content.strip():
            return Response({"error": "Document is empty"}, status=400)

        try:
            pk = ProviderKey.objects.get(provider=provider)
            api_key = pk.get_api_key()
        except ProviderKey.DoesNotExist:
            return Response({"error": f"No API key for {provider}"}, status=400)

        try:
            result = generate_critique_sync(provider, api_key, model, content)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

        for i, section in enumerate(result.get("sections", [])):
            section["id"] = f"sec_{i + 1}"

        critique = Critique.objects.create(
            node=node,
            sections=result.get("sections", []),
            overall_score=result.get("overall_score", 0),
            summary=result.get("summary", ""),
        )

        return Response(CritiqueSerializer(critique).data, status=201)


class AICritiqueDiscussView(APIView):
    def post(self, request):
        critique_id = request.data.get("critique_id")
        section_id = request.data.get("section_id")
        message = request.data.get("message", "").strip()

        if not all([critique_id, section_id, message]):
            return Response({"error": "critique_id, section_id, and message are required"}, status=400)

        try:
            critique = Critique.objects.get(id=critique_id)
        except Critique.DoesNotExist:
            return Response({"error": "Critique not found"}, status=404)
        if not user_can_access_project(request.user, critique.node.project):
            return Response({"error": "Critique not found"}, status=404)
        require_project_role(request.user, critique.node.project, "commenter")

        section = None
        for s in critique.sections:
            if s.get("id") == section_id:
                section = s
                break
        if not section:
            return Response({"error": "Section not found"}, status=404)

        thread, _ = CritiqueThread.objects.get_or_create(
            critique=critique, section_id=section_id
        )

        CritiqueMessage.objects.create(thread=thread, role="user", content=message)

        history = list(thread.messages.order_by("created_at").values("role", "content"))

        agent_id = request.data.get("agent_id")
        provider = request.data.get("provider", "deepseek")
        model = request.data.get("model", "deepseek-chat")

        agent = None
        agent_system_prompt = ""
        if agent_id:
            agent = Agent.objects.filter(id=agent_id).first()
            if agent:
                agent_config = agent.config or {}
                provider = agent_config.get("provider", provider)
                model = agent_config.get("model", model)
                if agent_config.get("system_prompt"):
                    agent_system_prompt = agent_config["system_prompt"] + "\n\n"

        try:
            pk = ProviderKey.objects.get(provider=provider)
            api_key = pk.get_api_key()
        except ProviderKey.DoesNotExist:
            return Response({"error": f"No API key for {provider}"}, status=400)

        system_content = agent_system_prompt + (
            f"You are a professional writing critic discussing your evaluation of a document.\n\n"
            f"Your critique of the section \"{section['title']}\" (score: {section['score']}/10):\n"
            f"{section['body']}\n\n"
            f"The user wants to discuss this section further. Be specific and helpful. "
            f"Reference the document content when relevant."
        )

        doc_content = critique.node.content_md or ""

        llm_messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": f"Document being discussed:\n\n{doc_content[:8000]}"},
        ]
        for msg in history:
            llm_messages.append({"role": msg["role"], "content": msg["content"]})

        config = PROVIDERS.get(provider)
        if not config:
            return Response({"error": f"Unsupported provider: {provider}"}, status=400)

        try:
            if config["type"] == "anthropic":
                full_text = _sync_anthropic_review(api_key, config["base_url"], model, llm_messages)
            else:
                full_text = _sync_openai_compatible_review(api_key, config["base_url"], model, llm_messages)

            assistant_msg = CritiqueMessage.objects.create(
                thread=thread, role="assistant", content=full_text
            )

            return Response({
                "message": CritiqueMessageSerializer(assistant_msg).data,
                "thread_id": thread.id,
            }, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AIFactCheckView(APIView):
    def post(self, request):
        node_id = request.data.get("node_id")
        provider = request.data.get("provider")
        model = request.data.get("model")
        selection_from = request.data.get("selection_from")
        selection_to = request.data.get("selection_to")

        if not node_id or not provider or not model:
            return Response(
                {"detail": "node_id, provider, and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        node = Node.objects.filter(id=node_id, type=Node.NodeType.FILE).first()
        if not node:
            return Response({"detail": "File node not found"}, status=404)
        if not user_can_access_project(request.user, node.project):
            return Response({"detail": "File node not found"}, status=404)
        require_project_role(request.user, node.project, "commenter")

        content = node.content_md or ""
        if not content.strip():
            return Response({"detail": "No content to fact-check"}, status=400)

        offset = 0
        if selection_from is not None and selection_to is not None:
            offset = int(selection_from)
            content = content[offset:int(selection_to)]

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response({"detail": "Provider key missing"}, status=400)

        def generate():
            from .llm import extract_claims_sync, verify_claim_sync
            from .exa import search_exa
            from .serializers import CommentSerializer

            # Step 1: Extract claims
            try:
                claims = extract_claims_sync(provider, api_key, model, content)
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
                yield "event: done\ndata: [DONE]\n\n"
                return

            yield f"data: {json.dumps({'type': 'claims_extracted', 'count': len(claims)})}\n\n"

            if not claims:
                yield "event: done\ndata: [DONE]\n\n"
                return

            # Step 2: Verify each claim
            for claim_data in claims:
                claim_text = claim_data.get("claim", "")
                quoted_text = claim_data.get("quoted_text", "")

                if not claim_text or not quoted_text:
                    continue

                # Find position in content
                pos_from = None
                pos_to = None
                idx = content.find(quoted_text)
                if idx >= 0:
                    pos_from = idx + offset
                    pos_to = idx + len(quoted_text) + offset

                # Search Exa
                try:
                    exa_results = search_exa(claim_text, num_results=5)
                except Exception:
                    exa_results = []

                # Build source list (truncate text for storage)
                sources = [
                    {"url": r["url"], "title": r["title"], "snippet": r["text"][:200]}
                    for r in exa_results
                ]

                # Verify with LLM
                try:
                    verdict_data = verify_claim_sync(
                        provider, api_key, model, claim_text, quoted_text, exa_results
                    )
                except Exception:
                    verdict_data = {
                        "verdict": "dubious",
                        "explanation": "Verification failed.",
                        "suggested_text": "",
                    }

                # Create comment
                comment = Comment.objects.create(
                    node=node,
                    body=verdict_data.get("explanation", ""),
                    author_type=Comment.AuthorType.ASSISTANT,
                    author_label="Fact-Checker",
                    status=Comment.Status.OPEN,
                    quoted_text=quoted_text,
                    suggested_text=verdict_data.get("suggested_text", ""),
                    position_from=pos_from,
                    position_to=pos_to,
                    comment_type="fact_check",
                    verdict=verdict_data.get("verdict", "dubious") if verdict_data.get("verdict") in {"verified", "dubious", "false"} else "dubious",
                    sources=sources,
                )

                serialized = CommentSerializer(comment).data
                yield f"data: {json.dumps({'type': 'fact_check_result', 'comment': serialized}, default=str)}\n\n"

            yield "event: done\ndata: [DONE]\n\n"

        response = StreamingHttpResponse(generate(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        return response


class AICommentReplyView(APIView):
    def post(self, request):
        comment_id = request.data.get("comment_id")
        user_message = request.data.get("user_message")
        provider = request.data.get("provider")
        model = request.data.get("model")
        agent_id = request.data.get("agent_id")

        if not comment_id or not user_message:
            return Response(
                {"detail": "comment_id and user_message are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve agent config or use explicit provider/model
        agent = None
        if agent_id:
            from .models import Agent
            agent = Agent.objects.filter(id=agent_id).first()
            if not agent:
                return Response({"detail": "Agent not found"}, status=404)
            agent_config = agent.config or {}
            provider = agent_config.get("provider", provider)
            model = agent_config.get("model", model)

        if not provider or not model:
            return Response(
                {"detail": "provider and model are required (or provide agent_id)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        root_comment = Comment.objects.filter(id=comment_id, parent__isnull=True).first()
        if not root_comment:
            return Response({"detail": "Root comment not found"}, status=404)
        if not user_can_access_project(request.user, root_comment.node.project):
            return Response({"detail": "Root comment not found"}, status=404)
        require_project_role(request.user, root_comment.node.project, "commenter")

        provider_key = ProviderKey.objects.filter(provider=provider).first()
        api_key = provider_key.get_api_key() if provider_key else ""
        if not api_key:
            api_key = get_hardcoded_provider_key(provider)
        if not api_key:
            return Response({"detail": "Provider key missing"}, status=400)

        # Create user reply (skip if frontend already created it via @mention flow)
        skip_user_reply = request.data.get("skip_user_reply", False)

        if not skip_user_reply:
            user_reply = Comment.objects.create(
                node=root_comment.node,
                parent=root_comment,
                body=user_message,
                author_type=Comment.AuthorType.USER,
                author_label="",
            )

        # Build context from thread
        replies = list(root_comment.replies.order_by("created_at"))

        agent_system_prompt = ""
        if agent and agent.config and agent.config.get("system_prompt"):
            agent_system_prompt = agent.config["system_prompt"] + "\n\n"

        system_prompt = agent_system_prompt + (
            "You are a writing reviewer. A comment was made about this text:\n\n"
            f'"{root_comment.quoted_text}"\n\n'
            f"Original feedback: {root_comment.body}\n"
        )
        if root_comment.suggested_text:
            system_prompt += f"Current suggested replacement: {root_comment.suggested_text}\n"
        system_prompt += (
            "\nThe user has responded in the thread. "
            "IMPORTANT: Always respond in the same language as the quoted text above.\n\n"
            "You MUST use this EXACT format — no exceptions:\n\n"
            "<explanation>One short sentence explaining the change</explanation>\n"
            "<suggestion>The full replacement text in the same language</suggestion>\n\n"
            "Both tags are MANDATORY. Pick one best option only."
        )

        messages = [
            {"role": "system", "content": system_prompt},
        ]
        for r in replies:
            role = "user" if r.author_type == Comment.AuthorType.USER else "assistant"
            messages.append({"role": role, "content": r.body})

        from .llm import _sync_openai_compatible, _sync_anthropic, PROVIDERS

        config = PROVIDERS.get(provider)
        if not config:
            return Response({"detail": f"Unsupported provider: {provider}"}, status=400)

        try:
            if config["type"] == "anthropic":
                ai_response = _sync_anthropic(api_key, config["base_url"], model, messages)
            else:
                ai_response = _sync_openai_compatible(api_key, config["base_url"], model, messages)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)

        # Extract suggestion and explanation from AI response
        import re
        new_suggestion = None
        ai_body = ai_response

        # Try XML tags first: <suggestion>...</suggestion>
        suggestion_match = re.search(
            r"<suggestion>(.*?)</suggestion>", ai_response, re.DOTALL
        )
        explanation_match = re.search(
            r"<explanation>(.*?)</explanation>", ai_response, re.DOTALL
        )

        if suggestion_match:
            new_suggestion = suggestion_match.group(1).strip()
            # Use explanation tag content as body, fallback to stripping tags
            if explanation_match:
                ai_body = explanation_match.group(1).strip()
            else:
                ai_body = re.sub(
                    r"</?(?:suggestion|explanation)>", "", ai_response
                ).strip()
        else:
            # Fallback: SUGGESTION: prefix (case-insensitive)
            lines = ai_response.split("\n")
            clean_body_lines = []
            for line in lines:
                if re.match(r"^\s*suggestion\s*:", line, re.IGNORECASE):
                    new_suggestion = re.sub(
                        r"^\s*suggestion\s*:\s*", "", line, flags=re.IGNORECASE
                    ).strip()
                else:
                    clean_body_lines.append(line)
            ai_body = "\n".join(clean_body_lines).strip()

        # Create AI reply — store suggestion on the reply itself so the
        # frontend can render a diff for each alternative.
        ai_reply = Comment.objects.create(
            node=root_comment.node,
            parent=root_comment,
            body=ai_body,
            author_type=Comment.AuthorType.ASSISTANT,
            author_label=agent.name if agent else "Assistant",
            quoted_text=root_comment.quoted_text if new_suggestion else "",
            suggested_text=new_suggestion or "",
            agent=agent,
        )

        from .serializers import CommentReplySerializer

        return Response({
            "reply": CommentReplySerializer(ai_reply).data,
            "root_comment": CommentSerializer(root_comment).data,
        })
