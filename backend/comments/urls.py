from django.urls import path

from .views import (
    CommentDetailView,
    CommentListCreateView,
    TaskCommentListCreateView,
)


urlpatterns = [
    # General comment list/create endpoint
    path(
        "",
        CommentListCreateView.as_view(),
        name="comment-list-create",
    ),

    # Task-specific comment list/create endpoint
    path(
        "tasks/<int:task_id>/",
        TaskCommentListCreateView.as_view(),
        name="task-comments",
    ),

    # Individual comment
    path(
        "<int:comment_id>/",
        CommentDetailView.as_view(),
        name="comment-detail",
    ),
]