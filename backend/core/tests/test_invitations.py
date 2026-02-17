from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from core.models import Project, ProjectMembership, Workspace


class InviteTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.client = APIClient()

    def test_owner_can_invite(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/projects/{self.project.id}/invite/",
            {"email": "bob@test.com", "role": "editor"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ProjectMembership.objects.count(), 1)
        m = ProjectMembership.objects.first()
        self.assertEqual(m.invited_email, "bob@test.com")
        self.assertFalse(m.accepted)

    def test_viewer_cannot_invite(self):
        viewer = User.objects.create_user("carol", "carol@test.com", "pass1234")
        ProjectMembership.objects.create(
            project=self.project, user=viewer, role="viewer",
            invited_by=self.owner, invited_email="carol@test.com", accepted=True,
        )
        self.client.force_authenticate(viewer)
        response = self.client.post(
            f"/api/projects/{self.project.id}/invite/",
            {"email": "dave@test.com", "role": "viewer"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_invite_rejected(self):
        self.client.force_authenticate(self.owner)
        self.client.post(
            f"/api/projects/{self.project.id}/invite/",
            {"email": "bob@test.com", "role": "editor"},
            format="json",
        )
        response = self.client.post(
            f"/api/projects/{self.project.id}/invite/",
            {"email": "bob@test.com", "role": "viewer"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class AcceptDeclineTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.bob = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.membership = ProjectMembership.objects.create(
            project=self.project, role="editor",
            invited_by=self.owner, invited_email="bob@test.com",
        )
        self.client = APIClient()

    def test_accept_invitation(self):
        self.client.force_authenticate(self.bob)
        response = self.client.post(f"/api/invitations/{self.membership.id}/accept/")
        self.assertEqual(response.status_code, 200)
        self.membership.refresh_from_db()
        self.assertTrue(self.membership.accepted)
        self.assertEqual(self.membership.user, self.bob)

    def test_decline_invitation(self):
        self.client.force_authenticate(self.bob)
        response = self.client.post(f"/api/invitations/{self.membership.id}/decline/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ProjectMembership.objects.filter(id=self.membership.id).exists())

    def test_list_pending_invitations(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get("/api/invitations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["project_name"], "Proj")
