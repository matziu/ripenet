from django.db import models


class DevicePort(models.Model):
    host = models.ForeignKey(
        "ipam.Host", on_delete=models.CASCADE, related_name="ports",
        null=True, blank=True,
    )
    patch_panel = models.ForeignKey(
        "ipam.PatchPanel", on_delete=models.CASCADE, related_name="ports",
        null=True, blank=True,
    )
    name = models.CharField(max_length=100)
    port_type = models.CharField(max_length=30, default="rj45")
    position = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "ipam_device_port"
        ordering = ["position", "name"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(host__isnull=False, patch_panel__isnull=True)
                    | models.Q(host__isnull=True, patch_panel__isnull=False)
                ),
                name="port_belongs_to_one_device",
            ),
        ]

    def __str__(self):
        owner = self.host or self.patch_panel
        return f"{owner} / {self.name}"

    @property
    def site(self):
        if self.host:
            return self.host.subnet.site
        return self.patch_panel.site
