from django.urls import path

from .views import (
    MarkAllNotificationsReadView,
    NotificationDetailView,
    NotificationListView,
    NotificationUnreadCountView,
)

urlpatterns = [
    path(
        "",
        NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "unread-count/",
        NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path(
        "mark-all-read/",
        MarkAllNotificationsReadView.as_view(),
        name="notification-mark-all-read",
    ),
    path(
        "<int:notification_id>/",
        NotificationDetailView.as_view(),
        name="notification-detail",
    ),
]