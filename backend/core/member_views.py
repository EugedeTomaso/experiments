from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, ProjectMembership
from .permissions import get_user_role


class MemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source="id")
    email = serializers.EmailField()
    name = serializers.CharField(source="first_name")
    role = serializers.CharField()


class MemberListView(APIView):
    """GET /api/projects/{id}/members/ — list owner + accepted members."""

    def get(self, request, project_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(request.user, project)
        if role is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        members = []
        # Owner first
        members.append({
            "id": project.owner.id,
            "email": project.owner.email,
            "first_name": project.owner.first_name,
            "role": "owner",
        })
        # Accepted members
        for m in project.memberships.filter(accepted=True).select_related("user"):
            members.append({
                "id": m.user.id,
                "email": m.user.email,
                "first_name": m.user.first_name,
                "role": m.role,
            })

        return Response(MemberSerializer(members, many=True).data)


class MemberDetailView(APIView):
    """PATCH/DELETE /api/projects/{id}/members/{user_id}/"""

    def patch(self, request, project_id, user_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        caller_role = get_user_role(request.user, project)
        if caller_role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        membership = ProjectMembership.objects.filter(
            project=project, user_id=user_id, accepted=True
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        new_role = request.data.get("role")
        if new_role not in dict(ProjectMembership.Role.choices):
            return Response(
                {"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST
            )

        membership.role = new_role
        membership.save()
        return Response({"user_id": user_id, "role": new_role})

    def delete(self, request, project_id, user_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        caller_role = get_user_role(request.user, project)
        if caller_role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Cannot remove the owner
        if project.owner_id == user_id:
            return Response(
                {"detail": "Cannot remove the project owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = ProjectMembership.objects.filter(
            project=project, user_id=user_id, accepted=True
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
