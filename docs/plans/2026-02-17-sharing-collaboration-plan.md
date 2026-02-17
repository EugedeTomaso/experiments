# Sharing & Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project sharing with role-based permissions, email invitations, public links, and real-time collaborative editing via Yjs.

**Architecture:** Django REST handles ownership, permissions, invitations, and metadata. A separate Node.js y-websocket server handles real-time document sync. Milkdown integrates via y-prosemirror for cursors, presence, and collaborative undo.

**Tech Stack:** Django 5.2, DRF, SimpleJWT, Yjs, y-websocket, y-prosemirror, React 18.2, Milkdown 7.6.3

**Design doc:** `docs/plans/2026-02-17-sharing-collaboration-design.md`

---

## Phase 1: Ownership & Permissions

### Task 1: Add owner and visibility fields to Project model

**Files:**
- Modify: `backend/core/models.py:17-31`
- Create: `backend/core/migrations/0012_project_ownership.py` (auto-generated)
- Test: `backend/core/tests/test_models.py`

**Step 1: Write the failing test**

Create `backend/core/tests/__init__.py` (empty) and `backend/core/tests/test_models.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_models -v2`
Expected: FAIL — `owner` field does not exist on Project.

**Step 3: Update the Project model**

In `backend/core/models.py`, add imports and fields to the Project model:

```python
import uuid  # add at top

class Project(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        LINK_VIEWABLE = "link_viewable", "Link Viewable"

    workspace = models.ForeignKey(
        Workspace, related_name="projects", on_delete=models.CASCADE
    )
    owner = models.ForeignKey(
        "auth.User", related_name="owned_projects", on_delete=models.CASCADE,
        null=True, blank=True,  # nullable for migration, will be required after backfill
    )
    name = models.CharField(max_length=200)
    project_type = models.CharField(max_length=50, blank=True, default="")
    project_extension = models.CharField(max_length=50, blank=True, default="")
    brief = models.TextField(blank=True, default="")
    auto_context = models.BooleanField(default=True)
    context_nodes = models.JSONField(default=list, blank=True)
    visibility = models.CharField(
        max_length=20, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    share_token = models.UUIDField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name
```

**Step 4: Generate and run migration**

Run: `docker exec experiments-backend-1 python manage.py makemigrations core --name project_ownership`
Then: `docker exec experiments-backend-1 python manage.py migrate`

**Step 5: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_models -v2`
Expected: 4 tests PASS.

**Step 6: Commit**

```bash
git add backend/core/models.py backend/core/migrations/0012_*.py backend/core/tests/
git commit -m "feat: add owner, visibility, share_token to Project model"
```

---

### Task 2: Create ProjectMembership model

**Files:**
- Modify: `backend/core/models.py` (add after Project model)
- Create: `backend/core/migrations/0013_projectmembership.py` (auto-generated)
- Test: `backend/core/tests/test_models.py`

**Step 1: Write the failing test**

Append to `backend/core/tests/test_models.py`:

```python
from core.models import ProjectMembership


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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_models -v2`
Expected: ImportError — `ProjectMembership` does not exist.

**Step 3: Add the ProjectMembership model**

In `backend/core/models.py`, add after the Project class:

```python
class ProjectMembership(models.Model):
    class Role(models.TextChoices):
        VIEWER = "viewer", "Viewer"
        COMMENTER = "commenter", "Commenter"
        EDITOR = "editor", "Editor"
        ADMIN = "admin", "Admin"

    ROLE_HIERARCHY = {
        "viewer": 0,
        "commenter": 1,
        "editor": 2,
        "admin": 3,
    }

    project = models.ForeignKey(
        Project, related_name="memberships", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        "auth.User", related_name="project_memberships",
        null=True, blank=True, on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    invited_by = models.ForeignKey(
        "auth.User", related_name="sent_invitations", on_delete=models.CASCADE
    )
    invited_email = models.EmailField()
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("project", "user")]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "invited_email"],
                condition=Q(accepted=False),
                name="unique_pending_invitation",
            )
        ]

    def has_role(self, required_role):
        return self.ROLE_HIERARCHY.get(self.role, -1) >= self.ROLE_HIERARCHY.get(required_role, 99)

    def __str__(self):
        label = self.user.email if self.user else self.invited_email
        return f"{label} – {self.role} on {self.project.name}"
```

**Step 4: Generate and run migration**

Run: `docker exec experiments-backend-1 python manage.py makemigrations core --name projectmembership`
Then: `docker exec experiments-backend-1 python manage.py migrate`

**Step 5: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_models -v2`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add backend/core/models.py backend/core/migrations/0013_*.py backend/core/tests/test_models.py
git commit -m "feat: add ProjectMembership model with role hierarchy"
```

---

### Task 3: Data migration — assign owner to existing projects

**Files:**
- Create: `backend/core/migrations/0014_backfill_project_owners.py`

**Step 1: Write the data migration**

```python
from django.db import migrations


def backfill_owners(apps, schema_editor):
    """Assign the first superuser (or first user) as owner of all ownerless projects."""
    User = apps.get_model("auth", "User")
    Project = apps.get_model("core", "Project")

    ownerless = Project.objects.filter(owner__isnull=True)
    if not ownerless.exists():
        return

    default_owner = (
        User.objects.filter(is_superuser=True).order_by("id").first()
        or User.objects.order_by("id").first()
    )
    if default_owner:
        ownerless.update(owner=default_owner)


def reverse(apps, schema_editor):
    pass  # no-op reverse


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_projectmembership"),
    ]

    operations = [
        migrations.RunPython(backfill_owners, reverse),
    ]
```

**Step 2: Run the migration**

Run: `docker exec experiments-backend-1 python manage.py migrate`

**Step 3: Verify**

Run: `docker exec experiments-backend-1 python manage.py shell -c "from core.models import Project; print(Project.objects.filter(owner__isnull=True).count())"`
Expected: `0`

**Step 4: Commit**

```bash
git add backend/core/migrations/0014_*.py
git commit -m "feat: backfill owners for existing projects"
```

---

### Task 4: Create permission classes

**Files:**
- Create: `backend/core/permissions.py`
- Test: `backend/core/tests/test_permissions.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_permissions.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_permissions -v2`
Expected: ImportError — `core.permissions` does not exist.

**Step 3: Create permissions module**

Create `backend/core/permissions.py`:

```python
from rest_framework.permissions import BasePermission

from .models import ProjectMembership


class HasProjectRole(BasePermission):
    """
    Check that the requesting user has at least the given role on the project.
    Works with Project instances directly and with objects that have a .project FK.
    Owner always passes.
    """

    def __init__(self, required_role="viewer"):
        self.required_role = required_role

    def has_object_permission(self, request, view, obj):
        # Resolve the project — obj is either a Project or has a .project FK
        project = obj if hasattr(obj, "owner") else getattr(obj, "project", None)
        if project is None:
            return False

        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Owner has all permissions
        if project.owner_id == user.id:
            return True

        # Check membership
        membership = ProjectMembership.objects.filter(
            project=project, user=user, accepted=True
        ).first()
        if not membership:
            return False

        return membership.has_role(self.required_role)


def get_user_role(user, project):
    """Return the role string for a user on a project, or None."""
    if project.owner_id == user.id:
        return "owner"
    membership = ProjectMembership.objects.filter(
        project=project, user=user, accepted=True
    ).first()
    return membership.role if membership else None


def user_can_access_project(user, project):
    """Return True if user is owner or accepted member."""
    if project.owner_id == user.id:
        return True
    return ProjectMembership.objects.filter(
        project=project, user=user, accepted=True
    ).exists()
```

**Step 4: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_permissions -v2`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add backend/core/permissions.py backend/core/tests/test_permissions.py
git commit -m "feat: add HasProjectRole permission class and helpers"
```

---

### Task 5: Filter viewsets by ownership/membership

**Files:**
- Modify: `backend/core/views.py:35-37` (ProjectViewSet)
- Modify: `backend/core/views.py:40-51` (NodeViewSet)
- Modify: `backend/core/serializers.py:21-29` (ProjectSerializer)
- Test: `backend/core/tests/test_views.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_views.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_views -v2`
Expected: `test_alice_sees_only_her_projects` FAILS (Alice sees Bob's project too), `test_outsider_cannot_read_project` FAILS (returns 200).

**Step 3: Update viewsets and serializer**

In `backend/core/views.py`, update `ProjectViewSet`:

```python
from django.db.models import Q
from .permissions import user_can_access_project

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        user = self.request.user
        return Project.objects.filter(
            Q(owner=user) | Q(memberships__user=user, memberships__accepted=True)
        ).distinct().order_by("created_at")
```

In `backend/core/serializers.py`, update `ProjectSerializer.create()` to set owner:

```python
class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id", "name", "project_type", "project_extension", "brief",
            "auto_context", "context_nodes", "workspace", "owner",
            "visibility", "share_token", "created_at", "updated_at",
        ]
        read_only_fields = ["workspace", "owner", "share_token", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["workspace"] = get_default_workspace()
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
```

In `backend/core/views.py`, update `NodeViewSet.get_queryset()` to filter by accessible projects:

```python
class NodeViewSet(viewsets.ModelViewSet):
    serializer_class = NodeSerializer

    def get_queryset(self):
        user = self.request.user
        accessible_projects = Project.objects.filter(
            Q(owner=user) | Q(memberships__user=user, memberships__accepted=True)
        )
        queryset = Node.objects.filter(
            project__in=accessible_projects
        ).order_by("order", "created_at")

        project_id = self.request.query_params.get("project")
        parent_id = self.request.query_params.get("parent")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if parent_id is not None:
            queryset = queryset.filter(parent_id=parent_id)
        return queryset
```

**Step 4: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_views -v2`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add backend/core/views.py backend/core/serializers.py backend/core/tests/test_views.py
git commit -m "feat: filter projects and nodes by ownership/membership"
```

---

### Task 6: Add role field to project list API response

**Files:**
- Modify: `backend/core/serializers.py` (ProjectSerializer)
- Test: `backend/core/tests/test_views.py`

**Step 1: Write the failing test**

Append to `backend/core/tests/test_views.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_views.ProjectSerializerRoleTest -v2`
Expected: KeyError — `current_user_role` not in response.

**Step 3: Add current_user_role to serializer**

In `backend/core/serializers.py`, add a `SerializerMethodField`:

```python
from .permissions import get_user_role

class ProjectSerializer(serializers.ModelSerializer):
    current_user_role = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "name", "project_type", "project_extension", "brief",
            "auto_context", "context_nodes", "workspace", "owner",
            "visibility", "share_token", "created_at", "updated_at",
            "current_user_role",
        ]
        read_only_fields = ["workspace", "owner", "share_token", "created_at", "updated_at"]

    def get_current_user_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return get_user_role(request.user, obj)

    def create(self, validated_data):
        validated_data["workspace"] = get_default_workspace()
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
```

**Step 4: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_views -v2`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add backend/core/serializers.py backend/core/tests/test_views.py
git commit -m "feat: include current_user_role in project API response"
```

---

## Phase 2: Invitations & Sharing

### Task 7: Invitation API — invite, accept, decline

**Files:**
- Create: `backend/core/invitation_views.py`
- Create: `backend/core/invitation_serializers.py`
- Modify: `backend/core/urls.py`
- Test: `backend/core/tests/test_invitations.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_invitations.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_invitations -v2`
Expected: 404 — URL routes don't exist yet.

**Step 3: Create invitation serializers**

Create `backend/core/invitation_serializers.py`:

```python
from rest_framework import serializers
from .models import ProjectMembership


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ProjectMembership.Role.choices)


class InvitationListSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    invited_by_name = serializers.CharField(source="invited_by.first_name", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = [
            "id", "project", "project_name", "role",
            "invited_by", "invited_by_name", "created_at",
        ]
        read_only_fields = fields
```

**Step 4: Create invitation views**

Create `backend/core/invitation_views.py`:

```python
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .invitation_serializers import InvitationListSerializer, InviteSerializer
from .models import Project, ProjectMembership
from .permissions import get_user_role


class InviteView(APIView):
    """POST /api/projects/{id}/invite/ — Admin/Owner invites a user by email."""

    def post(self, request, project_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(request.user, project)
        if role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        invited_role = serializer.validated_data["role"]

        # Check duplicate pending invite
        if ProjectMembership.objects.filter(
            project=project, invited_email=email, accepted=False
        ).exists():
            return Response(
                {"detail": "Invitation already pending for this email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if already a member
        from django.contrib.auth.models import User
        existing_user = User.objects.filter(email=email).first()
        if existing_user and ProjectMembership.objects.filter(
            project=project, user=existing_user, accepted=True
        ).exists():
            return Response(
                {"detail": "User is already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = ProjectMembership.objects.create(
            project=project,
            user=existing_user,  # may be None if no account yet
            role=invited_role,
            invited_by=request.user,
            invited_email=email,
        )

        return Response(
            InvitationListSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class InvitationListView(ListAPIView):
    """GET /api/invitations/ — List pending invitations for the current user."""
    serializer_class = InvitationListSerializer

    def get_queryset(self):
        return ProjectMembership.objects.filter(
            invited_email=self.request.user.email,
            accepted=False,
        ).select_related("project", "invited_by")


class AcceptInvitationView(APIView):
    """POST /api/invitations/{id}/accept/"""

    def post(self, request, pk):
        membership = ProjectMembership.objects.filter(
            id=pk, invited_email=request.user.email, accepted=False
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.user = request.user
        membership.accepted = True
        membership.save()
        return Response(InvitationListSerializer(membership).data)


class DeclineInvitationView(APIView):
    """POST /api/invitations/{id}/decline/"""

    def post(self, request, pk):
        membership = ProjectMembership.objects.filter(
            id=pk, invited_email=request.user.email, accepted=False
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**Step 5: Add URL routes**

In `backend/core/urls.py`, add imports and paths:

```python
from .invitation_views import (
    AcceptInvitationView,
    DeclineInvitationView,
    InvitationListView,
    InviteView,
)

# Add inside urlpatterns, after the Auth section:
    # Sharing
    path("api/projects/<int:project_id>/invite/", InviteView.as_view(), name="project-invite"),
    path("api/invitations/", InvitationListView.as_view(), name="invitation-list"),
    path("api/invitations/<int:pk>/accept/", AcceptInvitationView.as_view(), name="invitation-accept"),
    path("api/invitations/<int:pk>/decline/", DeclineInvitationView.as_view(), name="invitation-decline"),
```

**Step 6: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_invitations -v2`
Expected: All 6 tests PASS.

**Step 7: Commit**

```bash
git add backend/core/invitation_views.py backend/core/invitation_serializers.py backend/core/urls.py backend/core/tests/test_invitations.py
git commit -m "feat: add invitation API — invite, accept, decline, list"
```

---

### Task 8: Member management API — list, update role, remove

**Files:**
- Create: `backend/core/member_views.py`
- Modify: `backend/core/urls.py`
- Test: `backend/core/tests/test_members.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_members.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_members -v2`
Expected: 404 — routes don't exist.

**Step 3: Create member views**

Create `backend/core/member_views.py`:

```python
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, ProjectMembership
from .permissions import get_user_role


class MemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source="id")
    email = serializers.EmailField()
    name = serializers.CharField(source="first_name")
    role = serializers.CharField()


class MemberListView(APIView):
    """GET /api/projects/{id}/members/ — list owner + accepted members."""

    def get(self, request, project_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        role = get_user_role(request.user, project)
        if role is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        members = []
        # Owner first
        members.append({
            "id": project.owner.id,
            "email": project.owner.email,
            "first_name": project.owner.first_name,
            "role": "owner",
        })
        # Accepted members
        for m in project.memberships.filter(accepted=True).select_related("user"):
            members.append({
                "id": m.user.id,
                "email": m.user.email,
                "first_name": m.user.first_name,
                "role": m.role,
            })

        return Response(MemberSerializer(members, many=True).data)


class MemberDetailView(APIView):
    """PATCH/DELETE /api/projects/{id}/members/{user_id}/"""

    def patch(self, request, project_id, user_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        caller_role = get_user_role(request.user, project)
        if caller_role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        membership = ProjectMembership.objects.filter(
            project=project, user_id=user_id, accepted=True
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        new_role = request.data.get("role")
        if new_role not in dict(ProjectMembership.Role.choices):
            return Response(
                {"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST
            )

        membership.role = new_role
        membership.save()
        return Response({"user_id": user_id, "role": new_role})

    def delete(self, request, project_id, user_id):
        project = Project.objects.filter(id=project_id).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        caller_role = get_user_role(request.user, project)
        if caller_role not in ("owner", "admin"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Cannot remove the owner
        if project.owner_id == user_id:
            return Response(
                {"detail": "Cannot remove the project owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = ProjectMembership.objects.filter(
            project=project, user_id=user_id, accepted=True
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**Step 4: Add URL routes**

In `backend/core/urls.py`:

```python
from .member_views import MemberDetailView, MemberListView

# Add to urlpatterns:
    path("api/projects/<int:project_id>/members/", MemberListView.as_view(), name="member-list"),
    path("api/projects/<int:project_id>/members/<int:user_id>/", MemberDetailView.as_view(), name="member-detail"),
```

**Step 5: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_members -v2`
Expected: All 4 tests PASS.

**Step 6: Commit**

```bash
git add backend/core/member_views.py backend/core/urls.py backend/core/tests/test_members.py
git commit -m "feat: add member management API — list, update role, remove"
```

---

### Task 9: Public share links — token generation and public view

**Files:**
- Modify: `backend/core/views.py` (add custom actions to ProjectViewSet)
- Create: `backend/core/share_views.py`
- Modify: `backend/core/urls.py`
- Test: `backend/core/tests/test_sharing.py`

**Step 1: Write the failing test**

Create `backend/core/tests/test_sharing.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_sharing -v2`
Expected: 404 on `/api/shared/` and `/regenerate-share-token/`.

**Step 3: Create share views**

Create `backend/core/share_views.py`:

```python
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Node, Project
from .serializers import NodeSerializer, ProjectSerializer


class PublicShareView(APIView):
    """GET /api/shared/{token}/ — public read-only access to a shared project."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        project = Project.objects.filter(
            share_token=token, visibility="link_viewable"
        ).first()
        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        nodes = Node.objects.filter(project=project).order_by("order", "created_at")
        return Response({
            "project": {
                "id": project.id,
                "name": project.name,
                "project_type": project.project_type,
                "brief": project.brief,
            },
            "nodes": NodeSerializer(nodes, many=True).data,
        })
```

**Step 4: Add regenerate-share-token action and auto-generate token on visibility change**

In `backend/core/views.py`, add a custom action to `ProjectViewSet`:

```python
import uuid

class ProjectViewSet(viewsets.ModelViewSet):
    # ... existing code ...

    @action(detail=True, methods=["post"], url_path="regenerate-share-token")
    def regenerate_share_token(self, request, pk=None):
        project = self.get_object()
        if project.owner_id != request.user.id:
            role = get_user_role(request.user, project)
            if role not in ("owner", "admin"):
                return Response(status=status.HTTP_403_FORBIDDEN)
        project.share_token = uuid.uuid4()
        project.save(update_fields=["share_token"])
        return Response({"share_token": str(project.share_token)})

    def perform_update(self, serializer):
        instance = serializer.save()
        # Auto-generate share_token when enabling link sharing
        if instance.visibility == "link_viewable" and not instance.share_token:
            instance.share_token = uuid.uuid4()
            instance.save(update_fields=["share_token"])
```

**Step 5: Add URL route for public share**

In `backend/core/urls.py`:

```python
from .share_views import PublicShareView

# Add to urlpatterns:
    path("api/shared/<uuid:token>/", PublicShareView.as_view(), name="public-share"),
```

**Step 6: Run tests to verify they pass**

Run: `docker exec experiments-backend-1 python manage.py test core.tests.test_sharing -v2`
Expected: All 5 tests PASS.

**Step 7: Commit**

```bash
git add backend/core/share_views.py backend/core/views.py backend/core/urls.py backend/core/tests/test_sharing.py
git commit -m "feat: add public share links and token regeneration"
```

---

### Task 10: Frontend — sharing API methods

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Add sharing methods to api.js**

Append to the `api` object in `frontend/src/api.js`:

```javascript
  // Sharing — Invitations
  inviteToProject(projectId, { email, role }) {
    return request(`/api/projects/${projectId}/invite/`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },
  listInvitations() {
    return request("/api/invitations/");
  },
  acceptInvitation(id) {
    return request(`/api/invitations/${id}/accept/`, { method: "POST" });
  },
  declineInvitation(id) {
    return request(`/api/invitations/${id}/decline/`, { method: "POST" });
  },

  // Sharing — Members
  listMembers(projectId) {
    return request(`/api/projects/${projectId}/members/`);
  },
  updateMemberRole(projectId, userId, role) {
    return request(`/api/projects/${projectId}/members/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  removeMember(projectId, userId) {
    return request(`/api/projects/${projectId}/members/${userId}/`, { method: "DELETE" });
  },

  // Sharing — Public link
  regenerateShareToken(projectId) {
    return request(`/api/projects/${projectId}/regenerate-share-token/`, { method: "POST" });
  },
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add sharing API methods to frontend"
```

---

### Task 11: Frontend — ShareDialog component

**Files:**
- Create: `frontend/src/components/ShareDialog.jsx`
- Modify: `frontend/src/App.jsx` (add share button to topbar, wire dialog)
- Modify: `frontend/src/index.css` (add ShareDialog styles)

**Step 1: Create ShareDialog component**

Create `frontend/src/components/ShareDialog.jsx`. The component should:
- Accept props: `project`, `isOpen`, `onClose`
- Have two sections:
  1. **Link sharing**: toggle for `visibility`, copy-link button, regenerate button
  2. **Members**: list with role dropdown, invite form (email + role), remove button
- Use `api.listMembers()`, `api.inviteToProject()`, `api.updateMemberRole()`, `api.removeMember()`, `api.updateProject()`, `api.regenerateShareToken()`
- Follow the design system: `--surface-1` background, `--border-subtle` borders, `--text-1` text
- Role options in dropdowns: viewer, commenter, editor, admin
- Show "(Owner)" badge for the owner, non-editable
- Copy link button copies `{window.location.origin}/shared/{project.share_token}` to clipboard

**Step 2: Wire into App.jsx**

- Add `isShareOpen` state
- Add "Share" button in topbar (only if `current_user_role` is owner or admin)
- Render `<ShareDialog>` when open
- Pass active project data

**Step 3: Add styles to index.css**

Style the dialog following the design system: modal overlay, `.share-dialog` container, member list, invite form row.

**Step 4: Manual test**

Open the app, click Share on a project, verify:
- Members list loads (shows owner)
- Can toggle link sharing
- Can invite by email
- Can change roles
- Can copy link

**Step 5: Commit**

```bash
git add frontend/src/components/ShareDialog.jsx frontend/src/App.jsx frontend/src/index.css
git commit -m "feat: add ShareDialog component with member management and link sharing"
```

---

### Task 12: Frontend — ProjectSwitcher shows "Shared with me" section

**Files:**
- Modify: `frontend/src/components/ProjectSwitcher.jsx`

**Step 1: Update ProjectSwitcher**

The API now returns `current_user_role` on each project. Split the project list into two sections:

- **My Projects**: projects where `current_user_role === "owner"`
- **Shared with me**: projects where `current_user_role !== "owner"`

For shared projects, show a role badge (e.g., "Editor") next to the project name.

Add a section header `<div className="project-group-label">` for each group.

**Step 2: Add styles**

Add `.project-group-label` and `.role-badge` styles to `index.css`:
- Group label: `--text-2` color, 11px uppercase, `8px 12px` padding
- Role badge: `--surface-inset` bg, `--text-2` color, 10px, rounded pill

**Step 3: Manual test**

- Log in as user A, create a project
- Log in as user B, accept invitation
- Verify user B sees project in "Shared with me" section with role badge

**Step 4: Commit**

```bash
git add frontend/src/components/ProjectSwitcher.jsx frontend/src/index.css
git commit -m "feat: split ProjectSwitcher into owned and shared sections"
```

---

### Task 13: Frontend — pending invitations view

**Files:**
- Create: `frontend/src/components/InvitationBanner.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Create InvitationBanner**

A thin banner at the top of the app (below topbar) that:
- Fetches `api.listInvitations()` on mount
- Shows count: "You have N pending invitations"
- Expands to show project name + inviter + role + Accept/Decline buttons
- On accept: calls `api.acceptInvitation(id)`, refreshes project list
- On decline: calls `api.declineInvitation(id)`, removes from list

**Step 2: Wire into App.jsx**

Render `<InvitationBanner>` when user is authenticated, passing `onAccepted` callback to refetch projects.

**Step 3: Commit**

```bash
git add frontend/src/components/InvitationBanner.jsx frontend/src/App.jsx
git commit -m "feat: add invitation banner for pending project invitations"
```

---

### Task 14: Frontend — role-based UI restrictions

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/MarkdownEditor.jsx`

**Step 1: Pass currentRole to components**

In `App.jsx`, derive `currentRole` from the active project's `current_user_role` field. Pass it to:
- `MarkdownEditor` — set `editable: false` for viewers
- `FolderView` — hide create/delete/move for viewers and commenters
- Topbar — hide "Share" button for non-admin/owner
- `AssistantPanel` — hide for viewers

**Step 2: MarkdownEditor read-only mode**

When `currentRole` is `"viewer"`, set Milkdown editor to read-only by passing `editable: () => false` to the editor config. Hide the selection toolbar.

When `currentRole` is `"commenter"`, allow viewing but only enable the comment action in the selection toolbar (hide bold/italic/etc).

**Step 3: Manual test**

- Share project with a viewer role
- Log in as that viewer
- Verify: cannot edit, cannot create nodes, cannot see assistant, CAN see content and comments

**Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/MarkdownEditor.jsx
git commit -m "feat: enforce role-based UI restrictions for viewers and commenters"
```

---

## Phase 3: Real-Time Collaboration

### Task 15: Create y-websocket server (Node.js Docker service)

**Files:**
- Create: `collab/package.json`
- Create: `collab/server.js`
- Create: `collab/Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: Create collab directory and package.json**

```json
{
  "name": "jakarta-collab",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "y-websocket": "^2.0.4",
    "yjs": "^13.6.0",
    "ws": "^8.16.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

**Step 2: Create server.js**

The server should:
- Accept WebSocket connections at `ws://localhost:4444/{room_name}`
- Extract JWT from query param `?token=...`
- Verify JWT using shared secret
- Call Django internal API `GET /api/internal/node-access/{node_id}/?user_id={user_id}` to check role
- Set awareness `readOnly: true` for viewers/commenters
- Use y-websocket `setupWSConnection` for Yjs sync
- Persist Yjs doc to Django every 30s and on room close: `PATCH /api/internal/nodes/{id}/content/`

**Step 3: Create Dockerfile**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
```

**Step 4: Update docker-compose.yml**

Add the collab service:

```yaml
  collab:
    build: ./collab
    ports:
      - "4444:4444"
    environment:
      JWT_SECRET: ${JWT_SECRET:-your-jwt-secret-here}
      DJANGO_API_URL: http://backend:8000
      PORT: 4444
    depends_on:
      - backend
```

**Step 5: Create Django internal API endpoints**

Create `backend/core/internal_views.py` with:
- `GET /api/internal/node-access/{node_id}/` — validates user access and returns role
- `PATCH /api/internal/nodes/{id}/content/` — updates `content_md` from collab server

Protect with a shared API key header (`X-Internal-Key`).

Add routes in `backend/core/urls.py`.

**Step 6: Test**

Start all services: `docker compose up --build`
Verify collab server starts and accepts connections.

**Step 7: Commit**

```bash
git add collab/ docker-compose.yml backend/core/internal_views.py backend/core/urls.py
git commit -m "feat: add y-websocket collab server with JWT auth and Django integration"
```

---

### Task 16: Integrate y-prosemirror into Milkdown editor

**Files:**
- Modify: `frontend/package.json` (add yjs, y-prosemirror, y-websocket dependencies)
- Create: `frontend/src/collabPlugin.js`
- Modify: `frontend/src/MarkdownEditor.jsx`

**Step 1: Install dependencies**

```bash
cd frontend && npm install yjs y-prosemirror y-websocket
```

**Step 2: Create collabPlugin.js**

A Milkdown plugin factory that:
- Creates `Y.Doc` and `WebsocketProvider` for the given `nodeId`
- Sends JWT as query param
- Registers `ySyncPlugin`, `yCursorPlugin`, `yUndoPlugin` in the ProseMirror plugin list
- Sets awareness with user name and color
- Provides cleanup function to disconnect on unmount
- Falls back to normal editing if WebSocket fails to connect

**Step 3: Integrate into MarkdownEditor**

When `currentRole` is `"editor"`, `"admin"`, or `"owner"`:
- Load the collab plugin instead of the default undo/redo
- Pass the `WebsocketProvider` instance for lifecycle management
- On node change: disconnect old provider, create new one

When in read-only mode (viewer/commenter):
- Connect with awareness only (see cursors) but don't register sync plugin in write mode

**Step 4: Test**

Open same document in two browser tabs. Type in one — verify it appears in the other. Verify cursors appear.

**Step 5: Commit**

```bash
git add frontend/src/collabPlugin.js frontend/src/MarkdownEditor.jsx frontend/package.json frontend/package-lock.json
git commit -m "feat: integrate y-prosemirror for real-time collaborative editing"
```

---

### Task 17: Presence indicator in topbar

**Files:**
- Create: `frontend/src/components/PresenceIndicator.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`

**Step 1: Create PresenceIndicator**

A component that:
- Receives the Yjs `awareness` instance as prop
- Listens to awareness changes
- Shows colored avatar circles for each connected user (max 5, then "+N")
- Each circle shows user initial, colored with their awareness color
- Tooltip on hover shows full name

**Step 2: Wire into topbar**

Show `<PresenceIndicator>` in the topbar when a node is active and collab is connected.

**Step 3: Style**

Stacked circles with slight overlap (negative margin), consistent with design system colors.

**Step 4: Commit**

```bash
git add frontend/src/components/PresenceIndicator.jsx frontend/src/App.jsx frontend/src/index.css
git commit -m "feat: add presence indicator showing connected collaborators"
```

---

## Phase 4: Polish & Enhancements

### Task 18: Ownership transfer

**Files:**
- Modify: `backend/core/member_views.py`
- Modify: `backend/core/urls.py`
- Modify: `frontend/src/components/ShareDialog.jsx`
- Test: `backend/core/tests/test_members.py`

Transfer ownership: owner selects a member → that member becomes owner, old owner becomes admin.

API: `POST /api/projects/{id}/transfer-ownership/` with `{user_id}`.

---

### Task 19: Email notifications for invitations

**Files:**
- Modify: `backend/core/invitation_views.py`
- Modify: `backend/server/settings.py`

Add `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` for development.
Send email in `InviteView.post()` after creating the membership.

---

### Task 20: Reconnection and offline handling

**Files:**
- Modify: `frontend/src/collabPlugin.js`
- Modify: `frontend/src/MarkdownEditor.jsx`

Add connection status indicator (green/yellow/red dot).
On disconnect: show "Reconnecting..." banner, Yjs auto-reconnects.
If reconnection fails after 30s: fall back to REST save mode with a warning.

---

## File Index

| File | Status | Tasks |
|------|--------|-------|
| `backend/core/models.py` | Modify | 1, 2 |
| `backend/core/permissions.py` | Create | 4 |
| `backend/core/views.py` | Modify | 5, 9 |
| `backend/core/serializers.py` | Modify | 5, 6 |
| `backend/core/invitation_views.py` | Create | 7 |
| `backend/core/invitation_serializers.py` | Create | 7 |
| `backend/core/member_views.py` | Create | 8, 18 |
| `backend/core/share_views.py` | Create | 9 |
| `backend/core/internal_views.py` | Create | 15 |
| `backend/core/urls.py` | Modify | 7, 8, 9, 15 |
| `frontend/src/api.js` | Modify | 10 |
| `frontend/src/components/ShareDialog.jsx` | Create | 11 |
| `frontend/src/components/InvitationBanner.jsx` | Create | 13 |
| `frontend/src/components/PresenceIndicator.jsx` | Create | 17 |
| `frontend/src/components/ProjectSwitcher.jsx` | Modify | 12 |
| `frontend/src/MarkdownEditor.jsx` | Modify | 14, 16 |
| `frontend/src/collabPlugin.js` | Create | 16, 20 |
| `frontend/src/App.jsx` | Modify | 11, 13, 14, 17 |
| `frontend/src/index.css` | Modify | 11, 12, 17 |
| `collab/server.js` | Create | 15 |
| `collab/package.json` | Create | 15 |
| `collab/Dockerfile` | Create | 15 |
| `docker-compose.yml` | Modify | 15 |
| `backend/core/tests/test_models.py` | Create | 1, 2 |
| `backend/core/tests/test_permissions.py` | Create | 4 |
| `backend/core/tests/test_views.py` | Create | 5, 6 |
| `backend/core/tests/test_invitations.py` | Create | 7 |
| `backend/core/tests/test_members.py` | Create | 8 |
| `backend/core/tests/test_sharing.py` | Create | 9 |
