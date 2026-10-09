from django.contrib.auth.models import User
from django.db import models


class Notification(models.Model):
    TYPE_CHOICES = [
        ("TASK_ASSIGNED", "Task Assigned"),
        ("TASK_UPDATED", "Task Updated"),
        ("TASK_COMPLETED", "Task Completed"),
        ("COMMENT", "Comment"),
        ("PROJECT_INVITE", "Project Invitation"),
        ("PROJECT_UPDATED", "Project Updated"),
        ("DEADLINE", "Deadline Reminder"),
        ("MENTION", "Mention"),
        ("SYSTEM", "System"),
    ]

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    notification_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default="SYSTEM",
    )

    message = models.TextField()

    is_read = models.BooleanField(default=False)

    related_project_id = models.IntegerField(
        null=True,
        blank=True,
    )

    related_task_id = models.IntegerField(
        null=True,
        blank=True,
    )

    related_comment_id = models.IntegerField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.recipient.username}: "
            f"{self.message}"
        )