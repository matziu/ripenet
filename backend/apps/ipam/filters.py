import django_filters

from .models import Host, Subnet, Tunnel, VLAN


class VLANFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="site__project_id")
    site = django_filters.NumberFilter(field_name="site_id")

    class Meta:
        model = VLAN
        fields = ["project", "site", "vlan_id", "name"]


class SubnetFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="vlan__site__project_id")
    site = django_filters.NumberFilter(field_name="vlan__site_id")
    vlan = django_filters.NumberFilter(field_name="vlan_id")

    class Meta:
        model = Subnet
        fields = ["project", "site", "vlan"]


class TunnelFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="project_id")

    class Meta:
        model = Tunnel
        fields = ["project", "tunnel_type", "status"]


class HostFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="subnet__vlan__site__project_id")
    site = django_filters.NumberFilter(field_name="subnet__vlan__site_id")
    vlan = django_filters.NumberFilter(field_name="subnet__vlan_id")
    subnet = django_filters.NumberFilter(field_name="subnet_id")
    status = django_filters.ChoiceFilter(choices=Host.Status.choices)
    device_type = django_filters.ChoiceFilter(choices=Host.DeviceType.choices)

    class Meta:
        model = Host
        fields = ["project", "site", "vlan", "subnet", "status", "device_type"]
