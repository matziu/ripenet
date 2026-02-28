from django.db import models

from apps.projects.models import Site


class PatchPanel(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="patch_panels")
    name = models.CharField(max_length=100)
    port_count = models.PositiveIntegerField(default=24)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_patch_panel"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.site.name})"
