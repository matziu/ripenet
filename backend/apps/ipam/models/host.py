from django.db import models
from netfields import InetAddressField, NetManager

from .subnet import Subnet


class Host(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        RESERVED = "reserved", "Reserved"
        DHCP = "dhcp", "DHCP"
        DECOMMISSIONED = "decommissioned", "Decommissioned"

    class DeviceType(models.TextChoices):
        SERVER = "server", "Server"
        ROUTER = "router", "Router"
        SWITCH = "switch", "Switch"
        FIREWALL = "firewall", "Firewall"
        AP = "ap", "Access Point"
        CAMERA = "camera", "Camera"
        PRINTER = "printer", "Printer"
        PHONE = "phone", "Phone"
        WORKSTATION = "workstation", "Workstation"
        OTHER = "other", "Other"

    subnet = models.ForeignKey(Subnet, on_delete=models.CASCADE, related_name="hosts")
    ip_address = InetAddressField(help_text="Host IP address")
    hostname = models.CharField(max_length=255, blank=True)
    mac_address = models.CharField(max_length=17, blank=True, help_text="MAC address (XX:XX:XX:XX:XX:XX)")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    device_type = models.CharField(max_length=20, choices=DeviceType.choices, default=DeviceType.OTHER)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = NetManager()

    class Meta:
        db_table = "ipam_host"
        ordering = ["ip_address"]

    def __str__(self):
        name = self.hostname or str(self.ip_address)
        return f"{name} ({self.ip_address})"

    @property
    def project(self):
        return self.subnet.vlan.site.project
