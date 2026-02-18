import base64
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from core.models import Node, Project, ProjectMembership, Workspace, YjsState


@override_settings(INTERNAL_API_KEY="test-secret-key")
class InternalNodeAccessTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.editor = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.outsider = User.objects.create_user("carol", "carol@test.com", "pass1234")

        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc", content_md="# Hello"
        )
        ProjectMembership.objects.create(
            project=self.project, user=self.editor, role="editor",
            invited_by=self.owner, invited_email="bob@test.com", accepted=True,
        )
        self.client = APIClient()
        self.headers = {"HTTP_X_INTERNAL_KEY": "test-secret-key"}

    def test_no_key_returns_403(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.owner.id}"
        )
        self.assertEqual(response.status_code, 403)

    def test_owner_access(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.owner.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["allowed"])
        self.assertEqual(response.data["role"], "owner")

    def test_editor_access(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.editor.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["allowed"])
        self.assertEqual(response.data["role"], "editor")

    def test_outsider_denied(self):
        response = self.client.get(
            f"/api/internal/node-access/{self.node.id}/?user_id={self.outsider.id}",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["allowed"])


@override_settings(INTERNAL_API_KEY="test-secret-key")
class InternalYjsStateTest(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc", content_md="# Hello"
        )
        self.client = APIClient()
        self.headers = {"HTTP_X_INTERNAL_KEY": "test-secret-key"}

    def test_get_yjs_state_not_found(self):
        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/yjs-state/", **self.headers
        )
        self.assertEqual(response.status_code, 404)

    def test_save_and_get_yjs_state(self):
        state_b64 = base64.b64encode(b"\x01\x02\x03").decode()
        response = self.client.patch(
            f"/api/internal/nodes/{self.node.id}/yjs-state/",
            {"state": state_b64},
            format="json",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/yjs-state/", **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["state"], state_b64)

    def test_update_content(self):
        response = self.client.patch(
            f"/api/internal/nodes/{self.node.id}/content/",
            {"content_md": "# Updated"},
            format="json",
            **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.node.refresh_from_db()
        self.assertEqual(self.node.content_md, "# Updated")

    def test_get_node_content(self):
        response = self.client.get(
            f"/api/internal/nodes/{self.node.id}/", **self.headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["content_md"], "# Hello")
