"""URL configuration for ripe-net project."""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.projects.urls")),
    path("api/v1/", include("apps.ipam.urls")),
    path("api/v1/", include("apps.search.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.exports.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/tools/", include("apps.ipam.tools_urls")),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path("__debug__/", include(debug_toolbar.urls)),
    ] + urlpatterns
