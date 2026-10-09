import logging

from django.contrib.auth.models import User
from django.db.models import Q

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from notifications.realtime import broadcast_project_event
from notifications.services import (
    notify_project_members,
    notify_user,
)

from projects.models import ProjectMember

from .models import Comment
from .serializers import CommentSerializer


logger = logging.getLogger(__name__)


def get_project_role(user, project):
    if project.owner_id == user.id:
        return "OWNER"

    membership = ProjectMember.objects.filter(
        project=project,
        user=user,
    ).first()

    return membership.role if membership else None


def can_access_project(user, project):
    return (
        project.owner_id == user.id
        or ProjectMember.objects.filter(
            project=project,
            user=user,
        ).exists()
    )


def get_mentioned_users(
    content,
    project,
    exclude_user=None,
):
    """
    Find @username mentions in a comment.

    Only active users who belong to the project or are
    the project owner can be mentioned.
    """

    import re

    usernames = set(
        re.findall(
            r"@([A-Za-z0-9_.-]+)",
            content or "",
        )
    )

    if not usernames:
        return []

    username_query = Q()

    for username in usernames:
        username_query |= Q(
            username__iexact=username
        )

    project_member_ids = ProjectMember.objects.filter(
        project=project,
    ).values_list(
        "user_id",
        flat=True,
    )

    users = User.objects.filter(
        username_query,
        is_active=True,
    ).filter(
        Q(id__in=project_member_ids)
        | Q(id=project.owner_id)
    )

    if exclude_user:
        users = users.exclude(
            id=exclude_user.id
        )

    return list(
        users.distinct()
    )


def safe_broadcast_comment_event(
    project_id,
    event_type,
    comment,
):
    try:
        comment_data = CommentSerializer(
            comment
        ).data

        broadcast_project_event(
            project_id=project_id,
            event_type=event_type,
            payload={
                "comment": comment_data,
            },
        )
    except Exception:
        logger.exception(
            "Failed to broadcast comment event "
            "(project=%s, event=%s, comment=%s)",
            project_id,
            event_type,
            getattr(comment, "id", None),
        )


def safe_notify_comment(
    project,
    message,
    exclude_user=None,
    task_id=None,
    comment_id=None,
):
    try:
        notify_project_members(
            project=project,
            notification_type="COMMENT",
            message=message,
            exclude_user=exclude_user,
            task_id=task_id,
            comment_id=comment_id,
        )
    except Exception:
        logger.exception(
            "Failed to notify project members about comment "
            "(project=%s, task=%s, comment=%s)",
            project.id,
            task_id,
            comment_id,
        )


def safe_notify_reply(
    recipient,
    project,
    task_id,
    comment_id,
    message,
):
    try:
        notify_user(
            recipient=recipient,
            notification_type="COMMENT",
            message=message,
            project_id=project.id,
            task_id=task_id,
            comment_id=comment_id,
        )
    except Exception:
        logger.exception(
            "Failed to notify comment owner about reply "
            "(recipient=%s, project=%s, task=%s, comment=%s)",
            getattr(recipient, "id", None),
            project.id,
            task_id,
            comment_id,
        )


def safe_notify_mention(
    recipient,
    project,
    task_id,
    comment_id,
    message,
):
    try:
        notify_user(
            recipient=recipient,
            notification_type="MENTION",
            message=message,
            project_id=project.id,
            task_id=task_id,
            comment_id=comment_id,
        )
    except Exception:
        logger.exception(
            "Failed to notify mentioned user "
            "(recipient=%s, project=%s, task=%s, comment=%s)",
            getattr(recipient, "id", None),
            project.id,
            task_id,
            comment_id,
        )


class CommentListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CommentSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Comment.objects
            .select_related(
                "user",
                "task",
                "task__project",
                "parent",
            )
            .filter(
                Q(task__project__owner=user)
                | Q(
                    task__project__project_members__user=user
                )
            )
            .distinct()
        )

        task_id = self.request.query_params.get(
            "task"
        )

        if task_id:
            queryset = queryset.filter(
                task_id=task_id
            )

        return queryset.order_by(
            "created_at"
        )

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):  
        task_id = request.data.get("task")
        parent_id = request.data.get("parent")

        if not task_id:
            return Response(
                {
                    "task": "Task is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task_id = int(task_id)

        except (
            TypeError,
            ValueError,
        ):
            return Response(
                {
                    "task": "Invalid task ID."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from tasks.models import Task

            task = (
                Task.objects
                .select_related("project")
                .get(id=task_id)
            )

        except Task.DoesNotExist:
            return Response(
                {
                    "task": "Task not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_access_project(
            request.user,
            task.project,
        ):
            return Response(
                {
                    "detail": (
                        "You do not have access to "
                        "this project."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        parent_comment = None

        if parent_id not in (
            None,
            "",
        ):
            try:
                parent_id = int(parent_id)

            except (
                TypeError,
                ValueError,
            ):
                return Response(
                    {
                        "parent": (
                            "Invalid parent comment ID."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                parent_comment = (
                    Comment.objects
                    .select_related(
                        "user",
                        "task",
                        "task__project",
                        "parent",
                    )
                    .get(
                        id=parent_id
                    )
                )

            except Comment.DoesNotExist:
                return Response(
                    {
                        "parent": (
                            "Parent comment not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # A reply must belong to the same task.
            if parent_comment.task_id != task.id:
                return Response(
                    {
                        "parent": (
                            "You can only reply to a "
                            "comment on this task."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # The parent comment must belong to a project
            # the current user can access.
            if not can_access_project(
                request.user,
                parent_comment.task.project,
            ):
                return Response(
                    {
                        "detail": (
                            "You do not have access to "
                            "this comment."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Do not allow replies to deleted comments.
            if parent_comment.is_deleted:
                return Response(
                    {
                        "parent": (
                            "You cannot reply to a "
                            "deleted comment."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        comment = serializer.save(
            user=request.user,
            task=task,
            parent=parent_comment,
        )

        # Send the new comment to connected project users.
        safe_broadcast_comment_event(
            project_id=task.project_id,
            event_type="COMMENT_CREATED",
            comment=comment,
        )

        actor_name = (
            request.user.get_full_name()
            or request.user.username
        )

        # -------------------------------------------------
        # REPLY NOTIFICATION
        # -------------------------------------------------

        if parent_comment:
            if (
                parent_comment.user_id
                != request.user.id
            ):
                safe_notify_reply(
                    recipient=parent_comment.user,
                    project=task.project,
                    task_id=task.id,
                    comment_id=comment.id,
                    message=(
                        f"{actor_name} "
                        f"replied to your comment."
                    ),
                )

        # -------------------------------------------------
        # NORMAL COMMENT NOTIFICATION
        # -------------------------------------------------

        else:
            safe_notify_comment(
                project=task.project,
                message=(
                    f'{actor_name} '
                    f'commented on task '
                    f'"{task.title}".'
                ),
                exclude_user=request.user,
                task_id=task.id,
                comment_id=comment.id,
            )

        # -------------------------------------------------
        # @MENTION NOTIFICATIONS
        # -------------------------------------------------

        mentioned_users = get_mentioned_users(
            content=comment.content,
            project=task.project,
            exclude_user=request.user,
        )

        for mentioned_user in mentioned_users:
            safe_notify_mention(
                recipient=mentioned_user,
                project=task.project,
                task_id=task.id,
                comment_id=comment.id,
                message=(
                    f"{actor_name} mentioned you "
                    f"in a comment."
                ),
            )

        return Response(
            CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class TaskCommentListCreateView(
    CommentListCreateView
):
    def get_queryset(self):
        task_id = self.kwargs.get(
            "task_id"
        )

        queryset = super().get_queryset()

        if task_id:
            queryset = queryset.filter(
                task_id=task_id
            )

        return queryset

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        data = request.data.copy()

        data["task"] = self.kwargs.get(
            "task_id"
        )

        request._full_data = data

        return super().create(
            request,
            *args,
            **kwargs,
        )


class CommentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = CommentSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    lookup_url_kwarg = "comment_id"

    def get_queryset(self):
        user = self.request.user

        return (
            Comment.objects
            .select_related(
                "user",
                "task",
                "task__project",
                "parent",
            )
            .filter(
                Q(task__project__owner=user)
                | Q(
                    task__project__project_members__user=user
                )
            )
            .distinct()
        )

    def get_object(self):
        comment = super().get_object()

        if not can_access_project(
            self.request.user,
            comment.task.project,
        ):
            from rest_framework.exceptions import (
                PermissionDenied,
            )

            raise PermissionDenied(
                "You do not have access to this project."
            )

        return comment

    def partial_update(
        self,
        request,
        *args,
        **kwargs,
    ):
        comment = self.get_object()

        # Only the author can edit.
        if (
            comment.user_id
            != request.user.id
        ):
            return Response(
                {
                    "detail": (
                        "You can only edit your "
                        "own comments."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            comment,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        updated_comment = serializer.save()

        safe_broadcast_comment_event(
            project_id=(
                updated_comment
                .task
                .project_id
            ),
            event_type="COMMENT_UPDATED",
            comment=updated_comment,
        )

        return Response(
            CommentSerializer(
                updated_comment
            ).data,
            status=status.HTTP_200_OK,
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        kwargs["partial"] = True

        return self.partial_update(
            request,
            *args,
            **kwargs,
        )

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        comment = self.get_object()

        project = comment.task.project

        role = get_project_role(
            request.user,
            project,
        )

        # Author, owner, or manager can delete.
        if (
            comment.user_id
            != request.user.id
            and role not in {
                "OWNER",
                "MANAGER",
            }
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission "
                        "to delete this comment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.is_deleted = True

        comment.content = "Comment deleted"

        comment.save(
            update_fields=[
                "is_deleted",
                "content",
                "updated_at",
            ]
        )

        safe_broadcast_comment_event(
            project_id=project.id,
            event_type="COMMENT_DELETED",
            comment=comment,
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )