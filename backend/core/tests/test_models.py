import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from core.models import Project, Workspace


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
