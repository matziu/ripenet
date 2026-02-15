from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
