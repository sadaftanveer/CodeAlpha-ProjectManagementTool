from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Task
from projects.models import ProjectMember


class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(
        source="project.name",
        read_only=True,
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    assigned_to_username = serializers.CharField(
        source="assigned_to.username",
        read_only=True,
    )

    class Meta:
        model = Task
        fields = (
            "id",
            "project",
            "project_name",
            "title",
            "description",
            "created_by",
            "created_by_username",
            "assigned_to",
            "assigned_to_username",
            "status",
            "priority",
            "due_date",
            "estimated_hours",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_by",
            "created_by_username",
            "assigned_to_username",
            "completed_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        """
        Validate task-level rules.

        During creation:
        - assigned user must belong to the selected project.

        During update:
        - an existing task cannot be moved to another project.
        - a new assignee must belong to the task's current project.
        """
        instance = self.instance

        project = attrs.get(
            "project",
            instance.project if instance else None,
        )

        assigned_to = attrs.get(
            "assigned_to",
            instance.assigned_to if instance else None,
        )

        # Never allow an existing task to be moved
        # from one project to another through PATCH.
        if instance and "project" in attrs:
            if project.id != instance.project_id:
                raise serializers.ValidationError(
                    {
                        "project": (
                            "A task cannot be moved to another "
                            "project after creation."
                        )
                    }
                )

        # Validate assignee membership.
        if assigned_to:
            is_member = ProjectMember.objects.filter(
                project=project,
                user=assigned_to,
            ).exists()

            is_owner = project.owner_id == assigned_to.id

            if not is_member and not is_owner:
                raise serializers.ValidationError(
                    {
                        "assigned_to": (
                            "The assigned user must be a "
                            "member of this project."
                        )
                    }
                )

        return attrs


class TaskAssigneeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
        )