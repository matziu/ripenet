from django.db import models
from netfields import InetAddressField, NetManager

from .subnet import Subnet


class DHCPPool(models.Model):
    subnet = models.ForeignKey(Subnet, on_delete=models.CASCADE, related_name="dhcp_pools")
    start_ip = InetAddressField(help_text="Start of DHCP range")
    end_ip = InetAddressField(help_text="End of DHCP range")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = NetManager()

    class Meta:
        db_table = "ipam_dhcp_pool"
        ordering = ["start_ip"]

    def __str__(self):
        return f"{self.start_ip} - {self.end_ip} ({self.subnet.network})"

    @property
    def project(self):
        return self.subnet.project

    @property
    def size(self):
        """Number of IP addresses in this pool range."""
        import ipaddress
        start = ipaddress.ip_address(str(self.start_ip).split("/")[0])
        end = ipaddress.ip_address(str(self.end_ip).split("/")[0])
        return int(end) - int(start) + 1
