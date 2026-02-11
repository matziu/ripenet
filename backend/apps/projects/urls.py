from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from . import views

router = DefaultRouter()
router.register(r"projects", views.ProjectViewSet, basename="project")

projects_router = NestedDefaultRouter(router, r"projects", lookup="project")
projects_router.register(r"sites", views.SiteViewSet, basename="project-sites")

urlpatterns = [
    path("", include(router.urls)),
    path("", include(projects_router.urls)),
]
