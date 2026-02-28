from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PatchPanel, DevicePort


@receiver(post_save, sender=PatchPanel)
def create_patch_panel_ports(sender, instance, created, **kwargs):
    if not created:
        return
    with transaction.atomic():
        for i in range(1, instance.port_count + 1):
            DevicePort.objects.get_or_create(
                patch_panel=instance, name=f"Port {i}",
                defaults={"port_type": "rj45", "position": i},
            )
