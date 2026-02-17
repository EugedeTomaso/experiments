from rest_framework.permissions import BasePermission

from .models import ProjectMembership


class HasProjectRole(BasePermission):
    """
    Check that the requesting user has at least the given role on the project.
    Works with Project instances directly and with objects that have a .project FK.
    Owner always passes.
    """

    def __init__(self, required_role="viewer"):
        self.required_role = required_role

    def has_object_permission(self, request, view, obj):
        # Resolve the project — obj is either a Project or has a .project FK
        project = obj if hasattr(obj, "owner") else getattr(obj, "project", None)
        if project is None:
            return False

        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Owner has all permissions
        if project.owner_id == user.id:
            return True

        # Check membership
        membership = ProjectMembership.objects.filter(
            project=project, user=user, accepted=True
        ).first()
        if not membership:
            return False

        return membership.has_role(self.required_role)


def get_user_role(user, project):
    """Return the role string for a user on a project, or None."""
    if project.owner_id == user.id:
        return "owner"
    membership = ProjectMembership.objects.filter(
        project=project, user=user, accepted=True
    ).first()
    return membership.role if membership else None


def user_can_access_project(user, project):
    """Return True if user is owner or accepted member."""
    if project.owner_id == user.id:
        return True
    return ProjectMembership.objects.filter(
        project=project, user=user, accepted=True
    ).exists()
