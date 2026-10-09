from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_project_event(
    project_id,
    event_type,
    payload,
):
    channel_layer = get_channel_layer()

    async_to_sync(
        channel_layer.group_send
    )(
        f"project_{project_id}",
        {
            "type": "project.event",
            "data": {
                "type": event_type,
                **payload,
            },
        },
    )


def broadcast_user_event(
    user_id,
    event_type,
    payload,
):
    channel_layer = get_channel_layer()

    async_to_sync(
        channel_layer.group_send
    )(
        f"user_{user_id}",
        {
            "type": "notification.event",
            "data": {
                "type": event_type,
                **payload,
            },
        },
    )