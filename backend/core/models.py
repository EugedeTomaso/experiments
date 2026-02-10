from django.db import models
from django.db.models import Q

from .utils import decrypt_value, encrypt_value


class Workspace(models.Model):
    name = models.CharField(max_length=120, default="Default Workspace")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Project(models.Model):
    workspace = models.ForeignKey(
        Workspace, related_name="projects", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class Node(models.Model):
    class NodeType(models.TextChoices):
        FOLDER = "folder", "Folder"
        FILE = "file", "File"

    project = models.ForeignKey(Project, related_name="nodes", on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self", related_name="children", null=True, blank=True, on_delete=models.CASCADE
    )
    type = models.CharField(max_length=20, choices=NodeType.choices)
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=0)
    content_md = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.title} ({self.type})"


class Version(models.Model):
    node = models.ForeignKey(Node, related_name="versions", on_delete=models.CASCADE)
    content_md = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Comment(models.Model):
    node = models.ForeignKey(Node, related_name="comments", on_delete=models.CASCADE)
    body = models.TextField()
    author_label = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class AgentConfig(models.Model):
    class ScopeType(models.TextChoices):
        PROJECT = "project", "Project"
        FOLDER = "folder", "Folder"
        FILE = "file", "File"

    scope_type = models.CharField(max_length=20, choices=ScopeType.choices)
    project = models.ForeignKey(
        Project, related_name="agent_configs", null=True, blank=True, on_delete=models.CASCADE
    )
    node = models.ForeignKey(
        Node, related_name="agent_configs", null=True, blank=True, on_delete=models.CASCADE
    )
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(scope_type="project", project__isnull=False, node__isnull=True)
                    | Q(
                        scope_type__in=["folder", "file"],
                        project__isnull=True,
                        node__isnull=False,
                    )
                ),
                name="agentconfig_scope_valid",
            )
        ]


class ProviderKey(models.Model):
    class Provider(models.TextChoices):
        OPENAI = "openai", "OpenAI"
        ANTHROPIC = "anthropic", "Anthropic"
        OPENROUTER = "openrouter", "OpenRouter"
        DEEPSEEK = "deepseek", "DeepSeek"
        CEREBRAS = "cerebras", "Cerebras"
        GROQ = "groq", "Groq"

    provider = models.CharField(
        max_length=50, choices=Provider.choices, unique=True
    )
    api_key_encrypted = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_api_key(self, api_key: str) -> None:
        self.api_key_encrypted = encrypt_value(api_key)

    def get_api_key(self) -> str:
        if not self.api_key_encrypted:
            return ""
        return decrypt_value(self.api_key_encrypted)
