from django.urls import re_path

from notifications.consumers import (
    NotificationConsumer,
    ProjectConsumer,
)


websocket_urlpatterns = [
    re_path(
        r"ws/projects/(?P<project_id>\d+)/$",
        ProjectConsumer.as_asgi(),
    ),
    re_path(
        r"ws/notifications/$",
        NotificationConsumer.as_asgi(),
    ),
]