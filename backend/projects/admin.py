from django.contrib import admin

from .models import Project, ProjectMember


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "owner",
        "status",
        "priority",
        "start_date",
        "due_date",
        "created_at",
    )

    list_filter = (
        "status",
        "priority",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
        "owner__username",
        "owner__email",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    inlines = [ProjectMemberInline]


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "user",
        "role",
        "joined_at",
    )

    list_filter = (
        "role",
        "joined_at",
    )

    search_fields = (
        "project__name",
        "user__username",
        "user__email",
    )

    readonly_fields = ("joined_at",)