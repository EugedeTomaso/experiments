from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory
from core.models import Project, ProjectMembership, Workspace
from core.permissions import HasProjectRole


class HasProjectRoleTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.workspace = Workspace.objects.create(name="Test")
        self.owner = User.objects.create_user("alice", "alice@test.com", "pass1234")
        self.editor = User.objects.create_user("bob", "bob@test.com", "pass1234")
        self.viewer = User.objects.create_user("carol", "carol@test.com", "pass1234")
        self.outsider = User.objects.create_user("dave", "dave@test.com", "pass1234")

        self.project = Project.objects.create(
            workspace=self.workspace, name="Proj", owner=self.owner
        )
        ProjectMembership.objects.create(
            project=self.project, user=self.editor, role="editor",
            invited_by=self.owner, invited_email="bob@test.com", accepted=True,
        )
        ProjectMembership.objects.create(
            project=self.project, user=self.viewer, role="viewer",
            invited_by=self.owner, invited_email="carol@test.com", accepted=True,
        )

    def _make_request(self, user):
        request = self.factory.get("/")
        request.user = user
        return request

    def test_owner_has_all_roles(self):
        perm = HasProjectRole("editor")
        request = self._make_request(self.owner)
        self.assertTrue(perm.has_object_permission(request, None, self.project))

    def test_editor_has_editor_role(self):
        perm = HasProjectRole("editor")
        request = self._make_request(self.editor)
        self.assertTrue(perm.has_object_permission(request, None, self.project))

    def test_viewer_lacks_editor_role(self):
        perm = HasProjectRole("editor")
        request = self._make_request(self.viewer)
        self.assertFalse(perm.has_object_permission(request, None, self.project))

    def test_outsider_denied(self):
        perm = HasProjectRole("viewer")
        request = self._make_request(self.outsider)
        self.assertFalse(perm.has_object_permission(request, None, self.project))
