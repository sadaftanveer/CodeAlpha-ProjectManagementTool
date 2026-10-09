from rest_framework import serializers

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    first_name = serializers.CharField(
        source="user.first_name",
        read_only=True,
    )

    last_name = serializers.CharField(
        source="user.last_name",
        read_only=True,
    )

    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    parent_id = serializers.IntegerField(
        source="parent.id",
        read_only=True,
    )

    class Meta:
        model = Comment

        fields = (
            "id",
            "task",
            "user",
            "user_id",
            "username",
            "first_name",
            "last_name",
            "parent",
            "parent_id",
            "content",
            "is_deleted",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "user",
            "user_id",
            "username",
            "first_name",
            "last_name",
            "parent_id",
            "is_deleted",
            "created_at",
            "updated_at",
        )