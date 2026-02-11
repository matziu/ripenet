from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.projects.models import Site


class VLAN(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="vlans")
    vlan_id = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4094)],
    )
    name = models.CharField(max_length=100)
    purpose = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_vlan"
        ordering = ["vlan_id"]
        unique_together = [("site", "vlan_id")]
        verbose_name = "VLAN"
        verbose_name_plural = "VLANs"

    def __str__(self):
        return f"VLAN {self.vlan_id} - {self.name} ({self.site.name})"
