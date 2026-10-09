from django.contrib.auth.models import User
from django.db import models

from tasks.models import Task


class Comment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    # Null for a normal/top-level comment.
    # Set to another comment when this is a reply.
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="replies",
        null=True,
        blank=True,
    )

    content = models.TextField()

    is_deleted = models.BooleanField(
        default=False
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.task.title}"
        )