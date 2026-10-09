from django.urls import path

from .views import (
    ProjectDetailView,
    ProjectListCreateView,
    ProjectMemberDetailView,
    ProjectMemberListView,
)

urlpatterns = [
    path(
        "",
        ProjectListCreateView.as_view(),
        name="project-list-create",
    ),
    path(
        "<int:project_id>/",
        ProjectDetailView.as_view(),
        name="project-detail",
    ),
    path(
        "<int:project_id>/members/",
        ProjectMemberListView.as_view(),
        name="project-members",
    ),
    path(
        "<int:project_id>/members/<int:member_id>/",
        ProjectMemberDetailView.as_view(),
        name="project-member-detail",
    ),
]