from django.contrib import admin

from .models import VLAN, Host, Subnet, Tunnel, DeviceType, PortTemplate, PortProfile, DevicePort, PatchPanel, Cable


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
    list_display = ("network", "gateway", "vlan", "project", "site", "description")
    list_filter = ("project",)
    search_fields = ("description",)
    inlines = [HostInline]


@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = ("ip_address", "hostname", "device_type", "subnet")
    list_filter = ("device_type", "subnet__project")
    search_fields = ("hostname", "description")


class PortTemplateInline(admin.TabularInline):
    model = PortTemplate
    extra = 0


@admin.register(DeviceType)
class DeviceTypeAdmin(admin.ModelAdmin):
    list_display = ("value", "label", "color", "position")
    ordering = ("position",)


@admin.register(PortProfile)
class PortProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)
    inlines = [PortTemplateInline]


@admin.register(Tunnel)
class TunnelAdmin(admin.ModelAdmin):
    list_display = ("name", "tunnel_type", "tunnel_subnet", "site_a", "site_b", "enabled")
    list_filter = ("tunnel_type", "enabled", "project")
    search_fields = ("name",)


@admin.register(PatchPanel)
class PatchPanelAdmin(admin.ModelAdmin):
    list_display = ("name", "site", "port_count")
    list_filter = ("site__project",)


@admin.register(Cable)
class CableAdmin(admin.ModelAdmin):
    list_display = ("port_a", "port_b", "cable_type", "label")
    list_filter = ("cable_type",)
