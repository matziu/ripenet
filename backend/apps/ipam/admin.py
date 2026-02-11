from django.contrib import admin

from .models import VLAN, Host, Subnet, Tunnel


class SubnetInline(admin.TabularInline):
    model = Subnet
    extra = 0


class HostInline(admin.TabularInline):
    model = Host
    extra = 0


@admin.register(VLAN)
class VLANAdmin(admin.ModelAdmin):
    list_display = ("vlan_id", "name", "site", "purpose")
    list_filter = ("site__project", "site")
    search_fields = ("name", "purpose")
    inlines = [SubnetInline]


@admin.register(Subnet)
class SubnetAdmin(admin.ModelAdmin):
    list_display = ("network", "gateway", "vlan", "description")
    list_filter = ("vlan__site__project",)
    search_fields = ("description",)
    inlines = [HostInline]


@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = ("ip_address", "hostname", "status", "device_type", "subnet")
    list_filter = ("status", "device_type", "subnet__vlan__site__project")
    search_fields = ("hostname", "description")


@admin.register(Tunnel)
class TunnelAdmin(admin.ModelAdmin):
    list_display = ("name", "tunnel_type", "tunnel_subnet", "site_a", "site_b", "status")
    list_filter = ("tunnel_type", "status", "project")
    search_fields = ("name",)
