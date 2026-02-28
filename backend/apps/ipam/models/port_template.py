from django.db import models


class PortTemplate(models.Model):
    device_type = models.ForeignKey(
        "ipam.DeviceType", on_delete=models.CASCADE, related_name="port_templates",
    )
    name = models.CharField(max_length=100)
    port_type = models.CharField(max_length=30, default="rj45")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_port_template"
        ordering = ["position", "name"]
        unique_together = [("device_type", "name")]

    def __str__(self):
        return f"{self.device_type.label} / {self.name}"
