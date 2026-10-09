from django.contrib.auth.models import User

from .models import Notification
from .realtime import broadcast_user_event


def create_notification(
    recipient,
    notification_type,
    message,
    project_id=None,
    task_id=None,
    comment_id=None,
):
    """
    Create a notification and immediately send a real-time
    notification event to the recipient.

    Notification creation should only be called for a valid
    Django User instance.
    """
    if not isinstance(recipient, User):
        return None

    notification = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        message=message,
        related_project_id=project_id,
        related_task_id=task_id,
        related_comment_id=comment_id,
    )

    broadcast_user_event(
        user_id=recipient.id,
        event_type="NOTIFICATION_CREATED",
        payload={
            "notification": {
                "id": notification.id,
                "notification_type": (
                    notification.notification_type
                ),
                "message": notification.message,
                "is_read": notification.is_read,
                "related_project_id": (
                    notification.related_project_id
                ),
                "related_task_id": (
                    notification.related_task_id
                ),
                "related_comment_id": (
                    notification.related_comment_id
                ),
                "created_at": (
                    notification.created_at.isoformat()
                ),
            }
        },
    )

    return notification


def notify_project_members(
    project,
    notification_type,
    message,
    exclude_user=None,
    task_id=None,
    comment_id=None,
):
    """
    Notify every member of a project, including the owner.

    Uses one filtered queryset instead of combining two querysets
    with the | operator. This avoids Django's:

        Cannot combine a unique query with a non-unique query.

    error.
    """

    # Project members plus the project owner.
    recipients = User.objects.filter(
        project_memberships__project=project
    )

    if project.owner_id:
        recipients = recipients | User.objects.filter(
            id=project.owner_id
        )

    recipients = recipients.distinct()

    # Exclude the user who caused the event, when requested.
    if exclude_user:
        recipients = recipients.exclude(
            id=exclude_user.id
        )

    notifications = []

    for user in recipients:
        notification = create_notification(
            recipient=user,
            notification_type=notification_type,
            message=message,
            project_id=project.id,
            task_id=task_id,
            comment_id=comment_id,
        )

        if notification:
            notifications.append(notification)

    return notifications


def notify_user(
    recipient,
    notification_type,
    message,
    project_id=None,
    task_id=None,
    comment_id=None,
):
    """
    Create a notification for one specific user.

    Used for targeted notifications such as:
    'Kinza replied to your comment.'
    """
    if not isinstance(recipient, User):
        return None

    return create_notification(
        recipient=recipient,
        notification_type=notification_type,
        message=message,
        project_id=project_id,
        task_id=task_id,
        comment_id=comment_id,
    )