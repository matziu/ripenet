from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import User
from .serializers import UserAdminSerializer, UserMeSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """GET to obtain CSRF cookie before POST login."""
        return Response({"detail": "CSRF cookie set"})

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return Response(UserMeSerializer(user).data)
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class UserViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = UserAdminSerializer
    queryset = User.objects.all().order_by("username")

    def destroy(self, request, *args, **kwargs):
        if self.get_object() == request.user:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
