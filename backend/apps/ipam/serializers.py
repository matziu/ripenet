from rest_framework import serializers

from apps.projects.models import Project, Site
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
            project = subnet.project
            check_ip_duplicate_in_project(
                ip_address, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class SubnetSerializer(serializers.ModelSerializer):
    host_count = serializers.IntegerField(read_only=True, default=0)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
    )

    class Meta:
        model = Subnet
        fields = [
            "id", "project", "site", "vlan", "network", "gateway", "description",
            "host_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        vlan = attrs.get("vlan", self.instance.vlan if self.instance else None)
        site = attrs.get("site", self.instance.site if self.instance else None)
        project = attrs.get("project", self.instance.project if self.instance else None)
        network = attrs.get("network") or (self.instance and self.instance.network)

        # Auto-derive project/site from vlan when vlan is provided
        if vlan:
            attrs["site"] = vlan.site
            attrs["project"] = vlan.site.project
            site = vlan.site
            project = vlan.site.project
        else:
            # Without vlan, project is required
            if not project:
                raise serializers.ValidationError(
                    {"project": "Project is required when no VLAN is specified."}
                )
            # Validate site belongs to project
            if site and site.project_id != project.id:
                raise serializers.ValidationError(
                    {"site": "Site does not belong to the specified project."}
                )

        if network and project:
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
    standalone_subnets = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = ["id", "name", "address", "latitude", "longitude", "wan_addresses", "vlans", "standalone_subnets"]

    def get_standalone_subnets(self, obj):
        qs = obj.subnets.filter(vlan__isnull=True)
        return SubnetTopologySerializer(qs, many=True).data


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
    standalone_subnets = SubnetTopologySerializer(many=True, read_only=True)
