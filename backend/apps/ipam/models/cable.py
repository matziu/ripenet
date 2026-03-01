from django.db import models


class Cable(models.Model):
    port_a = models.ForeignKey(
        "ipam.DevicePort", on_delete=models.CASCADE, related_name="cable_as_a",
    )
    port_b = models.ForeignKey(
        "ipam.DevicePort", on_delete=models.CASCADE, related_name="cable_as_b",
    )
    cable_type = models.CharField(max_length=30, default="cat6")
    label = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_cable"
        ordering = ["label"]

    def __str__(self):
        return f"{self.port_a} <-> {self.port_b}"
