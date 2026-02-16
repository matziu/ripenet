from django.db import models
from netfields import CidrAddressField, InetAddressField, NetManager

from apps.projects.models import Project, Site


class Tunnel(models.Model):
    class TunnelType(models.TextChoices):
        GRE = "gre", "GRE"
        IPSEC = "ipsec", "IPsec"
        VXLAN = "vxlan", "VXLAN"
        WIREGUARD = "wireguard", "WireGuard"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tunnels")
    name = models.CharField(max_length=200)
    tunnel_type = models.CharField(max_length=20, choices=TunnelType.choices)
    tunnel_subnet = CidrAddressField(help_text="Tunnel subnet (/30 or /31)")
    site_a = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tunnels_as_a")
    ip_a = InetAddressField(help_text="Tunnel IP for site A")
    site_b = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tunnels_as_b", null=True, blank=True)
    ip_b = InetAddressField(help_text="Tunnel IP for site B")
    enabled = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    external_endpoint = models.CharField(max_length=300, blank=True, default="", help_text="External endpoint name/IP (when site_b is null)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = NetManager()

    class Meta:
        db_table = "ipam_tunnel"
        ordering = ["name"]

    def __str__(self):
        other = self.site_b.name if self.site_b else self.external_endpoint or "External"
        return f"{self.name} ({self.site_a.name} ↔ {other})"
