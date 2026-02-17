import uuid

from django.db import models
from django.db.models import Q

from cryptography.fernet import InvalidToken

from .utils import decrypt_value, encrypt_value


class Workspace(models.Model):
    name = models.CharField(max_length=120, default="Default Workspace")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Project(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        LINK_VIEWABLE = "link_viewable", "Link Viewable"

    workspace = models.ForeignKey(
        Workspace, related_name="projects", on_delete=models.CASCADE
    )
    owner = models.ForeignKey(
        "auth.User", related_name="owned_projects", on_delete=models.CASCADE,
        null=True, blank=True,
    )
    name = models.CharField(max_length=200)
    project_type = models.CharField(max_length=50, blank=True, default="")
    project_extension = models.CharField(max_length=50, blank=True, default="")
    brief = models.TextField(blank=True, default="")
    auto_context = models.BooleanField(default=True)
    context_nodes = models.JSONField(default=list, blank=True)
    visibility = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    share_token = models.UUIDField(null=True, blank=True, unique=True)
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
    summary = models.TextField(blank=True, default="")
    summary_updated_at = models.DateTimeField(null=True, blank=True)
    context_nodes = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.title} ({self.type})"


class Version(models.Model):
    node = models.ForeignKey(Node, related_name="versions", on_delete=models.CASCADE)
    content_md = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Comment(models.Model):
    class AuthorType(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        RESOLVED = "resolved", "Resolved"

    node = models.ForeignKey(Node, related_name="comments", on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self", related_name="replies", null=True, blank=True, on_delete=models.CASCADE
    )
    body = models.TextField()
    author_label = models.CharField(max_length=120, blank=True, default="")
    author_type = models.CharField(
        max_length=20, choices=AuthorType.choices, default=AuthorType.USER
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN
    )
    suggested_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    quoted_text = models.TextField(blank=True, default="")
    position_from = models.IntegerField(null=True, blank=True)
    position_to = models.IntegerField(null=True, blank=True)


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
    agent = models.ForeignKey(
        "Agent", related_name="assignments", null=True, blank=True,
        on_delete=models.SET_NULL
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


class Agent(models.Model):
    name = models.CharField(max_length=200)
    project = models.ForeignKey(
        Project, related_name="agents", on_delete=models.CASCADE
    )
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("project", "name")]

    def __str__(self) -> str:
        return f"{self.name} ({self.project.name})"


class Conversation(models.Model):
    node = models.ForeignKey(Node, related_name="conversations", on_delete=models.CASCADE)
    title = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.title or f"Conversation {self.id}"


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


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
        try:
            return decrypt_value(self.api_key_encrypted)
        except (InvalidToken, Exception):
            return ""


class Memory(models.Model):
    USER = "user"
    PROJECT = "project"
    SCOPE_CHOICES = [(USER, "User"), (PROJECT, "Project")]

    user = models.ForeignKey(
        "auth.User", related_name="memories", on_delete=models.CASCADE
    )
    project = models.ForeignKey(
        Project, related_name="memories", null=True, blank=True, on_delete=models.CASCADE
    )
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES)
    content = models.TextField()
    source = models.CharField(max_length=20, default="manual")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(scope="user", project__isnull=True)
                    | Q(scope="project", project__isnull=False)
                ),
                name="memory_scope_valid",
            )
        ]

    def __str__(self):
        return f"[{self.scope}] {self.content[:60]}"


class PlatformConnection(models.Model):
    class Platform(models.TextChoices):
        MEDIUM = "medium", "Medium"
        LINKEDIN = "linkedin", "LinkedIn"
        TWITTER = "twitter", "Twitter/X"

    platform = models.CharField(max_length=20, choices=Platform.choices, unique=True)
    access_token_encrypted = models.TextField(blank=True, default="")
    refresh_token_encrypted = models.TextField(blank=True, default="")
    token_expires_at = models.DateTimeField(null=True, blank=True)
    platform_user_id = models.CharField(max_length=200, blank=True, default="")
    platform_username = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_access_token(self, token):
        self.access_token_encrypted = encrypt_value(token)

    def get_access_token(self):
        if not self.access_token_encrypted:
            return ""
        try:
            return decrypt_value(self.access_token_encrypted)
        except (InvalidToken, Exception):
            return ""

    def set_refresh_token(self, token):
        self.refresh_token_encrypted = encrypt_value(token)

    def get_refresh_token(self):
        if not self.refresh_token_encrypted:
            return ""
        try:
            return decrypt_value(self.refresh_token_encrypted)
        except (InvalidToken, Exception):
            return ""

    def __str__(self):
        return f"{self.get_platform_display()} ({self.platform_username})"


class PublishRecord(models.Model):
    platform_connection = models.ForeignKey(
        PlatformConnection, related_name="publish_records", on_delete=models.CASCADE
    )
    node = models.ForeignKey(
        Node, related_name="publish_records", null=True, blank=True, on_delete=models.SET_NULL
    )
    project = models.ForeignKey(
        Project, related_name="publish_records", null=True, blank=True, on_delete=models.SET_NULL
    )
    title = models.CharField(max_length=300, blank=True, default="")
    platform_post_id = models.CharField(max_length=200, blank=True, default="")
    platform_url = models.URLField(blank=True, default="")
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return f"{self.title} → {self.platform_connection.platform}"
