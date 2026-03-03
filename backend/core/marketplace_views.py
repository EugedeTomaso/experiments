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
from .models import MarketplaceListing, Node, Project, Review, ReviewComment


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
            try:
                qs = qs.filter(ai_score__overall__gte=float(min_score))
            except (ValueError, TypeError):
                pass
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
        nodes = listing.project.nodes.order_by("parent_id", "order").values(
            "id", "parent_id", "type", "title", "order"
        )
        return Response(list(nodes))

    @action(detail=True, methods=["get"], url_path=r"nodes/(?P<node_id>[^/.]+)")
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
        try:
            project = Project.objects.get(id=project_id, owner=request.user)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        if hasattr(project, "listing"):
            return Response({"detail": "Project already has a listing."}, status=status.HTTP_400_BAD_REQUEST)
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

    @require_user_type("writer")
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @require_user_type("writer")
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="delist")
    @require_user_type("writer")
    def delist(self, request, pk=None):
        listing = self.get_object()
        listing.status = "delisted"
        listing.delisted_at = timezone.now()
        listing.save(update_fields=["status", "delisted_at"])
        return Response({"status": "delisted"})

    @action(detail=True, methods=["post"], url_path="refresh-score")
    @require_user_type("writer")
    def refresh_score(self, request, pk=None):
        listing = self.get_object()
        return Response({"detail": "Score refresh queued."})

    @action(detail=True, methods=["get"], url_path="reviews")
    @require_user_type("writer")
    def reviews(self, request, pk=None):
        listing = self.get_object()
        reviews = listing.reviews.filter(status__in=["submitted", "read_by_author"])
        return Response(ReviewSerializer(reviews, many=True).data)


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

    @require_user_type("reviewer")
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @require_user_type("reviewer")
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

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
        review.save(update_fields=["status", "submitted_at"])
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
        try:
            review = Review.objects.get(
                id=self.kwargs["review_pk"], reviewer=request.user
            )
        except Review.DoesNotExist:
            return Response({"detail": "Review not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @require_user_type("reviewer")
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @require_user_type("reviewer")
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @require_user_type("reviewer")
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
