from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from core.models import Node, Project, Workspace, YjsState


class YjsStateTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.workspace = Workspace.objects.create(name="Test")
        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.user
        )
        self.node = Node.objects.create(
            project=self.project, type="file", title="Doc"
        )

    def test_create_yjs_state(self):
        state_bytes = b"\x01\x02\x03\x04"
        yjs = YjsState.objects.create(node=self.node, state=state_bytes)
        yjs.refresh_from_db()
        self.assertEqual(bytes(yjs.state), state_bytes)

    def test_one_to_one_constraint(self):
        YjsState.objects.create(node=self.node, state=b"\x01")
        with self.assertRaises(IntegrityError):
            YjsState.objects.create(node=self.node, state=b"\x02")

    def test_cascade_delete_with_node(self):
        YjsState.objects.create(node=self.node, state=b"\x01")
        self.node.delete()
        self.assertEqual(YjsState.objects.count(), 0)

    def test_update_state(self):
        yjs = YjsState.objects.create(node=self.node, state=b"\x01")
        yjs.state = b"\x05\x06"
        yjs.save()
        yjs.refresh_from_db()
        self.assertEqual(bytes(yjs.state), b"\x05\x06")
