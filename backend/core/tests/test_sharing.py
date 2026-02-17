import uuid
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from core.models import Project, Node, Workspace


class PublicShareTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner,
            visibility="link_viewable", share_token=uuid.uuid4(),
        )
        Node.objects.create(project=self.project, type="file", title="Doc", content_md="Hello")
        self.client = APIClient()

    def test_public_view_returns_project_and_nodes(self):
        response = self.client.get(f"/api/shared/{self.project.share_token}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["project"]["name"], "Proj")
        self.assertEqual(len(response.data["nodes"]), 1)

    def test_private_project_returns_404(self):
        self.project.visibility = "private"
        self.project.save()
        response = self.client.get(f"/api/shared/{self.project.share_token}/")
        self.assertEqual(response.status_code, 404)

    def test_invalid_token_returns_404(self):
        response = self.client.get(f"/api/shared/{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)

    def test_regenerate_share_token(self):
        old_token = self.project.share_token
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/projects/{self.project.id}/regenerate-share-token/")
        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertNotEqual(self.project.share_token, old_token)

    def test_enable_link_sharing(self):
        self.project.visibility = "private"
        self.project.share_token = None
        self.project.save()
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f"/api/projects/{self.project.id}/",
            {"visibility": "link_viewable"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.visibility, "link_viewable")
        self.assertIsNotNone(self.project.share_token)
