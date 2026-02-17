from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient
from core.models import Project, ProjectMembership, Node, Workspace


class ProjectViewSetAccessTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.alice = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.bob = User.objects.create_user("bob", "bob@test.com", "pass1234")

        self.alice_project = Project.objects.create(
            workspace=self.workspace, name="Alice's", owner=self.alice
        )
        self.bob_project = Project.objects.create(
            workspace=self.workspace, name="Bob's", owner=self.bob
        )

        # Bob is editor on Alice's project
        ProjectMembership.objects.create(
            project=self.alice_project, user=self.bob, role="editor",
            invited_by=self.alice, invited_email="bob@test.com", accepted=True,
        )

        self.client = APIClient()

    def test_alice_sees_only_her_projects(self):
        self.client.force_authenticate(self.alice)
        response = self.client.get("/api/projects/")
        names = [p["name"] for p in response.data]
        self.assertIn("Alice's", names)
        self.assertNotIn("Bob's", names)

    def test_bob_sees_own_and_shared(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get("/api/projects/")
        names = [p["name"] for p in response.data]
        self.assertIn("Bob's", names)
        self.assertIn("Alice's", names)

    def test_create_project_sets_owner(self):
        self.client.force_authenticate(self.alice)
        response = self.client.post("/api/projects/", {"name": "New"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["owner"], self.alice.id)

    def test_outsider_cannot_read_project(self):
        carol = User.objects.create_user("carol", "carol@test.com", "pass1234")
        self.client.force_authenticate(carol)
        response = self.client.get(f"/api/projects/{self.alice_project.id}/")
        self.assertEqual(response.status_code, 404)


class NodeViewSetAccessTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.alice = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.bob = User.objects.create_user("bob", "bob@test.com", "pass1234")

        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.alice
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc"
        )
        self.client = APIClient()

    def test_owner_sees_nodes(self):
        self.client.force_authenticate(self.alice)
        response = self.client.get(f"/api/nodes/?project={self.project.id}")
        self.assertEqual(len(response.data), 1)

    def test_outsider_sees_no_nodes(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get(f"/api/nodes/?project={self.project.id}")
        self.assertEqual(len(response.data), 0)
