import logging

from django.db.models import Q
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from notifications.realtime import broadcast_project_event
from notifications.services import (
    create_notification,
    notify_project_members,
)
from projects.models import Project, ProjectMember

from .models import Task
from .serializers import TaskSerializer


logger = logging.getLogger(__name__)

# Only these project roles may create / edit / move / delete tasks.
# Everyone else in the project is read-only (they can still view tasks
# and use comments, which live in their own endpoints).
TASK_MANAGER_ROLES = {"OWNER", "MANAGER"}


def get_project_role(user, project):
    if project.owner_id == user.id:
        return "OWNER"

    membership = ProjectMember.objects.filter(
        project=project,
        user=user,
    ).first()

    return membership.role if membership else None


def user_can_access_project(user, project):
    return (
        project.owner_id == user.id
        or ProjectMember.objects.filter(
            project=project,
            user=user,
        ).exists()
    )


def visible_tasks_for(user):
    """
    Tasks from every project the user owns OR is a member of.

    CHANGED: the old filter only matched ProjectMember rows, so a project
    owner who is not also stored as a ProjectMember could not see or open
    their own tasks (and got 404s on update/delete).
    """
    return (
        Task.objects
        .select_related(
            "project",
            "created_by",
            "assigned_to",
        )
        .filter(
            Q(project__owner=user)
            | Q(project__project_members__user=user)
        )
        .distinct()
    )


def not_task_manager_response(action):
    return Response(
        {
            "detail": (
                f"Only the project owner or a manager can {action}."
            )
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def safe_broadcast_task_event(
    project_id,
    event_type,
    task,
):
    """
    Real-time broadcasting is optional.

    A WebSocket failure must never turn a successful
    database operation into an HTTP error.
    """
    try:
        task_data = TaskSerializer(task).data

        broadcast_project_event(
            project_id=project_id,
            event_type=event_type,
            payload={
                "task": task_data,
            },
        )
    except Exception:
        logger.exception(
            "Failed to broadcast task event "
            "(project=%s, event=%s, task=%s)",
            project_id,
            event_type,
            getattr(task, "id", None),
        )


def safe_task_notification(
    recipient,
    notification_type,
    message,
    project_id,
    task_id,
):
    """
    Notifications are optional side effects.

    Any notification failure is logged but does not
    fail the main task operation.
    """
    try:
        create_notification(
            recipient=recipient,
            notification_type=notification_type,
            message=message,
            project_id=project_id,
            task_id=task_id,
        )
    except Exception:
        logger.exception(
            "Failed to create task notification "
            "(user=%s, project=%s, task=%s)",
            getattr(recipient, "id", None),
            project_id,
            task_id,
        )


def safe_project_notification(
    project,
    notification_type,
    message,
    exclude_user=None,
    task_id=None,
):
    """
    Notify project members without allowing notification
    failures to affect the task API response.
    """
    try:
        notify_project_members(
            project=project,
            notification_type=notification_type,
            message=message,
            exclude_user=exclude_user,
            task_id=task_id,
        )
    except Exception:
        logger.exception(
            "Failed to notify project members "
            "(project=%s, task=%s)",
            project.id,
            task_id,
        )


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = visible_tasks_for(self.request.user)

        project_id = self.request.query_params.get("project")

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        task_status = self.request.query_params.get("status")

        if task_status:
            queryset = queryset.filter(status=task_status)

        priority = self.request.query_params.get("priority")

        if priority:
            queryset = queryset.filter(priority=priority)

        assigned_to = self.request.query_params.get("assigned_to")

        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        search = self.request.query_params.get("search")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
            )

        return queryset.order_by("-created_at").distinct()

    def create(self, request, *args, **kwargs):
        project_id = request.data.get("project")

        if not project_id:
            return Response(
                {"project": "Project is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project_id = int(project_id)
        except (TypeError, ValueError):
            return Response(
                {"project": "Invalid project ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"project": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        role = get_project_role(request.user, project)

        if role is None:
            return Response(
                {
                    "detail": (
                        "You do not have access to this project."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # CHANGED: regular members can no longer create tasks at all.
        # (Before, they could create tasks as long as they did not
        # assign them to anyone.)
        if role not in TASK_MANAGER_ROLES:
            return not_task_manager_response("create tasks")

        serializer = self.get_serializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        # ================================================
        # MAIN DATABASE OPERATION
        # ================================================
        task = serializer.save(
            created_by=request.user,
            project=project,
        )

        # ================================================
        # OPTIONAL REAL-TIME SIDE EFFECT
        # ================================================
        safe_broadcast_task_event(
            project_id=project.id,
            event_type="TASK_CREATED",
            task=task,
        )

        # ================================================
        # OPTIONAL NOTIFICATION SIDE EFFECT
        # ================================================
        if task.assigned_to:
            safe_task_notification(
                recipient=task.assigned_to,
                notification_type="TASK_ASSIGNED",
                message=(
                    f'You were assigned the task '
                    f'"{task.title}" in project '
                    f'"{project.name}".'
                ),
                project_id=project.id,
                task_id=task.id,
            )

        safe_project_notification(
            project=project,
            notification_type="TASK_UPDATED",
            message=(
                f'{request.user.get_full_name() or request.user.username} '
                f'created task "{task.title}".'
            ),
            exclude_user=request.user,
            task_id=task.id,
        )

        # ================================================
        # RETURN SUCCESS
        # ================================================
        return Response(
            TaskSerializer(task).data,
            status=status.HTTP_201_CREATED,
        )


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "task_id"

    def get_queryset(self):
        return visible_tasks_for(self.request.user)

    def get_object(self):
        task = super().get_object()

        if not user_can_access_project(
            self.request.user,
            task.project,
        ):
            raise PermissionDenied(
                "You do not have access to this project."
            )

        return task

    def partial_update(self, request, *args, **kwargs):
        task = self.get_object()

        project = task.project

        role = get_project_role(request.user, project)

        if role is None:
            return Response(
                {
                    "detail": (
                        "You do not have access to this project."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # CHANGED: members are read-only. Previously any member could
        # edit any field except the assignee (title, status, priority...).
        if role not in TASK_MANAGER_ROLES:
            return not_task_manager_response("edit tasks")

        # ================================================
        # PROJECT CANNOT CHANGE
        # ================================================
        if "project" in request.data:
            try:
                requested_project = int(request.data.get("project"))
            except (TypeError, ValueError):
                return Response(
                    {
                        "project": (
                            "A task cannot be moved "
                            "to another project."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if requested_project != task.project_id:
                return Response(
                    {
                        "project": (
                            "A task cannot be moved "
                            "to another project."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_assignee_id = task.assigned_to_id
        old_status = task.status

        serializer = self.get_serializer(
            task,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        updated_status = serializer.validated_data.get(
            "status",
            task.status,
        )

        # ================================================
        # COMPLETION TIMESTAMP
        # ================================================
        if updated_status == "COMPLETED":
            serializer.validated_data["completed_at"] = (
                task.completed_at or timezone.now()
            )
        else:
            serializer.validated_data["completed_at"] = None

        # ================================================
        # MAIN DATABASE OPERATION
        # ================================================
        updated_task = serializer.save()

        # ================================================
        # OPTIONAL REAL-TIME SIDE EFFECT
        # ================================================
        safe_broadcast_task_event(
            project_id=project.id,
            event_type="TASK_UPDATED",
            task=updated_task,
        )

        # ================================================
        # OPTIONAL ASSIGNMENT NOTIFICATION
        # ================================================
        if (
            updated_task.assigned_to_id
            and updated_task.assigned_to_id != old_assignee_id
        ):
            safe_task_notification(
                recipient=updated_task.assigned_to,
                notification_type="TASK_ASSIGNED",
                message=(
                    f'You were assigned the task '
                    f'"{updated_task.title}" in project '
                    f'"{project.name}".'
                ),
                project_id=project.id,
                task_id=updated_task.id,
            )

        # ================================================
        # OPTIONAL COMPLETION NOTIFICATION
        # ================================================
        if (
            old_status != "COMPLETED"
            and updated_task.status == "COMPLETED"
        ):
            safe_project_notification(
                project=project,
                notification_type="TASK_COMPLETED",
                message=(
                    f'{request.user.get_full_name() or request.user.username} '
                    f'completed task "{updated_task.title}".'
                ),
                exclude_user=request.user,
                task_id=updated_task.id,
            )

        # ================================================
        # OPTIONAL STATUS NOTIFICATION
        # ================================================
        elif old_status != updated_task.status:
            safe_project_notification(
                project=project,
                notification_type="TASK_UPDATED",
                message=(
                    f'Task "{updated_task.title}" moved to '
                    f'{updated_task.get_status_display()}.'
                ),
                exclude_user=request.user,
                task_id=updated_task.id,
            )

        # ================================================
        # RETURN SUCCESS
        # ================================================
        return Response(
            TaskSerializer(updated_task).data,
            status=status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True

        return self.partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        task = self.get_object()

        role = get_project_role(request.user, task.project)

        if role not in TASK_MANAGER_ROLES:
            return not_task_manager_response("delete tasks")

        project = task.project
        task_title = task.title
        task_data = TaskSerializer(task).data

        # ================================================
        # MAIN DATABASE OPERATION
        # ================================================
        task.delete()

        # ================================================
        # OPTIONAL REAL-TIME SIDE EFFECT
        # ================================================
        try:
            broadcast_project_event(
                project_id=project.id,
                event_type="TASK_DELETED",
                payload={
                    "task": task_data,
                },
            )
        except Exception:
            logger.exception(
                "Failed to broadcast task deletion "
                "(project=%s, task=%s)",
                project.id,
                task_data.get("id"),
            )

        # ================================================
        # OPTIONAL NOTIFICATION SIDE EFFECT
        # ================================================
        safe_project_notification(
            project=project,
            notification_type="TASK_UPDATED",
            message=f'Task "{task_title}" was deleted.',
            exclude_user=request.user,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)