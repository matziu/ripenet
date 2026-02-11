from django.db import models
from netfields import CidrAddressField, InetAddressField, NetManager

from .vlan import VLAN


class Subnet(models.Model):
    vlan = models.ForeignKey(VLAN, on_delete=models.CASCADE, related_name="subnets")
    network = CidrAddressField(help_text="Network in CIDR notation, e.g. 10.0.1.0/24")
    gateway = InetAddressField(blank=True, null=True, help_text="Gateway IP address")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = NetManager()

    class Meta:
        db_table = "ipam_subnet"
        ordering = ["network"]

    def __str__(self):
        return f"{self.network} ({self.vlan})"

    @property
    def project(self):
        return self.vlan.site.project
