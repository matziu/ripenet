from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"audit", views.AuditLogViewSet, basename="audit")

urlpatterns = [
    path("", include(router.urls)),
]
