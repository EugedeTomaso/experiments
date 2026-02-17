from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from core.models import Project, ProjectMembership, Workspace


class MemberManagementTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.editor = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.membership = ProjectMembership.objects.create(
            project=self.project, user=self.editor, role="editor",
            invited_by=self.owner, invited_email="bob@test.com", accepted=True,
        )
        self.client = APIClient()

    def test_list_members(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/projects/{self.project.id}/members/")
        self.assertEqual(response.status_code, 200)
        # Owner + 1 member
        self.assertEqual(len(response.data), 2)

    def test_change_role(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f"/api/projects/{self.project.id}/members/{self.editor.id}/",
            {"role": "viewer"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.role, "viewer")

    def test_remove_member(self):
        self.client.force_authenticate(self.owner)
        response = self.client.delete(
            f"/api/projects/{self.project.id}/members/{self.editor.id}/"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ProjectMembership.objects.filter(id=self.membership.id).exists())

    def test_editor_cannot_manage_members(self):
        self.client.force_authenticate(self.editor)
        response = self.client.delete(
            f"/api/projects/{self.project.id}/members/{self.owner.id}/"
        )
        self.assertEqual(response.status_code, 403)
