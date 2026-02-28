import django_filters
from django.db import models

from .models import Host, Subnet, Tunnel, VLAN, DHCPPool, DevicePort, Cable, PatchPanel


class VLANFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="site__project_id")
    site = django_filters.NumberFilter(field_name="site_id")

    class Meta:
        model = VLAN
        fields = ["project", "site", "vlan_id", "name"]


class SubnetFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="project_id")
    site = django_filters.NumberFilter(field_name="site_id")
    vlan = django_filters.NumberFilter(field_name="vlan_id")
    standalone = django_filters.BooleanFilter(method="filter_standalone")

    class Meta:
        model = Subnet
        fields = ["project", "site", "vlan", "standalone"]

    def filter_standalone(self, queryset, name, value):
        if value is True:
            return queryset.filter(vlan__isnull=True)
        if value is False:
            return queryset.filter(vlan__isnull=False)
        return queryset


class TunnelFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="project_id")

    class Meta:
        model = Tunnel
        fields = ["project", "tunnel_type", "enabled"]


class HostFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="subnet__project_id")
    site = django_filters.NumberFilter(field_name="subnet__site_id")
    vlan = django_filters.NumberFilter(field_name="subnet__vlan_id")
    subnet = django_filters.NumberFilter(field_name="subnet_id")
    dhcp_pool = django_filters.NumberFilter(field_name="dhcp_pool_id")
    device_type = django_filters.CharFilter()

    class Meta:
        model = Host
        fields = ["project", "site", "vlan", "subnet", "dhcp_pool", "device_type"]


class DHCPPoolFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="subnet__project_id")
    site = django_filters.NumberFilter(field_name="subnet__site_id")
    subnet = django_filters.NumberFilter(field_name="subnet_id")

    class Meta:
        model = DHCPPool
        fields = ["project", "site", "subnet"]


class DevicePortFilter(django_filters.FilterSet):
    host = django_filters.NumberFilter(field_name="host_id")
    patch_panel = django_filters.NumberFilter(field_name="patch_panel_id")
    site = django_filters.NumberFilter(method="filter_by_site")

    class Meta:
        model = DevicePort
        fields = ["host", "patch_panel"]

    def filter_by_site(self, queryset, name, value):
        return queryset.filter(
            models.Q(host__subnet__site_id=value) | models.Q(patch_panel__site_id=value)
        )


class CableFilter(django_filters.FilterSet):
    site = django_filters.NumberFilter(method="filter_by_site")

    class Meta:
        model = Cable
        fields = ["cable_type"]

    def filter_by_site(self, queryset, name, value):
        return queryset.filter(
            models.Q(port_a__host__subnet__site_id=value)
            | models.Q(port_a__patch_panel__site_id=value)
            | models.Q(port_b__host__subnet__site_id=value)
            | models.Q(port_b__patch_panel__site_id=value)
        ).distinct()


class PatchPanelFilter(django_filters.FilterSet):
    site = django_filters.NumberFilter(field_name="site_id")

    class Meta:
        model = PatchPanel
        fields = ["site"]
