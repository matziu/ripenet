from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Host, PatchPanel, DevicePort, DeviceType


@receiver(post_save, sender=Host)
def create_host_ports(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        dt = DeviceType.objects.get(value=instance.device_type)
    except DeviceType.DoesNotExist:
        return
    for tpl in dt.port_templates.all():
        DevicePort.objects.get_or_create(
            host=instance, name=tpl.name,
            defaults={"port_type": tpl.port_type, "position": tpl.position},
        )


@receiver(post_save, sender=PatchPanel)
def create_patch_panel_ports(sender, instance, created, **kwargs):
    if not created:
        return
    for i in range(1, instance.port_count + 1):
        DevicePort.objects.get_or_create(
            patch_panel=instance, name=f"Port {i}",
            defaults={"port_type": "rj45", "position": i},
        )
