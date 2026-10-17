import json
from types import SimpleNamespace

from django.test import TestCase
from django.urls import reverse

from post.models import Comment, Post
from post.views import MAX_VIDEO_SIZE, _validate_video
from users.models import User


class PostApiTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="TestPassword123!",
            full_name="ผู้เขียน",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="TestPassword123!",
            full_name="ผู้ใช้อื่น",
        )
        self.post = Post.objects.create(user=self.author, content="เนื้อหาเดิม")

    def test_create_post_requires_login_and_persists(self):
        url = reverse("create_post")
        self.assertEqual(
            self.client.post(url, {"content": "โพสต์โดยไม่เข้าสู่ระบบ"}).status_code,
            401,
        )

        self.client.force_login(self.author)
        response = self.client.post(url, {"content": "  โพสต์ใหม่  "})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Post.objects.get(pk=response.json()["post"]["id"]).content, "โพสต์ใหม่")

    def test_only_author_can_edit_or_delete_post(self):
        self.client.force_login(self.other_user)
        edit_response = self.client.post(
            reverse("edit_post", args=[self.post.pk]),
            data=json.dumps({"content": "แก้โดยคนอื่น"}),
            content_type="application/json",
        )
        delete_response = self.client.post(reverse("delete_post", args=[self.post.pk]))

        self.assertEqual(edit_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.post.refresh_from_db()
        self.assertEqual(self.post.content, "เนื้อหาเดิม")

        self.client.force_login(self.author)
        edit_response = self.client.post(
            reverse("edit_post", args=[self.post.pk]),
            data=json.dumps({"content": "  แก้แล้ว  "}),
            content_type="application/json",
        )
        self.assertEqual(edit_response.status_code, 200)
        self.assertEqual(edit_response.json()["post"]["content"], "แก้แล้ว")
        self.assertEqual(self.client.post(reverse("delete_post", args=[self.post.pk])).status_code, 200)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())

    def test_comment_create_edit_delete_checks_ownership(self):
        self.client.force_login(self.author)
        create_response = self.client.post(
            reverse("create_comment", args=[self.post.pk]),
            data=json.dumps({"content": "ความคิดเห็น"}),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 201)
        comment = Comment.objects.get(pk=create_response.json()["comment"]["id"])

        self.client.force_login(self.other_user)
        edit_response = self.client.post(
            reverse("edit_comment", args=[comment.pk]),
            data=json.dumps({"content": "แก้โดยคนอื่น"}),
            content_type="application/json",
        )
        self.assertEqual(edit_response.status_code, 403)
        self.assertEqual(self.client.post(reverse("delete_comment", args=[comment.pk])).status_code, 403)

        self.client.force_login(self.author)
        self.assertEqual(
            self.client.post(
                reverse("edit_comment", args=[comment.pk]),
                data=json.dumps({"content": "แก้ความคิดเห็น"}),
                content_type="application/json",
            ).status_code,
            200,
        )
        self.assertEqual(self.client.post(reverse("delete_comment", args=[comment.pk])).status_code, 200)
        self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())

    def test_home_and_profile_render_database_posts(self):
        self.client.force_login(self.author)
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "เนื้อหาเดิม")
        self.assertContains(response, "data-profile-post-list")
        self.assertEqual(list(response.context["profile_posts"]), [self.post])

    def test_video_upload_size_limit_is_enforced_by_server(self):
        oversized_video = SimpleNamespace(
            size=MAX_VIDEO_SIZE + 1,
            content_type="video/mp4",
        )
        self.assertEqual(_validate_video(oversized_video), "วิดีโอต้องมีขนาดไม่เกิน 100 MB")
