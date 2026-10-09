from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "message": "Account created successfully.",
                "token": token.key,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            user = None

        if user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        authenticated_user = authenticate(
            username=user.username,
            password=password,
        )

        if authenticated_user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token, _ = Token.objects.get_or_create(
            user=authenticated_user
        )

        return Response(
            {
                "message": "Login successful.",
                "token": token.key,
                "user": UserSerializer(authenticated_user).data,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()

        return Response(
            {"message": "Logged out successfully."}
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserSerializer(request.user).data
        )


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"detail": "Email address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Do not reveal whether an account exists.
            return Response(
                {
                    "message": (
                        "If an account exists for this email, "
                        "a password reset link has been sent."
                    )
                }
            )

        uid = urlsafe_base64_encode(
            force_bytes(user.pk)
        )

        token = PasswordResetTokenGenerator().make_token(
            user
        )

        frontend_reset_url = (
            f"http://localhost:5173/reset-password/"
            f"{uid}/{token}/"
        )

        send_mail(
            subject="ProjectFlow Password Reset",
            message=(
                "Hello,\n\n"
                "You requested a password reset for your "
                "ProjectFlow account.\n\n"
                f"Reset your password using this link:\n"
                f"{frontend_reset_url}\n\n"
                "If you did not request this, you can safely "
                "ignore this email.\n\n"
                "ProjectFlow Team"
            ),
            from_email="no-reply@projectflow.local",
            recipient_list=[user.email],
            fail_silently=False,
        )

        return Response(
            {
                "message": (
                    "If an account exists for this email, "
                    "a password reset link has been sent."
                )
            }
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, uidb64, token):
        new_password = request.data.get(
            "password",
            ""
        )
        password_confirm = request.data.get(
            "password_confirm",
            ""
        )

        if not new_password:
            return Response(
                {"detail": "New password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {
                    "detail": (
                        "Password must be at least "
                        "8 characters long."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != password_confirm:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(
                urlsafe_base64_decode(uidb64)
            )

            user = User.objects.get(pk=user_id)

        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_generator = PasswordResetTokenGenerator()

        if not token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(
            update_fields=["password"]
        )

        # Invalidate existing authentication tokens.
        Token.objects.filter(user=user).delete()

        return Response(
            {
                "message": (
                    "Password reset successfully. "
                    "Please sign in with your new password."
                )
            }
        )