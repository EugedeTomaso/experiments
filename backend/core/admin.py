from django.contrib import admin

from .models import AgentConfig, Comment, Node, Project, ProviderKey, Version, Workspace

admin.site.register(Workspace)
admin.site.register(Project)
admin.site.register(Node)
admin.site.register(Version)
admin.site.register(Comment)
admin.site.register(AgentConfig)
admin.site.register(ProviderKey)
