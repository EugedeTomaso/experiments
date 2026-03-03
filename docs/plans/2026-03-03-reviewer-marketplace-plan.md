# Reviewer Marketplace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reviewer marketplace where professional editors discover manuscripts, read with AI tools, and deliver structured review reports to writers.

**Architecture:** Separate ReviewerApp shell sharing components with the writer's App. New Django models for listings, reviews, and review comments. New API endpoints for marketplace browsing, review CRUD, and reviewer AI tools. User type field on auth.User via a Profile model to distinguish writers from reviewers.

**Tech Stack:** Django 5.2 + DRF, PostgreSQL 16, React 18.2 + Vite, Milkdown v7.6.3

**Design doc:** `docs/plans/2026-03-03-reviewer-marketplace-design.md`

---

## Task 1: Add `user_type` to the User profile system

**Files:**
- Create: `backend/core/models.py` (add `UserProfile` model after line 441)
- Modify: `backend/core/auth_serializers.py` (add `user_type` to `RegisterSerializer` and `UserSerializer`)
- Modify: `backend/core/auth_views.py:31-46` (create profile on register)
- Modify: `backend/core/demo_project.py` (skip demo project for reviewers)

**Step 1: Add UserProfile model**

In `backend/core/models.py`, after the `CritiqueMessage` class (line 441), add:

```python
class UserProfile(models.Model):
    class UserType(models.TextChoices):
        WRITER = "writer", "Writer"
        REVIEWER = "reviewer", "Reviewer"

    user = models.OneToOneField("auth.User", related_name="profile", on_delete=models.CASCADE)
    user_type = models.CharField(max_length=10, choices=UserType.choices, default=UserType.WRITER)
    bio = models.TextField(blank=True, default="")
    specialties = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.user.first_name} ({self.user_type})"
```

**Step 2: Update RegisterSerializer**

In `backend/core/auth_serializers.py`, add `user_type` field to `RegisterSerializer`:

```python
class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    user_type = serializers.ChoiceField(
        choices=["writer", "reviewer"], default="writer"
    )
    bio = serializers.CharField(required=False, default="")
    specialties = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        user_type = validated_data.pop("user_type", "writer")
        bio = validated_data.pop("bio", "")
        specialties = validated_data.pop("specialties", [])
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["name"],
        )
        from .models import UserProfile
        UserProfile.objects.create(
            user=user, user_type=user_type, bio=bio, specialties=specialties
        )
        return user
```

**Step 3: Update UserSerializer to include user_type**

In `backend/core/auth_serializers.py`, update `UserSerializer`:

```python
class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")
    user_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "user_type"]
        read_only_fields = ["id", "email", "user_type"]

    def get_user_type(self, obj):
        profile = getattr(obj, "profile", None)
        if profile:
            return profile.user_type
        return "writer"
```

**Step 4: Update RegisterView to skip demo project for reviewers**

In `backend/core/auth_views.py`, update `RegisterView.post`:

```python
def post(self, request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    if user.profile.user_type == "writer":
        create_demo_project(user)
    tokens = get_tokens_for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": tokens,
        },
        status=status.HTTP_201_CREATED,
    )
```

**Step 5: Run migrations**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 6: Create a data migration for existing users**

Existing users get a `UserProfile` with `user_type="writer"`. Create a data migration:

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core --empty -n backfill_user_profiles
```

Edit the migration to add:

```python
def backfill_profiles(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("core", "UserProfile")
    for user in User.objects.all():
        UserProfile.objects.get_or_create(user=user, defaults={"user_type": "writer"})

class Migration(migrations.Migration):
    dependencies = [...]
    operations = [
        migrations.RunPython(backfill_profiles, migrations.RunPython.noop),
    ]
```

Run: `docker exec -it experiments-backend-1 python manage.py migrate`

**Step 7: Commit**

```bash
git add backend/core/models.py backend/core/auth_serializers.py backend/core/auth_views.py backend/core/migrations/
git commit -m "feat: add UserProfile with user_type for writer/reviewer distinction"
```

---

## Task 2: Marketplace models (MarketplaceListing, Review, ReviewComment)

**Files:**
- Modify: `backend/core/models.py` (add 3 new models after `UserProfile`)

**Step 1: Add MarketplaceListing model**

```python
class MarketplaceListing(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        LISTED = "listed", "Listed"
        DELISTED = "delisted", "Delisted"

    project = models.OneToOneField(Project, related_name="listing", on_delete=models.CASCADE)
    published_by = models.ForeignKey("auth.User", related_name="listings", on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    genre = models.CharField(max_length=100, blank=True, default="")
    word_count = models.IntegerField(default=0)
    synopsis = models.TextField(blank=True, default="")
    ai_score = models.JSONField(default=dict, blank=True)
    ai_score_updated_at = models.DateTimeField(null=True, blank=True)
    listed_at = models.DateTimeField(null=True, blank=True)
    delisted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-listed_at"]

    def __str__(self):
        return f"{self.project.name} ({self.status})"
```

**Step 2: Add Review model**

```python
class Review(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        SUBMITTED = "submitted", "Submitted"
        READ = "read_by_author", "Read by Author"

    class Verdict(models.TextChoices):
        PROMISING = "promising", "Promising"
        NEEDS_WORK = "needs_work", "Needs Work"
        PUBLISH_READY = "publish_ready", "Publish Ready"

    listing = models.ForeignKey(MarketplaceListing, related_name="reviews", on_delete=models.CASCADE)
    reviewer = models.ForeignKey("auth.User", related_name="reviews", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    summary = models.TextField(blank=True, default="")
    verdict = models.CharField(max_length=20, choices=Verdict.choices, blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        unique_together = ("listing", "reviewer")

    def __str__(self):
        return f"Review by {self.reviewer.first_name} on {self.listing.project.name}"
```

**Step 3: Add ReviewComment model**

```python
class ReviewComment(models.Model):
    class CommentType(models.TextChoices):
        PRAISE = "praise", "Praise"
        SUGGESTION = "suggestion", "Suggestion"
        ISSUE = "issue", "Issue"
        NOTE = "note", "Note"

    review = models.ForeignKey(Review, related_name="comments", on_delete=models.CASCADE)
    node = models.ForeignKey(Node, related_name="review_comments", on_delete=models.CASCADE)
    body = models.TextField()
    position_from = models.IntegerField()
    position_to = models.IntegerField()
    comment_type = models.CharField(max_length=12, choices=CommentType.choices, default=CommentType.NOTE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["node", "position_from"]

    def __str__(self):
        return f"{self.comment_type}: {self.body[:60]}"
```

**Step 4: Run migrations**

```bash
docker exec -it experiments-backend-1 python manage.py makemigrations core
docker exec -it experiments-backend-1 python manage.py migrate
```

**Step 5: Commit**

```bash
git add backend/core/models.py backend/core/migrations/
git commit -m "feat: add MarketplaceListing, Review, and ReviewComment models"
```

---

## Task 3: Serializers for marketplace, listings, reviews

**Files:**
- Create: `backend/core/marketplace_serializers.py`

**Step 1: Create marketplace serializers**

```python
from rest_framework import serializers
from .models import MarketplaceListing, Review, ReviewComment, UserProfile


class MarketplaceListingListSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    author_name = serializers.CharField(source="published_by.first_name", read_only=True)
    score = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceListing
        fields = [
            "id", "project_name", "author_name", "genre", "word_count",
            "synopsis", "score", "listed_at",
        ]

    def get_score(self, obj):
        return obj.ai_score.get("overall") if obj.ai_score else None


class MarketplaceListingDetailSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    author_name = serializers.CharField(source="published_by.first_name", read_only=True)

    class Meta:
        model = MarketplaceListing
        fields = [
            "id", "project_name", "author_name", "genre", "word_count",
            "synopsis", "ai_score", "listed_at", "status",
        ]


class ListingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketplaceListing
        fields = ["genre", "synopsis"]

    def validate(self, attrs):
        attrs["project"] = self.context["project"]
        attrs["published_by"] = self.context["request"].user
        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source="reviewer.first_name", read_only=True)
    project_name = serializers.CharField(source="listing.project.name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "listing", "reviewer_name", "project_name", "status",
            "summary", "verdict", "started_at", "submitted_at",
        ]
        read_only_fields = ["id", "reviewer_name", "project_name", "status", "started_at", "submitted_at"]


class ReviewCommentSerializer(serializers.ModelSerializer):
    node_title = serializers.CharField(source="node.title", read_only=True)

    class Meta:
        model = ReviewComment
        fields = [
            "id", "node", "node_title", "body", "position_from",
            "position_to", "comment_type", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
```

**Step 2: Commit**

```bash
git add backend/core/marketplace_serializers.py
git commit -m "feat: add serializers for marketplace listings, reviews, and review comments"
```

---

## Task 4: Marketplace API views + URL wiring

**Files:**
- Create: `backend/core/marketplace_views.py`
- Modify: `backend/core/urls.py` (add marketplace routes)

**Step 1: Create the require_user_type decorator**

At the top of `backend/core/marketplace_views.py`:

```python
from functools import wraps

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .marketplace_serializers import (
    ListingCreateSerializer,
    MarketplaceListingDetailSerializer,
    MarketplaceListingListSerializer,
    ReviewCommentSerializer,
    ReviewSerializer,
)
from .models import MarketplaceListing, Node, Review, ReviewComment


def require_user_type(user_type):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(self, request, *args, **kwargs):
            profile = getattr(request.user, "profile", None)
            actual = profile.user_type if profile else "writer"
            if actual != user_type:
                return Response(
                    {"detail": f"Only {user_type}s can access this."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return view_func(self, request, *args, **kwargs)
        return _wrapped
    return decorator
```

**Step 2: MarketplaceViewSet (reviewer-only, read-only)**

```python
class MarketplaceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MarketplaceListingDetailSerializer
        return MarketplaceListingListSerializer

    def get_queryset(self):
        qs = MarketplaceListing.objects.filter(status="listed").select_related(
            "project", "published_by"
        )
        genre = self.request.query_params.get("genre")
        if genre:
            qs = qs.filter(genre__iexact=genre)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(project__name__icontains=search)
        min_score = self.request.query_params.get("min_score")
        if min_score:
            qs = qs.filter(ai_score__overall__gte=float(min_score))
        ordering = self.request.query_params.get("ordering", "-listed_at")
        if ordering in ("-listed_at", "-ai_score__overall", "word_count", "-word_count"):
            qs = qs.order_by(ordering)
        return qs

    @require_user_type("reviewer")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @require_user_type("reviewer")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="nodes")
    @require_user_type("reviewer")
    def nodes(self, request, pk=None):
        listing = self.get_object()
        nodes = listing.project.nodes.order_by("parent", "order").values(
            "id", "parent_id", "type", "title", "order"
        )
        return Response(list(nodes))

    @action(detail=True, methods=["get"], url_path="nodes/(?P<node_id>[^/.]+)")
    @require_user_type("reviewer")
    def node_detail(self, request, pk=None, node_id=None):
        listing = self.get_object()
        try:
            node = listing.project.nodes.get(id=node_id)
        except Node.DoesNotExist:
            return Response({"detail": "Node not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": node.id,
            "title": node.title,
            "content_md": node.content_md,
            "type": node.type,
            "parent_id": node.parent_id,
            "order": node.order,
        })
```

**Step 3: ListingViewSet (writer-only)**

```python
class ListingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MarketplaceListingDetailSerializer

    def get_queryset(self):
        return MarketplaceListing.objects.filter(
            published_by=self.request.user
        ).select_related("project")

    @require_user_type("writer")
    def create(self, request, *args, **kwargs):
        project_id = request.data.get("project")
        from .models import Project
        try:
            project = Project.objects.get(id=project_id, owner=request.user)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ListingCreateSerializer(
            data=request.data, context={"request": request, "project": project}
        )
        serializer.is_valid(raise_exception=True)
        word_count = sum(
            len((n.content_md or "").split()) for n in project.nodes.filter(type="file")
        )
        listing = serializer.save(
            status="listed", listed_at=timezone.now(), word_count=word_count
        )
        return Response(
            MarketplaceListingDetailSerializer(listing).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="delist")
    @require_user_type("writer")
    def delist(self, request, pk=None):
        listing = self.get_object()
        listing.status = "delisted"
        listing.delisted_at = timezone.now()
        listing.save()
        return Response({"status": "delisted"})

    @action(detail=True, methods=["post"], url_path="refresh-score")
    @require_user_type("writer")
    def refresh_score(self, request, pk=None):
        listing = self.get_object()
        # Score calculation will be implemented in Task 7
        return Response({"detail": "Score refresh queued."})

    @action(detail=True, methods=["get"], url_path="reviews")
    @require_user_type("writer")
    def reviews(self, request, pk=None):
        listing = self.get_object()
        reviews = listing.reviews.filter(status__in=["submitted", "read_by_author"])
        return Response(ReviewSerializer(reviews, many=True).data)
```

**Step 4: ReviewViewSet (reviewer-only)**

```python
class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewSerializer

    def get_queryset(self):
        return Review.objects.filter(reviewer=self.request.user).select_related(
            "listing__project"
        )

    @require_user_type("reviewer")
    def create(self, request, *args, **kwargs):
        listing_id = request.data.get("listing")
        try:
            listing = MarketplaceListing.objects.get(id=listing_id, status="listed")
        except MarketplaceListing.DoesNotExist:
            return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)
        if Review.objects.filter(listing=listing, reviewer=request.user).exists():
            return Response(
                {"detail": "You already have a review for this listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        review = Review.objects.create(listing=listing, reviewer=request.user)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="submit")
    @require_user_type("reviewer")
    def submit(self, request, pk=None):
        review = self.get_object()
        if not review.summary:
            return Response(
                {"detail": "Summary is required before submitting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        review.status = "submitted"
        review.submitted_at = timezone.now()
        review.save()
        return Response(ReviewSerializer(review).data)


class ReviewCommentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewCommentSerializer

    def get_queryset(self):
        return ReviewComment.objects.filter(
            review_id=self.kwargs["review_pk"],
            review__reviewer=self.request.user,
        ).select_related("node")

    @require_user_type("reviewer")
    def create(self, request, *args, **kwargs):
        review = Review.objects.get(
            id=self.kwargs["review_pk"], reviewer=request.user
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

**Step 5: Wire URLs in `backend/core/urls.py`**

Add imports and router registrations. After the existing router registrations (line 74), add:

```python
from .marketplace_views import (
    MarketplaceViewSet, ListingViewSet, ReviewViewSet, ReviewCommentViewSet,
)

router.register(r"marketplace", MarketplaceViewSet, basename="marketplace")
router.register(r"listings", ListingViewSet, basename="listing")
router.register(r"reviews", ReviewViewSet, basename="review")
```

In `urlpatterns`, add nested review comments:

```python
path("api/reviews/<int:review_pk>/comments/", ReviewCommentViewSet.as_view({"get": "list", "post": "create"})),
path("api/reviews/<int:review_pk>/comments/<int:pk>/", ReviewCommentViewSet.as_view({"patch": "partial_update", "delete": "destroy"})),
```

**Step 6: Commit**

```bash
git add backend/core/marketplace_views.py backend/core/urls.py
git commit -m "feat: add marketplace, listing, review, and review comment API endpoints"
```

---

## Task 5: AI Score calculation

**Files:**
- Modify: `backend/core/llm.py` (add `generate_marketplace_score` function)
- Modify: `backend/core/marketplace_views.py` (wire score into listing create + refresh)

**Step 1: Add scoring prompt and function to llm.py**

After the existing `generate_critique_sync` function (line 253), add:

```python
MARKETPLACE_SCORE_SYSTEM_PROMPT = """You are a manuscript evaluator. Analyze the provided text and return a JSON object with these exact keys:
- "overall": float 1-10, weighted average of the 4 dimensions
- "prose_quality": float 1-10, clarity, flow, narrative voice, language use
- "structure": float 1-10, organization, pacing, narrative arcs, transitions
- "consistency": float 1-10, character continuity, timeline, worldbuilding, plot holes
- "completeness": float 1-10, how finished it feels, beginning/middle/end, loose threads
- "summary": string, 2-3 sentence assessment

Return ONLY valid JSON, no markdown fences."""


def generate_marketplace_score(provider: str, api_key: str, model: str, content_md: str) -> dict:
    """Score a manuscript for marketplace listing. Returns dict with dimensional scores."""
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    truncated = content_md[:30000]
    messages = [
        {"role": "system", "content": MARKETPLACE_SCORE_SYSTEM_PROMPT},
        {"role": "user", "content": truncated},
    ]

    if config["type"] == "anthropic":
        raw = _sync_anthropic_review(api_key, config["base_url"], model, messages)
    else:
        raw = _sync_openai_compatible_review(api_key, config["base_url"], model, messages)

    try:
        result = json.loads(raw)
        if isinstance(result, dict) and "overall" in result:
            result["model"] = model
            return result
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            result = json.loads(raw[start : end + 1])
            if isinstance(result, dict) and "overall" in result:
                result["model"] = model
                return result
        except json.JSONDecodeError:
            pass

    return {
        "overall": 0, "prose_quality": 0, "structure": 0,
        "consistency": 0, "completeness": 0,
        "summary": "Failed to generate score.", "model": model,
    }
```

**Step 2: Wire score into ListingViewSet.create and refresh_score**

In `marketplace_views.py`, update the `create` method to trigger scoring, and implement `refresh_score`:

```python
from .llm import generate_marketplace_score
from .models import ProviderKey
from .utils import decrypt_value

def _calculate_score(listing):
    """Calculate AI score for a listing. Returns the score dict or None."""
    project = listing.project
    nodes = project.nodes.filter(type="file").order_by("parent_id", "order")
    content = "\n\n".join(f"# {n.title}\n\n{n.content_md or ''}" for n in nodes)
    if not content.strip():
        return None
    try:
        pk = ProviderKey.objects.first()
        if not pk:
            return None
        api_key = decrypt_value(pk.api_key_encrypted)
        score = generate_marketplace_score(pk.provider, api_key, "gpt-4o", content)
        listing.ai_score = score
        listing.ai_score_updated_at = timezone.now()
        listing.save(update_fields=["ai_score", "ai_score_updated_at"])
        return score
    except Exception:
        return None
```

Update `create` to call `_calculate_score(listing)` after saving, and update `refresh_score` to call it and return the result.

**Step 3: Commit**

```bash
git add backend/core/llm.py backend/core/marketplace_views.py
git commit -m "feat: add AI score calculation for marketplace listings"
```

---

## Task 6: Frontend — Auth changes (user_type in registration + routing)

**Files:**
- Modify: `frontend/src/AuthContext.jsx` (pass `user_type` in register)
- Modify: `frontend/src/AuthGate.jsx` (route by user_type)
- Modify: `frontend/src/main.jsx` (import ReviewerApp)
- Modify: `frontend/src/components/AuthShell.jsx` (add role selection to RegisterPage)
- Create: `frontend/src/ReviewerApp.jsx` (minimal shell placeholder)

**Step 1: Update AuthContext.register to accept user_type**

In `frontend/src/AuthContext.jsx`, update the `register` callback (line 98):

```javascript
const register = useCallback(async (name, email, password, userType = "writer", bio = "", specialties = []) => {
    const res = await fetch(`${API_BASE}/api/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, user_type: userType, bio, specialties }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.email?.[0] || data.password?.[0] || data.detail || "Registration failed";
      throw new Error(msg);
    }
    storeTokens(data.tokens);
    setUser(data.user);
    return data;
  }, []);
```

**Step 2: Update AuthGate to route by user_type**

Replace `frontend/src/AuthGate.jsx` contents:

```jsx
import { useAuth } from "./AuthContext";
import App from "./App.jsx";
import { ReviewerApp } from "./ReviewerApp.jsx";

export function AuthGate({ fallback }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Mive</div>
      </div>
    );
  }

  if (!user) return fallback;

  return user.user_type === "reviewer" ? <ReviewerApp /> : <App />;
}
```

**Step 3: Update main.jsx to remove direct App import**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './auth.css'
import { AuthProvider } from './AuthContext.jsx'
import { AuthShell } from './components/AuthShell.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate fallback={<AuthShell />} />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
```

**Step 4: Create ReviewerApp.jsx placeholder**

```jsx
import { useAuth } from "./AuthContext";
import "./App.css";

export function ReviewerApp() {
  const { user, logout } = useAuth();

  return (
    <div className="reviewer-app">
      <header className="reviewer-topbar">
        <div className="reviewer-brand">Mive</div>
        <span className="reviewer-badge">Reviewer</span>
        <div className="reviewer-topbar-right">
          <span>{user.name}</span>
          <button onClick={logout} className="btn-text">Log out</button>
        </div>
      </header>
      <main className="reviewer-main">
        <h2>Marketplace</h2>
        <p>Coming soon — this is the reviewer shell.</p>
      </main>
    </div>
  );
}
```

**Step 5: Add role selection to RegisterPage**

In `frontend/src/components/AuthShell.jsx`, find the `RegisterPage` component and add a role selection step before the form. The first screen shows two cards ("Write" / "Review"), and selecting one sets `userType` state that gets passed to `register()`.

**Step 6: Commit**

```bash
git add frontend/src/AuthContext.jsx frontend/src/AuthGate.jsx frontend/src/main.jsx frontend/src/ReviewerApp.jsx frontend/src/components/AuthShell.jsx
git commit -m "feat: add user_type routing — writers see App, reviewers see ReviewerApp"
```

---

## Task 7: Frontend — MarketplaceBrowse screen

**Files:**
- Create: `frontend/src/components/MarketplaceBrowse.jsx`
- Create: `frontend/src/components/ListingCard.jsx`
- Create: `frontend/src/components/ScoreBadge.jsx`
- Modify: `frontend/src/api.js` (add marketplace API methods)
- Modify: `frontend/src/ReviewerApp.jsx` (wire in MarketplaceBrowse)
- Modify: `frontend/src/App.css` (add marketplace styles)

**Step 1: Add marketplace methods to api.js**

After the existing methods in `frontend/src/api.js`, add:

```javascript
  // Marketplace
  listMarketplace(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/marketplace/${qs ? `?${qs}` : ""}`);
  },
  getMarketplaceListing(id) {
    return request(`/api/marketplace/${id}/`);
  },
  getListingNodes(listingId) {
    return request(`/api/marketplace/${listingId}/nodes/`);
  },
  getListingNode(listingId, nodeId) {
    return request(`/api/marketplace/${listingId}/nodes/${nodeId}/`);
  },
  // Reviews
  createReview(listingId) {
    return request("/api/reviews/", {
      method: "POST",
      body: JSON.stringify({ listing: listingId }),
    });
  },
  listMyReviews() {
    return request("/api/reviews/");
  },
  getReview(id) {
    return request(`/api/reviews/${id}/`);
  },
  updateReview(id, payload) {
    return request(`/api/reviews/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  submitReview(id) {
    return request(`/api/reviews/${id}/submit/`, { method: "POST" });
  },
  listReviewComments(reviewId) {
    return request(`/api/reviews/${reviewId}/comments/`);
  },
  createReviewComment(reviewId, payload) {
    return request(`/api/reviews/${reviewId}/comments/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateReviewComment(reviewId, commentId, payload) {
    return request(`/api/reviews/${reviewId}/comments/${commentId}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteReviewComment(reviewId, commentId) {
    return request(`/api/reviews/${reviewId}/comments/${commentId}/`, { method: "DELETE" });
  },
  // Writer listings
  createListing(payload) {
    return request("/api/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listMyListings() {
    return request("/api/listings/");
  },
  delistListing(id) {
    return request(`/api/listings/${id}/delist/`, { method: "POST" });
  },
  getListingReviews(id) {
    return request(`/api/listings/${id}/reviews/`);
  },
```

**Step 2: Create ScoreBadge.jsx**

```jsx
export function ScoreBadge({ score, size = "default" }) {
  if (score == null) return null;
  const num = typeof score === "number" ? score : parseFloat(score);
  const color = num >= 7 ? "var(--green)" : num >= 4 ? "var(--amber)" : "var(--red)";
  return (
    <span
      className={`score-badge score-badge--${size}`}
      style={{ "--score-color": color }}
    >
      {num.toFixed(1)}
    </span>
  );
}
```

**Step 3: Create ListingCard.jsx**

```jsx
import { ScoreBadge } from "./ScoreBadge";

export function ListingCard({ listing, onClick }) {
  return (
    <button className="listing-card" onClick={() => onClick(listing)}>
      <div className="listing-card__header">
        <h3 className="listing-card__title">{listing.project_name}</h3>
        <ScoreBadge score={listing.score} />
      </div>
      <p className="listing-card__author">by {listing.author_name}</p>
      <p className="listing-card__synopsis">{listing.synopsis}</p>
      <div className="listing-card__meta">
        {listing.genre && <span className="listing-card__genre">{listing.genre}</span>}
        <span className="listing-card__words">{(listing.word_count || 0).toLocaleString()} words</span>
      </div>
    </button>
  );
}
```

**Step 4: Create MarketplaceBrowse.jsx**

```jsx
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ListingCard } from "./ListingCard";

export function MarketplaceBrowse({ onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [ordering, setOrdering] = useState("-listed_at");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (genre) params.genre = genre;
      params.ordering = ordering;
      const data = await api.listMarketplace(params);
      setListings(data.results || data);
    } catch (err) {
      console.error("Failed to load marketplace:", err);
    } finally {
      setLoading(false);
    }
  }, [search, genre, ordering]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <div className="marketplace-browse">
      <div className="marketplace-browse__controls">
        <input
          type="text"
          className="marketplace-browse__search"
          placeholder="Search manuscripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="marketplace-browse__filter"
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
        >
          <option value="-listed_at">Most Recent</option>
          <option value="-ai_score__overall">Highest Score</option>
          <option value="word_count">Shortest</option>
          <option value="-word_count">Longest</option>
        </select>
      </div>
      {loading ? (
        <p className="marketplace-browse__loading">Loading...</p>
      ) : listings.length === 0 ? (
        <p className="marketplace-browse__empty">No manuscripts found.</p>
      ) : (
        <div className="marketplace-browse__grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onClick={onSelectListing} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Wire into ReviewerApp.jsx**

Update `ReviewerApp.jsx` to render `MarketplaceBrowse` and handle navigation state between screens.

**Step 6: Add CSS for marketplace components**

Add styles for `.reviewer-app`, `.reviewer-topbar`, `.marketplace-browse`, `.listing-card`, `.score-badge` to `App.css`, following existing design tokens from `index.css`.

**Step 7: Commit**

```bash
git add frontend/src/components/MarketplaceBrowse.jsx frontend/src/components/ListingCard.jsx frontend/src/components/ScoreBadge.jsx frontend/src/api.js frontend/src/ReviewerApp.jsx frontend/src/App.css
git commit -m "feat: add MarketplaceBrowse screen with listing cards and score badges"
```

---

## Task 8: Frontend — ListingDetail screen

**Files:**
- Create: `frontend/src/components/ListingDetail.jsx`
- Create: `frontend/src/components/ScoreRadar.jsx`
- Modify: `frontend/src/ReviewerApp.jsx` (add ListingDetail view)
- Modify: `frontend/src/App.css` (add listing detail styles)

**Step 1: Create ScoreRadar.jsx**

A simple bar-chart visualization of the 4 AI score dimensions using CSS (no chart library needed). Each dimension is a horizontal bar with label, filled to the percentage of max (10).

**Step 2: Create ListingDetail.jsx**

Receives a listing object. Shows: project name, author, genre, word count, full synopsis, AI score breakdown via ScoreRadar, a preview of the first ~500 words (fetched from the first node), and a "Start Review" button.

The "Start Review" button calls `api.createReview(listing.id)` and navigates to the ReaderView.

**Step 3: Wire into ReviewerApp.jsx navigation**

Add `ListingDetail` as another view state. The flow: MarketplaceBrowse → (click card) → ListingDetail → (Start Review) → ReaderView.

**Step 4: Commit**

```bash
git add frontend/src/components/ListingDetail.jsx frontend/src/components/ScoreRadar.jsx frontend/src/ReviewerApp.jsx frontend/src/App.css
git commit -m "feat: add ListingDetail screen with AI score breakdown and preview"
```

---

## Task 9: Frontend — ReaderView (core reading + commenting experience)

**Files:**
- Create: `frontend/src/components/ReaderView.jsx`
- Create: `frontend/src/components/ReviewCommentToolbar.jsx`
- Modify: `frontend/src/ReviewerApp.jsx` (add ReaderView)
- Modify: `frontend/src/App.css` (reader styles)

**Step 1: Create ReaderView.jsx**

Three-column layout:
- Left: node tree (simplified FolderView, read-only)
- Center: `MarkdownEditor` with `readOnly={true}`, loads content from `api.getListingNode()`
- Right: tabbed panel (placeholder tabs for AI Tools, AI Chat, Report Builder)

Navigation between nodes via the tree. Selecting text shows `ReviewCommentToolbar`.

**Step 2: Create ReviewCommentToolbar.jsx**

A floating toolbar (using same pattern as `SelectionToolbar.jsx`) that appears on text selection with a single "Add Comment" button. Clicking opens a small form: comment type (praise/suggestion/issue/note) + body textarea. On save, calls `api.createReviewComment()`.

**Step 3: Wire into ReviewerApp.jsx**

ReaderView receives the `review` object and `listing` info. Back button returns to ListingDetail or MyReviews.

**Step 4: Commit**

```bash
git add frontend/src/components/ReaderView.jsx frontend/src/components/ReviewCommentToolbar.jsx frontend/src/ReviewerApp.jsx frontend/src/App.css
git commit -m "feat: add ReaderView with read-only editor, node tree, and comment toolbar"
```

---

## Task 10: Frontend — AI Tools panel + Reviewer AI Chat

**Files:**
- Create: `frontend/src/components/AIToolsPanel.jsx`
- Create: `frontend/src/components/ReviewerChatPanel.jsx`
- Modify: `frontend/src/components/ReaderView.jsx` (wire tabs)
- Modify: `frontend/src/api.js` (add reviewer AI methods)
- Modify: `frontend/src/App.css` (AI panel styles)

**Step 1: Add reviewer AI API methods**

```javascript
  analyzeForReview(reviewId, tool, nodeId = null) {
    return request(`/api/reviews/${reviewId}/ai/analyze`, {
      method: "POST",
      body: JSON.stringify({ tool, node_id: nodeId }),
    });
  },
  chatForReview(reviewId, message, nodeId = null) {
    return request(`/api/reviews/${reviewId}/ai/chat`, {
      method: "POST",
      body: JSON.stringify({ message, node_id: nodeId }),
    });
  },
```

**Step 2: Create AIToolsPanel.jsx**

Grid of tool buttons: Analyze Structure, Evaluate Prose, Find Inconsistencies, Chapter Summaries, Character Map, Compare to Genre. Each triggers `api.analyzeForReview()` and renders the markdown result below the buttons.

**Step 3: Create ReviewerChatPanel.jsx**

Chat interface following the pattern of AssistantPanel's conversation view but simplified: message list + input. Uses `api.chatForReview()`.

**Step 4: Wire into ReaderView tabs**

The right panel has 3 tabs: "AI Tools" → `AIToolsPanel`, "Chat" → `ReviewerChatPanel`, "Report" → `ReportBuilder` (next task).

**Step 5: Backend: add reviewer AI views**

In `backend/core/marketplace_views.py`, add `ReviewAIAnalyzeView` and `ReviewAIChatView`:
- Both verify the reviewer owns the review and the review is `in_progress`
- Analyze: dispatches to appropriate LLM prompt based on `tool` param
- Chat: maintains context from the project content + conversation history

Wire in `urls.py`:
```python
path("api/reviews/<int:review_pk>/ai/analyze", ReviewAIAnalyzeView.as_view()),
path("api/reviews/<int:review_pk>/ai/chat", ReviewAIChatView.as_view()),
```

**Step 6: Commit**

```bash
git add frontend/src/components/AIToolsPanel.jsx frontend/src/components/ReviewerChatPanel.jsx frontend/src/components/ReaderView.jsx frontend/src/api.js frontend/src/App.css backend/core/marketplace_views.py backend/core/urls.py
git commit -m "feat: add AI Tools panel and reviewer chat for manuscript analysis"
```

---

## Task 11: Frontend — Report Builder + Submit flow

**Files:**
- Create: `frontend/src/components/ReportBuilder.jsx`
- Modify: `frontend/src/components/ReaderView.jsx` (wire Report tab)
- Modify: `frontend/src/App.css` (report builder styles)

**Step 1: Create ReportBuilder.jsx**

Props: `review`, `comments`, `onSubmit`.

UI:
- Verdict dropdown (promising / needs_work / publish_ready)
- Summary textarea
- List of inline comments grouped by node, each editable/deletable
- "Preview Report" button (renders the report as the writer will see it)
- "Submit Review" button (calls `api.updateReview()` with summary + verdict, then `api.submitReview()`)

**Step 2: Wire into ReaderView's third tab**

ReportBuilder is the "Report" tab. It reads comments from state (synced with the backend on create/edit/delete).

**Step 3: Commit**

```bash
git add frontend/src/components/ReportBuilder.jsx frontend/src/components/ReaderView.jsx frontend/src/App.css
git commit -m "feat: add ReportBuilder for reviewers to compose and submit structured reviews"
```

---

## Task 12: Frontend — MyReviews screen

**Files:**
- Create: `frontend/src/components/MyReviews.jsx`
- Modify: `frontend/src/ReviewerApp.jsx` (add MyReviews nav)

**Step 1: Create MyReviews.jsx**

Fetches `api.listMyReviews()`. Shows a list/table with: project name, status badge (in_progress / submitted), started date, verdict (if submitted). Click on in_progress → ReaderView. Click on submitted → read-only view of the report.

**Step 2: Add navigation in ReviewerApp**

Topbar gets two nav items: "Marketplace" and "My Reviews". State-driven navigation between the two views.

**Step 3: Commit**

```bash
git add frontend/src/components/MyReviews.jsx frontend/src/ReviewerApp.jsx
git commit -m "feat: add MyReviews screen for reviewers to track their reviews"
```

---

## Task 13: Writer-side — View received reviews

**Files:**
- Create: `frontend/src/components/ReceivedReviews.jsx`
- Modify: `frontend/src/App.jsx` (add reviews section/notification)
- Modify: `frontend/src/api.js` (add writer listing/review methods if not yet added)
- Modify: `frontend/src/App.css` (received review styles)

**Step 1: Create ReceivedReviews.jsx**

Shows reviews received for the writer's listings. Each review card shows: reviewer name, verdict badge, summary preview, submitted date. Clicking opens the full review with inline comments overlaid on the writer's document (reusing the existing comment display pattern).

**Step 2: Wire into App.jsx**

Add a "Reviews" indicator or tab accessible from the project home or sidebar. The writer can also mark reviews as "read" via `api.updateReview()` (the backend needs a writer-facing endpoint for this — add `PATCH /api/listings/<id>/reviews/<review_id>/` to mark as read).

**Step 3: Commit**

```bash
git add frontend/src/components/ReceivedReviews.jsx frontend/src/App.jsx frontend/src/api.js frontend/src/App.css
git commit -m "feat: add writer-side view for received reviewer reports"
```

---

## Task 14: Writer-side — Publish to marketplace flow

**Files:**
- Create: `frontend/src/components/MarketplacePublishDialog.jsx`
- Modify: `frontend/src/App.jsx` (add publish to marketplace button)
- Modify: `frontend/src/App.css` (publish dialog styles)

**Step 1: Create MarketplacePublishDialog.jsx**

A dialog (following ShareDialog/PublishDialog pattern) that:
- Shows the project name
- Has fields for: genre (text input or preset list), synopsis (textarea)
- "Publish" button calls `api.createListing({ project: projectId, genre, synopsis })`
- Shows the AI score result after publish
- Shows listing status if already listed, with "Delist" button

**Step 2: Wire into App.jsx**

Add a "Marketplace" button in the project home or share area (near existing Share/Publish buttons). Opens `MarketplacePublishDialog`.

**Step 3: Commit**

```bash
git add frontend/src/components/MarketplacePublishDialog.jsx frontend/src/App.jsx frontend/src/App.css
git commit -m "feat: add Publish to Marketplace dialog for writers"
```

---

## Summary of task dependencies

```
Task 1  (UserProfile model + auth)
  └─► Task 2  (Marketplace models)
       └─► Task 3  (Serializers)
            └─► Task 4  (API views + URLs)
                 └─► Task 5  (AI Score)
                 └─► Task 6  (Frontend auth routing)
                      └─► Task 7  (MarketplaceBrowse)
                           └─► Task 8  (ListingDetail)
                                └─► Task 9  (ReaderView)
                                     ├─► Task 10 (AI Tools + Chat)
                                     └─► Task 11 (Report Builder)
                                └─► Task 12 (MyReviews)
                      └─► Task 13 (Writer received reviews)
                      └─► Task 14 (Writer publish dialog)
```

Tasks 10, 11, 12, 13, 14 can be parallelized once their dependencies are met.
