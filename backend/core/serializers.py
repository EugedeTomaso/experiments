from rest_framework import serializers

from .models import AgentConfig, Comment, Node, Project, ProviderKey, Version, Workspace
from .utils import get_default_workspace


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ["id", "name", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name", "workspace", "created_at", "updated_at"]
        read_only_fields = ["workspace", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["workspace"] = get_default_workspace()
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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

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
            Version.objects.create(node=node, content_md=node.content_md)
        return node


class VersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Version
        fields = ["id", "node", "content_md", "created_at"]
        read_only_fields = ["created_at"]


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["id", "node", "body", "author_label", "created_at"]
        read_only_fields = ["created_at"]


class AgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = [
            "id",
            "scope_type",
            "project",
            "node",
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
