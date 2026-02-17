import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from core.models import Project, ProjectMembership, Workspace


class ProjectOwnershipTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.user = User.objects.create_user("alice", "alice@test.com", "pass1234")

    def test_project_has_owner(self):
        project = Project.objects.create(
            workspace=self.workspace, name="My Project", owner=self.user
        )
        self.assertEqual(project.owner, self.user)

    def test_project_visibility_default_private(self):
        project = Project.objects.create(
            workspace=self.workspace, name="My Project", owner=self.user
        )
        self.assertEqual(project.visibility, "private")

    def test_project_share_token_nullable(self):
        project = Project.objects.create(
            workspace=self.workspace, name="My Project", owner=self.user
        )
        self.assertIsNone(project.share_token)

    def test_project_share_token_unique(self):
        token = uuid.uuid4()
        Project.objects.create(
            workspace=self.workspace, name="P1", owner=self.user, share_token=token
        )
        with self.assertRaises(Exception):
            Project.objects.create(
                workspace=self.workspace, name="P2", owner=self.user, share_token=token
            )


class ProjectMembershipTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.member = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Shared", owner=self.owner
        )

    def test_create_membership(self):
        m = ProjectMembership.objects.create(
            project=self.project,
            user=self.member,
            role="editor",
            invited_by=self.owner,
            invited_email="bob@test.com",
            accepted=True,
        )
        self.assertEqual(m.role, "editor")
        self.assertTrue(m.accepted)

    def test_pending_invitation(self):
        m = ProjectMembership.objects.create(
            project=self.project,
            invited_by=self.owner,
            invited_email="new@test.com",
            role="viewer",
        )
        self.assertIsNone(m.user)
        self.assertFalse(m.accepted)

    def test_unique_project_user(self):
        ProjectMembership.objects.create(
            project=self.project, user=self.member, role="viewer",
            invited_by=self.owner, invited_email="bob@test.com", accepted=True,
        )
        with self.assertRaises(Exception):
            ProjectMembership.objects.create(
                project=self.project, user=self.member, role="editor",
                invited_by=self.owner, invited_email="bob@test.com", accepted=True,
            )

    def test_role_choices(self):
        for role in ["viewer", "commenter", "editor", "admin"]:
            m = ProjectMembership(
                project=self.project, role=role,
                invited_by=self.owner, invited_email=f"{role}@test.com",
            )
            m.full_clean()  # should not raise
