from rest_framework import serializers

from .models import MarketplaceListing, Review, ReviewComment


class MarketplaceListingListSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    author_name = serializers.CharField(source="published_by.first_name", read_only=True)
    score = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceListing
        fields = [
            "id",
            "project_name",
            "author_name",
            "genre",
            "word_count",
            "synopsis",
            "score",
            "listed_at",
        ]

    def get_score(self, obj):
        return obj.ai_score.get("overall") if obj.ai_score else None


class MarketplaceListingDetailSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    author_name = serializers.CharField(source="published_by.first_name", read_only=True)

    class Meta:
        model = MarketplaceListing
        fields = [
            "id",
            "project_name",
            "author_name",
            "genre",
            "word_count",
            "synopsis",
            "ai_score",
            "listed_at",
            "status",
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
            "id",
            "listing",
            "reviewer_name",
            "project_name",
            "status",
            "summary",
            "verdict",
            "started_at",
            "submitted_at",
        ]
        read_only_fields = [
            "id",
            "reviewer_name",
            "project_name",
            "status",
            "started_at",
            "submitted_at",
        ]


class ReviewCommentSerializer(serializers.ModelSerializer):
    node_title = serializers.CharField(source="node.title", read_only=True)

    class Meta:
        model = ReviewComment
        fields = [
            "id",
            "node",
            "node_title",
            "body",
            "position_from",
            "position_to",
            "comment_type",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
