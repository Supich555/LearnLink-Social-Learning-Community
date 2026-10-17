from django.test import TestCase
from django.urls import reverse

from users.models import User


class AuthenticationFlowTests(TestCase):
    def test_registration_creates_and_logs_in_user(self):
        response = self.client.post(
            reverse("register"),
            {
                "full_name": "ผู้เรียนใหม่",
                "email": "new.learner@example.com",
                "password": "StrongPass123!",
            },
        )

        self.assertRedirects(response, reverse("home"))
        user = User.objects.get(email="new.learner@example.com")
        self.assertEqual(user.full_name, "ผู้เรียนใหม่")
        self.assertTrue(user.check_password("StrongPass123!"))
        self.assertIn("_auth_user_id", self.client.session)

    def test_login_accepts_email_and_logout_requires_post(self):
        user = User.objects.create_user(
            username="learner",
            email="learner@example.com",
            password="StrongPass123!",
            full_name="ผู้เรียน",
        )
        response = self.client.post(
            reverse("login"),
            {"identifier": user.email, "password": "StrongPass123!"},
        )

        self.assertRedirects(response, reverse("home"))
        self.assertIn("_auth_user_id", self.client.session)
        self.assertEqual(self.client.get(reverse("logout")).status_code, 405)
        self.assertRedirects(self.client.post(reverse("logout")), reverse("home"))
        self.assertNotIn("_auth_user_id", self.client.session)
