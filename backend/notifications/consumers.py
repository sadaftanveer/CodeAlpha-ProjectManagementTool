from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from projects.models import Project, ProjectMember


class ProjectConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]

        self.project_id = (
            self.scope["url_route"]["kwargs"]["project_id"]
        )

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        has_access = await self.user_can_access_project()

        if not has_access:
            await self.close(code=4003)
            return

        self.group_name = (
            f"project_{self.project_id}"
        )

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send_json(
            {
                "type": "CONNECTION_ESTABLISHED",
                "message": "Connected to project real-time updates.",
                "project_id": int(self.project_id),
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def project_event(self, event):
        await self.send_json(
            event["data"]
        )

    @database_sync_to_async
    def user_can_access_project(self):
        return (
            Project.objects.filter(
                id=self.project_id,
                owner=self.user,
            ).exists()
            or ProjectMember.objects.filter(
                project_id=self.project_id,
                user=self.user,
            ).exists()
        )


class NotificationConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = (
            f"user_{self.user.id}"
        )

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send_json(
            {
                "type": "CONNECTION_ESTABLISHED",
                "message": "Connected to notification updates.",
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def notification_event(self, event):
        await self.send_json(
            event["data"]
        )