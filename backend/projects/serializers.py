from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Project, ProjectMember


class ProjectMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    class Meta:
        model = ProjectMember
        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "role",
            "joined_at",
        )
        read_only_fields = (
            "id",
            "user_id",
            "username",
            "email",
            "joined_at",
        )


class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(
        source="owner.username",
        read_only=True,
    )

    members = ProjectMemberSerializer(
        source="project_members",
        many=True,
        read_only=True,
    )

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "owner",
            "owner_username",
            "status",
            "priority",
            "start_date",
            "due_date",
            "budget",
            "members",
            "member_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_username",
            "members",
            "member_count",
            "created_at",
            "updated_at",
        )

    def get_member_count(self, obj):
        return obj.project_members.count()


class AddProjectMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=ProjectMember.ROLE_CHOICES,
        default="MEMBER",
    )

    def validate_email(self, value):
        value = value.strip().lower()

        if not User.objects.filter(
            email__iexact=value,
            is_active=True,
        ).exists():
            raise serializers.ValidationError(
                "No active user exists with this email address."
            )

        return value