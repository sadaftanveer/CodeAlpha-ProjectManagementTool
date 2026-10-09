from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


class TokenAuthMiddleware:
    """
    Authenticate WebSocket connections using a DRF token.

    Frontend connection:
    ws://127.0.0.1:8000/ws/projects/1/?token=YOUR_TOKEN
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get(
            "query_string",
            b"",
        ).decode()

        query_params = parse_qs(query_string)

        token = query_params.get(
            "token",
            [None],
        )[0]

        scope["user"] = await self.get_user(token)

        return await self.app(
            scope,
            receive,
            send,
        )

    @database_sync_to_async
    def get_user(self, token):
        if not token:
            return AnonymousUser()

        try:
            token_object = (
                Token.objects
                .select_related("user")
                .get(key=token)
            )

            return token_object.user

        except Token.DoesNotExist:
            return AnonymousUser()