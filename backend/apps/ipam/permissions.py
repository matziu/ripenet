from rest_framework.permissions import BasePermission


class ProjectPermission(BasePermission):
    """
    - Viewers: read-only access
    - Editors: read + write
    - Admins: full access including delete
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        return request.user.is_editor

    def has_object_permission(self, request, view, obj):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        if request.method == "DELETE":
            return request.user.is_admin

        return request.user.is_editor
