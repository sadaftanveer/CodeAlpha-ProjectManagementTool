from django.contrib import admin

from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = (
        "task",
        "user",
        "is_deleted",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "is_deleted",
        "created_at",
        "updated_at",
    )

    search_fields = (
        "content",
        "user__username",
        "task__title",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )