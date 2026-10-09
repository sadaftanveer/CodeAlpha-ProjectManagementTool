from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "assigned_to",
        "status",
        "priority",
        "due_date",
        "created_at",
    )

    list_filter = (
        "status",
        "priority",
        "due_date",
        "created_at",
    )

    search_fields = (
        "title",
        "description",
        "project__name",
        "assigned_to__username",
        "created_by__username",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "completed_at",
    )

    list_select_related = (
        "project",
        "assigned_to",
        "created_by",
    )