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


class ProjectSerializerRoleTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.alice = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.bob = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.alice
        )
        ProjectMembership.objects.create(
            project=self.project, user=self.bob, role="editor",
            invited_by=self.alice, invited_email="bob@test.com", accepted=True,
        )
        self.client = APIClient()

    def test_owner_sees_owner_role(self):
        self.client.force_authenticate(self.alice)
        response = self.client.get(f"/api/projects/{self.project.id}/")
        self.assertEqual(response.data["current_user_role"], "owner")

    def test_member_sees_their_role(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get(f"/api/projects/{self.project.id}/")
        self.assertEqual(response.data["current_user_role"], "editor")


class CommenterPermissionRegressionTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("owner", "owner@test.com", "pass1234")
        self.commenter = User.objects.create_user(
            "commenter", "commenter@test.com", "pass1234"
        )
        self.outsider = User.objects.create_user(
            "outsider", "outsider@test.com", "pass1234"
        )

        self.project = Project.objects.create(
            workspace=self.workspace, name="Shared Novel", owner=self.owner
        )
        self.other_project = Project.objects.create(
            workspace=self.workspace, name="Secret Novel", owner=self.owner
        )

        ProjectMembership.objects.create(
            project=self.project,
            user=self.commenter,
            role="commenter",
            invited_by=self.owner,
            invited_email="commenter@test.com",
            accepted=True,
        )

        self.node = Node.objects.create(
            project=self.project,
            type="file",
            title="Chapter 1",
            content_md="Original paragraph.",
        )
        self.other_node = Node.objects.create(
            project=self.other_project,
            type="file",
            title="Private chapter",
            content_md="Hidden paragraph.",
        )
        self.comment = self.node.comments.create(
            body="Try tightening this sentence.",
            author_label="Assistant",
            author_type="assistant",
            quoted_text="Original paragraph.",
            suggested_text="Tighter paragraph.",
            position_from=0,
            position_to=18,
            comment_type="review",
        )
        self.other_comment = self.other_node.comments.create(
            body="Secret feedback",
            author_label="Assistant",
            author_type="assistant",
            quoted_text="Hidden paragraph.",
            suggested_text="Hidden revision.",
            position_from=0,
            position_to=16,
            comment_type="review",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.commenter)

    def test_commenter_cannot_update_node_content(self):
        response = self.client.patch(
            f"/api/nodes/{self.node.id}/",
            {"content_md": "Reviewer edit"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.node.refresh_from_db()
        self.assertEqual(self.node.content_md, "Original paragraph.")

    def test_commenter_cannot_create_nodes(self):
        response = self.client.post(
            "/api/nodes/",
            {
                "project": self.project.id,
                "type": "file",
                "title": "Reviewer draft",
                "content_md": "Should not be created.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Node.objects.filter(project=self.project, title="Reviewer draft").exists()
        )

    def test_commenter_can_create_and_update_comments(self):
        create_response = self.client.post(
            "/api/comments/",
            {
                "node": self.node.id,
                "body": "Please clarify the emotional turn.",
                "quoted_text": "Original paragraph.",
                "comment_type": "comment",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)

        update_response = self.client.patch(
            f"/api/comments/{create_response.data['id']}/",
            {"body": "Please clarify the emotional shift."},
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data["body"], "Please clarify the emotional shift.")

    def test_commenter_can_reject_and_resolve_comments(self):
        reject_response = self.client.post(
            f"/api/comments/{self.comment.id}/reject/",
            format="json",
        )
        self.assertEqual(reject_response.status_code, 200)
        self.assertEqual(reject_response.data["status"], "rejected")

        self.comment.refresh_from_db()
        self.comment.status = "open"
        self.comment.save(update_fields=["status"])

        resolve_response = self.client.post(
            f"/api/comments/{self.comment.id}/resolve/",
            format="json",
        )
        self.assertEqual(resolve_response.status_code, 200)
        self.assertEqual(resolve_response.data["status"], "resolved")

    def test_commenter_cannot_approve_comments(self):
        response = self.client.post(
            f"/api/comments/{self.comment.id}/approve/",
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.status, "open")

    def test_commenter_cannot_access_comments_from_other_projects(self):
        list_response = self.client.get(f"/api/comments/?node={self.other_node.id}&root_only=true")
        detail_response = self.client.get(f"/api/comments/{self.other_comment.id}/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])
        self.assertEqual(detail_response.status_code, 404)
