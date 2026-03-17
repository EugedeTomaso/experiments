from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Agent, AgentConfig, Comment, Conversation, Critique, CritiqueMessage,
    CritiqueThread, Memory, Message, Node,
    PlatformConnection, Project, ProviderKey, PublishRecord, Version, Workspace,
)
from .permissions import get_user_role

VERSION_INTERVAL = timedelta(minutes=10)
from .utils import get_default_workspace


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ["id", "name", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    current_user_role = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "name", "project_type", "project_extension", "brief",
            "auto_context", "context_nodes", "workspace", "owner",
            "visibility", "share_token", "published_snapshot", "published_at",
            "created_at", "updated_at",
            "current_user_role",
        ]
        read_only_fields = ["workspace", "owner", "share_token", "published_snapshot", "published_at", "created_at", "updated_at"]

    def get_current_user_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return get_user_role(request.user, obj)

    def create(self, validated_data):
        validated_data["workspace"] = get_default_workspace()
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = [
            "id",
            "project",
            "parent",
            "type",
            "title",
            "order",
            "content_md",
            "summary",
            "summary_updated_at",
            "context_nodes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "summary", "summary_updated_at"]

    def validate(self, attrs):
        project = attrs.get("project") or getattr(self.instance, "project", None)
        parent = attrs.get("parent") or getattr(self.instance, "parent", None)
        node_type = attrs.get("type") or getattr(self.instance, "type", None)

        if parent and project and parent.project_id != project.id:
            raise serializers.ValidationError("Parent must belong to the same project.")
        if parent and parent.type != Node.NodeType.FOLDER:
            raise serializers.ValidationError("Parent must be a folder.")

        if node_type == Node.NodeType.FOLDER and "content_md" in attrs:
            attrs["content_md"] = attrs.get("content_md") or ""

        return attrs

    def create(self, validated_data):
        node = super().create(validated_data)
        if node.type == Node.NodeType.FILE:
            Version.objects.create(node=node, content_md=node.content_md)
        return node

    def update(self, instance, validated_data):
        previous_content = instance.content_md
        node = super().update(instance, validated_data)
        if (
            node.type == Node.NodeType.FILE
            and "content_md" in validated_data
            and node.content_md != previous_content
        ):
            last_version = node.versions.order_by("-created_at").first()
            if not last_version or timezone.now() - last_version.created_at >= VERSION_INTERVAL:
                Version.objects.create(node=node, content_md=node.content_md)
        return node


class VersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Version
        fields = ["id", "node", "content_md", "created_at"]
        read_only_fields = ["created_at"]


class CommentReplySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True, default=None)
    agent_id = serializers.IntegerField(source="agent.id", read_only=True, default=None)

    class Meta:
        model = Comment
        fields = [
            "id", "parent", "body", "author_label", "author_type",
            "quoted_text", "suggested_text", "created_at",
            "agent_name", "agent_id",
        ]
        read_only_fields = ["created_at"]


class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()
    reply_count = serializers.IntegerField(read_only=True, default=0)
    agent_name = serializers.CharField(source="agent.name", read_only=True, default=None)
    agent_id = serializers.IntegerField(source="agent.id", read_only=True, default=None)

    class Meta:
        model = Comment
        fields = [
            "id",
            "node",
            "parent",
            "body",
            "author_label",
            "author_type",
            "status",
            "suggested_text",
            "created_at",
            "quoted_text",
            "position_from",
            "position_to",
            "comment_type",
            "verdict",
            "sources",
            "replies",
            "reply_count",
            "agent_name",
            "agent_id",
        ]
        read_only_fields = ["created_at"]

    def get_replies(self, obj):
        if obj.parent is not None:
            return []
        replies = obj.replies.order_by("created_at")
        return CommentReplySerializer(replies, many=True).data


class AgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agent
        fields = ["id", "name", "project", "config", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class AgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = [
            "id",
            "scope_type",
            "project",
            "node",
            "agent",
            "config",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        scope_type = attrs.get("scope_type") or getattr(self.instance, "scope_type", None)
        project = attrs.get("project") if "project" in attrs else getattr(self.instance, "project", None)
        node = attrs.get("node") if "node" in attrs else getattr(self.instance, "node", None)

        if scope_type == AgentConfig.ScopeType.PROJECT:
            if not project or node:
                raise serializers.ValidationError("Project scope requires project only.")
        else:
            if not node or project:
                raise serializers.ValidationError("Folder/file scope requires node only.")
            if node and node.type != scope_type:
                raise serializers.ValidationError(
                    "Scope type must match node type for folder/file scopes."
                )
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True, default=0)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "node",
            "title",
            "agent_mode",
            "message_count",
            "preview",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_preview(self, obj):
        prefetched = getattr(obj, "prefetched_messages", None)
        if prefetched is not None:
            last_msg = prefetched[0] if prefetched else None
        else:
            last_msg = obj.messages.order_by("-created_at").first()
        if not last_msg:
            return ""
        text = last_msg.content.replace("\n", " ").strip()
        return text[:120] if len(text) > 120 else text


class MessageSerializer(serializers.ModelSerializer):
    routed_agent_name = serializers.CharField(
        source="routed_agent.name", read_only=True, default=None
    )

    class Meta:
        model = Message
        fields = ["id", "conversation", "role", "content", "routed_agent", "routed_agent_name", "created_at"]
        read_only_fields = ["created_at", "routed_agent_name"]


class ProviderKeySerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_key = serializers.SerializerMethodField()

    class Meta:
        model = ProviderKey
        fields = [
            "id",
            "provider",
            "api_key",
            "has_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "has_key"]

    def get_has_key(self, obj):
        return bool(obj.api_key_encrypted)

    def create(self, validated_data):
        api_key = validated_data.pop("api_key", "")
        instance = ProviderKey(**validated_data)
        if api_key:
            instance.set_api_key(api_key)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop("api_key", None)
        instance = super().update(instance, validated_data)
        if api_key is not None:
            if api_key:
                instance.set_api_key(api_key)
            else:
                instance.api_key_encrypted = ""
            instance.save(update_fields=["api_key_encrypted", "updated_at"])
        return instance


class MemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Memory
        fields = [
            "id", "scope", "project", "content", "source",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_content(self, value):
        if len(value) > 200:
            raise serializers.ValidationError("Memory content must be 200 characters or fewer.")
        return value

    def validate(self, attrs):
        scope = attrs.get("scope") or getattr(self.instance, "scope", None)
        project = attrs.get("project") if "project" in attrs else getattr(self.instance, "project", None)

        if scope == Memory.USER and project:
            raise serializers.ValidationError("User-scope memories must not have a project.")
        if scope == Memory.PROJECT and not project:
            raise serializers.ValidationError("Project-scope memories require a project.")
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class PlatformConnectionSerializer(serializers.ModelSerializer):
    platform_label = serializers.CharField(source="get_platform_display", read_only=True)

    class Meta:
        model = PlatformConnection
        fields = [
            "id",
            "platform",
            "platform_label",
            "platform_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublishRecordSerializer(serializers.ModelSerializer):
    platform = serializers.CharField(source="platform_connection.platform", read_only=True)
    platform_label = serializers.CharField(
        source="platform_connection.get_platform_display", read_only=True
    )

    class Meta:
        model = PublishRecord
        fields = [
            "id",
            "platform",
            "platform_label",
            "title",
            "platform_url",
            "published_at",
        ]
        read_only_fields = fields


class CritiqueMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CritiqueMessage
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = ["created_at"]


class CritiqueThreadSerializer(serializers.ModelSerializer):
    messages = CritiqueMessageSerializer(many=True, read_only=True)

    class Meta:
        model = CritiqueThread
        fields = ["id", "critique", "section_id", "messages", "created_at"]
        read_only_fields = ["created_at"]


class CritiqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Critique
        fields = ["id", "node", "sections", "overall_score", "summary", "created_at"]
        read_only_fields = ["created_at"]
