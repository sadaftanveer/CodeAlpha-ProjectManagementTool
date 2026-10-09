from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, ProjectMember
from .serializers import (
    AddProjectMemberSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
)


def is_project_member(user, project):
    return (
        project.owner_id == user.id
        or ProjectMember.objects.filter(
            project=project,
            user=user,
        ).exists()
    )


def get_project_role(user, project):
    if project.owner_id == user.id:
        return "OWNER"

    membership = ProjectMember.objects.filter(
        project=project,
        user=user,
    ).first()

    if membership:
        return membership.role

    return None


class ProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = Project.objects.filter(
            Q(owner=request.user)
            | Q(project_members__user=request.user)
        ).distinct()

        serializer = ProjectSerializer(
            projects,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = ProjectSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        project = serializer.save(
            owner=request.user
        )

        ProjectMember.objects.create(
            project=project,
            user=request.user,
            role="OWNER",
        )

        return Response(
            ProjectSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_project(self, project_id):
        try:
            return Project.objects.get(
                id=project_id
            )
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not is_project_member(
            request.user,
            project,
        ):
            return Response(
                {"detail": "You do not have access to this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            ProjectSerializer(project).data
        )

    def patch(self, request, project_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        role = get_project_role(
            request.user,
            project,
        )

        if role not in ["OWNER", "MANAGER"]:
            return Response(
                {
                    "detail": "Only the project owner or manager can update this project."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProjectSerializer(
            project,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    def delete(self, request, project_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {
                    "detail": "Only the project owner can delete the project."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        project.delete()

        return Response(
            {"message": "Project deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class ProjectMemberListView(APIView):
    permission_classes = [IsAuthenticated]

    def get_project(self, project_id):
        try:
            return Project.objects.get(
                id=project_id
            )
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not is_project_member(
            request.user,
            project,
        ):
            return Response(
                {"detail": "You do not have access to this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        members = ProjectMember.objects.filter(
            project=project
        )

        return Response(
            ProjectMemberSerializer(
                members,
                many=True,
            ).data
        )

    def post(self, request, project_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        role = get_project_role(
            request.user,
            project,
        )

        if role not in ["OWNER", "MANAGER"]:
            return Response(
                {
                    "detail": "Only the project owner or manager can add members."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AddProjectMemberSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        user = User.objects.get(
            email__iexact=serializer.validated_data["email"],
            is_active=True,
        )

        if ProjectMember.objects.filter(
            project=project,
            user=user,
        ).exists():
            return Response(
                {
                    "detail": "This user is already a project member."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = ProjectMember.objects.create(
            project=project,
            user=user,
            role=serializer.validated_data["role"],
        )

        return Response(
            ProjectMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_project(self, project_id):
        try:
            return Project.objects.get(
                id=project_id
            )
        except Project.DoesNotExist:
            return None

    def patch(self, request, project_id, member_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {
                    "detail": "Only the project owner can manage member roles."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            member = ProjectMember.objects.get(
                id=member_id,
                project=project,
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {"detail": "Project member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_role = request.data.get("role")

        valid_roles = [
            choice[0]
            for choice in ProjectMember.ROLE_CHOICES
        ]

        if new_role not in valid_roles:
            return Response(
                {
                    "detail": "Invalid role."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if member.user_id == project.owner_id:
            return Response(
                {
                    "detail": "The project owner role cannot be changed."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member.role = new_role
        member.save(update_fields=["role"])

        return Response(
            ProjectMemberSerializer(member).data
        )

    def delete(self, request, project_id, member_id):
        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {
                    "detail": "Only the project owner can remove members."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            member = ProjectMember.objects.get(
                id=member_id,
                project=project,
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {"detail": "Project member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if member.user_id == project.owner_id:
            return Response(
                {
                    "detail": "The project owner cannot be removed."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member.delete()

        return Response(
            {"message": "Member removed successfully."}
        )