from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .invitation_serializers import InvitationListSerializer, InviteSerializer
from .models import Project, ProjectMembership
from .permissions import get_user_role


class InviteView(APIView):
    """POST /api/projects/{id}/invite/ — Admin/Owner invites a user by email."""

    def post(self, request, project_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(request.user, project)
        if role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        invited_role = serializer.validated_data["role"]

        # Check duplicate pending invite
        if ProjectMembership.objects.filter(
            project=project, invited_email=email, accepted=False
        ).exists():
            return Response(
                {"detail": "Invitation already pending for this email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if already a member
        from django.contrib.auth.models import User
        existing_user = User.objects.filter(email=email).first()
        if existing_user and ProjectMembership.objects.filter(
            project=project, user=existing_user, accepted=True
        ).exists():
            return Response(
                {"detail": "User is already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = ProjectMembership.objects.create(
            project=project,
            user=existing_user,  # may be None if no account yet
            role=invited_role,
            invited_by=request.user,
            invited_email=email,
        )

        return Response(
            InvitationListSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class InvitationListView(ListAPIView):
    """GET /api/invitations/ — List pending invitations for the current user."""
    serializer_class = InvitationListSerializer

    def get_queryset(self):
        return ProjectMembership.objects.filter(
            invited_email=self.request.user.email,
            accepted=False,
        ).select_related("project", "invited_by")


class AcceptInvitationView(APIView):
    """POST /api/invitations/{id}/accept/"""

    def post(self, request, pk):
        membership = ProjectMembership.objects.filter(
            id=pk, invited_email=request.user.email, accepted=False
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.user = request.user
        membership.accepted = True
        membership.save()
        return Response(InvitationListSerializer(membership).data)


class DeclineInvitationView(APIView):
    """POST /api/invitations/{id}/decline/"""

    def post(self, request, pk):
        membership = ProjectMembership.objects.filter(
            id=pk, invited_email=request.user.email, accepted=False
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
