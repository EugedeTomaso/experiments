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
from .llm import generate_marketplace_score
from .models import MarketplaceListing, Node, Project, ProviderKey, Review, ReviewComment
from .utils import decrypt_value


def _calculate_score(listing):
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
        _calculate_score(listing)
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
        score = _calculate_score(listing)
        if score is None:
            return Response(
                {"detail": "Could not calculate score. Check provider keys and project content."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"ai_score": score})

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


class ReviewAIAnalyzeView(APIView):
    permission_classes = [IsAuthenticated]

    @require_user_type("reviewer")
    def post(self, request, review_pk):
        try:
            review = Review.objects.select_related("listing__project").get(
                id=review_pk, reviewer=request.user
            )
        except Review.DoesNotExist:
            return Response({"detail": "Review not found."}, status=status.HTTP_404_NOT_FOUND)

        tool = request.data.get("tool", "")
        node_id = request.data.get("node_id")

        project = review.listing.project
        if node_id:
            try:
                node = project.nodes.get(id=node_id)
                content = node.content_md or ""
            except Node.DoesNotExist:
                return Response({"detail": "Node not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            nodes = project.nodes.filter(type="file").order_by("parent_id", "order")
            content = "\n\n".join(f"# {n.title}\n\n{n.content_md or ''}" for n in nodes)

        if not content.strip():
            return Response({"result": "No content to analyze."})

        tool_prompts = {
            "structure": "Analyze the narrative structure, pacing, and arc of this text. Identify strengths and weaknesses.",
            "prose": "Evaluate the prose quality: clarity, voice, show vs tell, repetitions, sentence variety.",
            "inconsistencies": "Find plot holes, timeline contradictions, character inconsistencies, and worldbuilding errors.",
            "summaries": "Provide a 2-3 sentence summary for each chapter/section.",
            "characters": "List all characters, their roles, relationships, and which chapters they appear in.",
            "genre": "Analyze how this text fits within its genre conventions. What tropes does it use or subvert?",
        }

        prompt = tool_prompts.get(tool, f"Analyze this text for: {tool}")

        try:
            pk = ProviderKey.objects.first()
            if not pk:
                return Response({"result": "No AI provider configured."})
            api_key = decrypt_value(pk.api_key_encrypted)

            from .llm import PROVIDERS, _sync_openai_compatible_review, _sync_anthropic_review
            config = PROVIDERS.get(pk.provider)
            if not config:
                return Response({"result": "Unsupported provider."})

            messages = [
                {"role": "system", "content": f"You are a professional literary reviewer. {prompt}"},
                {"role": "user", "content": content[:20000]},
            ]

            if config["type"] == "anthropic":
                result = _sync_anthropic_review(api_key, config["base_url"], "claude-sonnet-4-20250514", messages)
            else:
                result = _sync_openai_compatible_review(api_key, config["base_url"], "gpt-4o", messages)

            return Response({"result": result})
        except Exception as e:
            return Response({"result": f"Analysis failed: {str(e)}"})


class ReviewAIChatView(APIView):
    permission_classes = [IsAuthenticated]

    @require_user_type("reviewer")
    def post(self, request, review_pk):
        try:
            review = Review.objects.select_related("listing__project").get(
                id=review_pk, reviewer=request.user
            )
        except Review.DoesNotExist:
            return Response({"detail": "Review not found."}, status=status.HTTP_404_NOT_FOUND)

        message = request.data.get("message", "")
        node_id = request.data.get("node_id")

        if not message.strip():
            return Response({"detail": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

        project = review.listing.project
        if node_id:
            try:
                node = project.nodes.get(id=node_id)
                context = f"Current chapter: {node.title}\n\n{node.content_md or ''}"
            except Node.DoesNotExist:
                context = ""
        else:
            nodes = project.nodes.filter(type="file").order_by("parent_id", "order")
            context = "\n\n".join(f"# {n.title}\n\n{(n.content_md or '')[:3000]}" for n in nodes[:10])

        try:
            pk = ProviderKey.objects.first()
            if not pk:
                return Response({"reply": "No AI provider configured."})
            api_key = decrypt_value(pk.api_key_encrypted)

            from .llm import PROVIDERS, _sync_openai_compatible_review, _sync_anthropic_review
            config = PROVIDERS.get(pk.provider)
            if not config:
                return Response({"reply": "Unsupported provider."})

            messages = [
                {"role": "system", "content": f"You are a professional literary reviewer helping analyze a manuscript. Here is the context:\n\n{context[:15000]}"},
                {"role": "user", "content": message},
            ]

            if config["type"] == "anthropic":
                reply = _sync_anthropic_review(api_key, config["base_url"], "claude-sonnet-4-20250514", messages)
            else:
                reply = _sync_openai_compatible_review(api_key, config["base_url"], "gpt-4o", messages)

            return Response({"reply": reply})
        except Exception as e:
            return Response({"reply": f"Chat failed: {str(e)}"})
