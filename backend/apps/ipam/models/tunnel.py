from django.db import models
from netfields import CidrAddressField, InetAddressField, NetManager

from apps.projects.models import Project, Site


class Tunnel(models.Model):
    class TunnelType(models.TextChoices):
        GRE = "gre", "GRE"
        IPSEC = "ipsec", "IPsec"
        VXLAN = "vxlan", "VXLAN"
        WIREGUARD = "wireguard", "WireGuard"

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        DOWN = "down", "Down"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tunnels")
    name = models.CharField(max_length=200)
    tunnel_type = models.CharField(max_length=20, choices=TunnelType.choices)
    tunnel_subnet = CidrAddressField(help_text="Tunnel subnet (/30 or /31)")
    site_a = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tunnels_as_a")
    ip_a = InetAddressField(help_text="Tunnel IP for site A")
    site_b = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tunnels_as_b")
    ip_b = InetAddressField(help_text="Tunnel IP for site B")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = NetManager()

    class Meta:
        db_table = "ipam_tunnel"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.site_a.name} ↔ {self.site_b.name})"
