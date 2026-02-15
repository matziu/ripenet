"""Signal-based audit trail for tracking model changes."""
import threading

from django.contrib.contenttypes.models import ContentType

from .models import AuditLog

_thread_local = threading.local()


def set_audit_user(user):
    _thread_local.audit_user = user


def get_audit_user():
    return getattr(_thread_local, "audit_user", None)


def create_audit_log(instance, action, changes=None):
    user = get_audit_user()
    ct = ContentType.objects.get_for_model(instance)

    # Resolve project_id
    project_id = None
    if hasattr(instance, "project_id"):
        project_id = instance.project_id
    elif hasattr(instance, "project"):
        project_id = instance.project.id if instance.project else None
    elif hasattr(instance, "site"):
        project_id = instance.site.project_id
    elif hasattr(instance, "vlan"):
        project_id = instance.vlan.site.project_id
    elif hasattr(instance, "subnet"):
        project_id = instance.subnet.project_id

    AuditLog.objects.create(
        user=user,
        action=action,
        content_type=ct,
        object_id=instance.pk,
        object_repr=str(instance)[:255],
        changes=changes or {},
        project_id=project_id,
    )
