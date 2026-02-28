from django.db import models


class PortTemplate(models.Model):
    profile = models.ForeignKey(
        "ipam.PortProfile", on_delete=models.CASCADE, related_name="entries",
    )
    name = models.CharField(max_length=100)
    port_type = models.CharField(max_length=30, default="rj45")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_port_template"
        ordering = ["position", "name"]
        unique_together = [("profile", "name")]

    def __str__(self):
        return f"{self.profile.name} / {self.name}"
