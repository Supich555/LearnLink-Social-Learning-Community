from django.db import models
from users.models import User
from community.models import Community


class Post(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        blank=True,
        null=True
    )

    content = models.TextField()

    image = models.ImageField(
        upload_to="posts/images/",
        blank=True,
        null=True
    )

    video = models.FileField(
        upload_to="posts/videos/",
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content[:30]


class Comment(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    content = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)


class Like(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")


class Bookmark(models.Model):
    post = models.ForeignKey(
        Post,
        related_name="bookmarks",
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        User,
        related_name="bookmarks",
        on_delete=models.CASCADE,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")