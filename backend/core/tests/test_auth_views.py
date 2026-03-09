from django.contrib.auth.models import User
from rest_framework.test import APITestCase


class AuthUserTypeTest(APITestCase):
    def test_login_response_includes_user_type(self):
        User.objects.create_user(
            username="writer@test.com",
            email="writer@test.com",
            password="pass1234",
            first_name="Writer",
        )

        response = self.client.post(
            "/api/auth/login/",
            {"email": "writer@test.com", "password": "pass1234"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["user_type"], "writer")

    def test_me_response_includes_user_type(self):
        user = User.objects.create_user(
            username="reviewer@test.com",
            email="reviewer@test.com",
            password="pass1234",
            first_name="Reviewer",
        )
        self.client.force_authenticate(user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_type"], "writer")
