from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):

    class Meta:
        model = Notification

        fields = (
            "id",
            "notification_type",
            "message",
            "is_read",
            "related_project_id",
            "related_task_id",
            "related_comment_id",
            "created_at",
        )

        read_only_fields = (
            "id",
            "notification_type",
            "message",
            "related_project_id",
            "related_task_id",
            "related_comment_id",
            "created_at",
        )