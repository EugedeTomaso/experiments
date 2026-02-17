from rest_framework import serializers
from .models import ProjectMembership


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ProjectMembership.Role.choices)


class InvitationListSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    invited_by_name = serializers.CharField(source="invited_by.first_name", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = [
            "id", "project", "project_name", "role",
            "invited_by", "invited_by_name", "created_at",
        ]
        read_only_fields = fields
