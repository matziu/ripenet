import django_filters

from .models import Host, Subnet, Tunnel, VLAN


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
    device_type = django_filters.ChoiceFilter(choices=Host.DeviceType.choices)

    class Meta:
        model = Host
        fields = ["project", "site", "vlan", "subnet", "device_type"]
