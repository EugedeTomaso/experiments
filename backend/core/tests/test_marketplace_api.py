from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from unittest.mock import patch

from core.models import Node, Project, ProviderKey, UserProfile, Workspace


class MarketplaceApiContractTest(APITestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Test")
        self.writer = User.objects.create_user(
            username="writer@test.com",
            email="writer@test.com",
            password="pass1234",
            first_name="Writer",
        )
        self.reviewer = User.objects.create_user(
            username="reviewer@test.com",
            email="reviewer@test.com",
            password="pass1234",
            first_name="Reviewer",
        )
        UserProfile.objects.create(user=self.reviewer, user_type="reviewer")
        self.project = Project.objects.create(
            workspace=self.workspace,
            name="Glass Orchard",
            owner=self.writer,
            project_type="novel",
        )
        Node.objects.create(
            project=self.project,
            type="file",
            title="Chapter 1",
            content_md="A city of glass and salt.",
            order=0,
        )

    def test_writer_can_publish_project_to_marketplace(self):
        self.client.force_authenticate(self.writer)

        response = self.client.post(
            "/api/listings/",
            {
                "project": self.project.id,
                "genre": "Literary Fiction",
                "synopsis": "A quiet speculative novel.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["project_name"], "Glass Orchard")
        self.assertEqual(response.data["status"], "listed")

    def test_reviewer_can_browse_and_start_review(self):
        self.client.force_authenticate(self.writer)
        publish_response = self.client.post(
            "/api/listings/",
            {
                "project": self.project.id,
                "genre": "Literary Fiction",
                "synopsis": "A quiet speculative novel.",
            },
            format="json",
        )
        self.assertEqual(publish_response.status_code, 201)

        self.client.force_authenticate(self.reviewer)

        browse_response = self.client.get("/api/marketplace/")
        self.assertEqual(browse_response.status_code, 200)
        self.assertEqual(len(browse_response.data), 1)
        self.assertEqual(browse_response.data[0]["project_name"], "Glass Orchard")

        review_response = self.client.post(
            "/api/reviews/",
            {"listing": browse_response.data[0]["id"]},
            format="json",
        )

        self.assertEqual(review_response.status_code, 201)
        self.assertEqual(review_response.data["project_name"], "Glass Orchard")
        self.assertEqual(review_response.data["status"], "in_progress")

    def test_reviewer_reuses_existing_review_for_same_listing(self):
        self.client.force_authenticate(self.writer)
        publish_response = self.client.post(
            "/api/listings/",
            {
                "project": self.project.id,
                "genre": "Literary Fiction",
                "synopsis": "A quiet speculative novel.",
            },
            format="json",
        )
        self.assertEqual(publish_response.status_code, 201)

        self.client.force_authenticate(self.reviewer)

        first_response = self.client.post(
            "/api/reviews/",
            {"listing": publish_response.data["id"]},
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)

        second_response = self.client.post(
            "/api/reviews/",
            {"listing": publish_response.data["id"]},
            format="json",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.data["id"], first_response.data["id"])
        self.assertEqual(second_response.data["status"], "in_progress")

    def test_writer_can_read_comments_from_submitted_review(self):
        self.client.force_authenticate(self.writer)
        publish_response = self.client.post(
            "/api/listings/",
            {
                "project": self.project.id,
                "genre": "Literary Fiction",
                "synopsis": "A quiet speculative novel.",
            },
            format="json",
        )
        self.assertEqual(publish_response.status_code, 201)

        self.client.force_authenticate(self.reviewer)
        review_response = self.client.post(
            "/api/reviews/",
            {"listing": publish_response.data["id"]},
            format="json",
        )
        self.assertEqual(review_response.status_code, 201)

        review_id = review_response.data["id"]
        node = self.project.nodes.get(title="Chapter 1")
        comment_response = self.client.post(
            f"/api/reviews/{review_id}/comments/",
            {
                "node": node.id,
                "body": "The opening image is strong.",
                "position_from": 0,
                "position_to": 12,
                "comment_type": "praise",
            },
            format="json",
        )
        self.assertEqual(comment_response.status_code, 201)

        submit_response = self.client.post(
            f"/api/reviews/{review_id}/submit/",
            format="json",
        )
        self.assertEqual(submit_response.status_code, 400)

        self.client.patch(
            f"/api/reviews/{review_id}/",
            {"summary": "Promising draft.", "verdict": "promising"},
            format="json",
        )
        submit_response = self.client.post(
            f"/api/reviews/{review_id}/submit/",
            format="json",
        )
        self.assertEqual(submit_response.status_code, 200)

        self.client.force_authenticate(self.writer)
        comments_response = self.client.get(f"/api/reviews/{review_id}/comments/")

        self.assertEqual(comments_response.status_code, 200)
        self.assertEqual(len(comments_response.data), 1)
        self.assertEqual(comments_response.data[0]["body"], "The opening image is strong.")

    @patch("core.marketplace_views.decrypt_value", return_value="token")
    @patch(
        "core.marketplace_views._sync_openai_compatible_review",
        side_effect=[Exception("bad openrouter key"), "DeepSeek fallback reply"],
    )
    def test_review_ai_chat_falls_back_to_second_provider_key(
        self,
        sync_review_mock,
        decrypt_value_mock,
    ):
        self.client.force_authenticate(self.writer)
        publish_response = self.client.post(
            "/api/listings/",
            {
                "project": self.project.id,
                "genre": "Literary Fiction",
                "synopsis": "A quiet speculative novel.",
            },
            format="json",
        )
        self.assertEqual(publish_response.status_code, 201)

        self.client.force_authenticate(self.reviewer)
        review_response = self.client.post(
            "/api/reviews/",
            {"listing": publish_response.data["id"]},
            format="json",
        )
        self.assertEqual(review_response.status_code, 201)

        ProviderKey.objects.create(provider="openrouter", api_key_encrypted="enc-openrouter")
        ProviderKey.objects.create(provider="deepseek", api_key_encrypted="enc-deepseek")

        chat_response = self.client.post(
            f"/api/reviews/{review_response.data['id']}/ai/chat",
            {"message": "What is the main tension?"},
            format="json",
        )

        self.assertEqual(chat_response.status_code, 200)
        self.assertEqual(chat_response.data["reply"], "DeepSeek fallback reply")
        self.assertEqual(sync_review_mock.call_count, 2)
        self.assertEqual(decrypt_value_mock.call_count, 2)
