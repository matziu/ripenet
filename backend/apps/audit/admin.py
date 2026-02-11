from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "action", "object_repr", "project_id")
    list_filter = ("action", "timestamp")
    search_fields = ("object_repr",)
    readonly_fields = ("user", "action", "content_type", "object_id", "object_repr", "changes", "project_id", "timestamp")
