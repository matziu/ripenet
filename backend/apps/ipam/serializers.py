from rest_framework import serializers

from apps.projects.models import Site
from apps.projects.serializers import SiteWanAddressSerializer
from .models import VLAN, Host, Subnet, Tunnel
from .validators import check_ip_duplicate_in_project, check_ip_in_subnet, check_subnet_overlap


class HostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = [
            "id", "subnet", "ip_address", "hostname", "mac_address",
            "device_type", "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        subnet = attrs.get("subnet") or (self.instance and self.instance.subnet)
        ip_address = attrs.get("ip_address") or (self.instance and self.instance.ip_address)

        if ip_address and subnet:
            check_ip_in_subnet(ip_address, subnet.network)
            project = subnet.vlan.site.project
            check_ip_duplicate_in_project(
                ip_address, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class SubnetSerializer(serializers.ModelSerializer):
    host_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Subnet
        fields = [
            "id", "vlan", "network", "gateway", "description",
            "host_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        vlan = attrs.get("vlan") or (self.instance and self.instance.vlan)
        network = attrs.get("network") or (self.instance and self.instance.network)

        if network and vlan:
            project = vlan.site.project
            check_subnet_overlap(
                network, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class VLANSerializer(serializers.ModelSerializer):
    subnet_count = serializers.IntegerField(read_only=True, default=0)
    host_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = VLAN
        fields = [
            "id", "site", "vlan_id", "name", "purpose", "description",
            "subnet_count", "host_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TunnelSerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "ip_b",
            "status", "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# --- Topology serializers (nested, read-only) ---

class HostTopologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = ["id", "ip_address", "hostname", "device_type"]


class SubnetTopologySerializer(serializers.ModelSerializer):
    hosts = HostTopologySerializer(many=True, read_only=True)

    class Meta:
        model = Subnet
        fields = ["id", "network", "gateway", "description", "hosts"]


class VLANTopologySerializer(serializers.ModelSerializer):
    subnets = SubnetTopologySerializer(many=True, read_only=True)

    class Meta:
        model = VLAN
        fields = ["id", "vlan_id", "name", "purpose", "subnets"]


class SiteTopologySerializer(serializers.ModelSerializer):
    vlans = VLANTopologySerializer(many=True, read_only=True)
    wan_addresses = SiteWanAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Site
        fields = ["id", "name", "address", "latitude", "longitude", "wan_addresses", "vlans"]


class TunnelTopologySerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True)

    class Meta:
        model = Tunnel
        fields = [
            "id", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "ip_b",
            "status",
        ]


class ProjectTopologySerializer(serializers.Serializer):
    """Full topology data for a project - used by the topology view."""
    sites = SiteTopologySerializer(many=True, read_only=True)
    tunnels = TunnelTopologySerializer(many=True, read_only=True)
