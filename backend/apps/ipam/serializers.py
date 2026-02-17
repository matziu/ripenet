from rest_framework import serializers

from apps.projects.models import Project, Site
from apps.projects.serializers import SiteWanAddressSerializer
from .models import VLAN, Host, Subnet, Tunnel, DHCPPool
from .validators import (
    check_ip_duplicate_in_project, check_ip_in_subnet, check_subnet_overlap,
    check_pool_range_in_subnet, check_pool_overlap, check_static_ip_not_in_pool, check_lease_ip_in_pool,
)


class HostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = [
            "id", "subnet", "ip_address", "hostname", "mac_address",
            "device_type", "ip_type", "dhcp_pool",
            "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        subnet = attrs.get("subnet") or (self.instance and self.instance.subnet)
        ip_address = attrs.get("ip_address") or (self.instance and self.instance.ip_address)
        ip_type = attrs.get("ip_type") or (self.instance and self.instance.ip_type) or "static"
        dhcp_pool = attrs.get("dhcp_pool") or (self.instance and self.instance.dhcp_pool)

        if ip_address and subnet:
            check_ip_in_subnet(ip_address, subnet.network)
            project = subnet.project
            check_ip_duplicate_in_project(
                ip_address, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        # DHCP-specific validation
        if ip_type == "static":
            if dhcp_pool:
                raise serializers.ValidationError(
                    {"dhcp_pool": "Static IP hosts cannot have a DHCP pool."}
                )
            if ip_address and subnet:
                check_static_ip_not_in_pool(ip_address, subnet)
        elif ip_type == "dhcp_lease":
            if not dhcp_pool:
                raise serializers.ValidationError(
                    {"dhcp_pool": "DHCP lease hosts must have a DHCP pool."}
                )
            if dhcp_pool.subnet_id != subnet.id:
                raise serializers.ValidationError(
                    {"dhcp_pool": "DHCP pool must belong to the same subnet as the host."}
                )
            if ip_address and dhcp_pool:
                check_lease_ip_in_pool(ip_address, dhcp_pool)

        return attrs


class DHCPPoolSerializer(serializers.ModelSerializer):
    lease_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = DHCPPool
        fields = [
            "id", "subnet", "start_ip", "end_ip", "description",
            "lease_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        subnet = attrs.get("subnet") or (self.instance and self.instance.subnet)
        start_ip = attrs.get("start_ip") or (self.instance and self.instance.start_ip)
        end_ip = attrs.get("end_ip") or (self.instance and self.instance.end_ip)

        if start_ip and end_ip and subnet:
            check_pool_range_in_subnet(start_ip, end_ip, subnet.network)
            check_pool_overlap(
                start_ip, end_ip, subnet,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class SubnetSerializer(serializers.ModelSerializer):
    host_count = serializers.IntegerField(read_only=True, default=0)
    static_host_count = serializers.IntegerField(read_only=True, default=0)
    dhcp_pool_total_size = serializers.IntegerField(read_only=True, default=0)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
    )
    site = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.all(),
        required=False,
    )

    class Meta:
        model = Subnet
        fields = [
            "id", "project", "site", "vlan", "network", "gateway", "description",
            "host_count", "static_host_count", "dhcp_pool_total_size", "created_at", "updated_at",
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
            # Without vlan, project and site are required
            if not project:
                raise serializers.ValidationError(
                    {"project": "Project is required when no VLAN is specified."}
                )
            if not site:
                raise serializers.ValidationError(
                    {"site": "Site is required when no VLAN is specified."}
                )
            # Validate site belongs to project
            if site.project_id != project.id:
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
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name", "ip_b",
            "external_endpoint",
            "enabled", "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        site_b = attrs.get("site_b")
        external = attrs.get("external_endpoint", "")
        if site_b and external:
            raise serializers.ValidationError("Cannot set both site_b and external_endpoint.")
        if not site_b and not external:
            raise serializers.ValidationError("Either site_b or external_endpoint is required.")
        site_a = attrs.get("site_a") or (self.instance and self.instance.site_a)
        project = attrs.get("project") or (self.instance and self.instance.project)
        if site_a and project and site_a.project_id != project.id:
            raise serializers.ValidationError({"site_a": "Site A must belong to the tunnel's project."})
        return attrs


# --- Topology serializers (nested, read-only) ---

class HostTopologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = ["id", "ip_address", "hostname", "device_type", "ip_type", "dhcp_pool"]


class DHCPPoolTopologySerializer(serializers.ModelSerializer):
    leases = HostTopologySerializer(many=True, read_only=True)

    class Meta:
        model = DHCPPool
        fields = ["id", "start_ip", "end_ip", "description", "leases"]


class SubnetTopologySerializer(serializers.ModelSerializer):
    hosts = serializers.SerializerMethodField()
    dhcp_pools = DHCPPoolTopologySerializer(many=True, read_only=True)

    class Meta:
        model = Subnet
        fields = ["id", "network", "gateway", "description", "hosts", "dhcp_pools"]

    def get_hosts(self, obj):
        """Only return static hosts at the subnet level."""
        qs = obj.hosts.filter(ip_type="static")
        return HostTopologySerializer(qs, many=True).data


class VLANTopologySerializer(serializers.ModelSerializer):
    subnets = SubnetTopologySerializer(many=True, read_only=True)

    class Meta:
        model = VLAN
        fields = ["id", "vlan_id", "name", "purpose", "subnets"]


class SiteTopologySerializer(serializers.ModelSerializer):
    vlans = VLANTopologySerializer(many=True, read_only=True)
    wan_addresses = SiteWanAddressSerializer(many=True, read_only=True)
    standalone_subnets = serializers.SerializerMethodField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)

    class Meta:
        model = Site
        fields = ["id", "name", "address", "latitude", "longitude", "wan_addresses", "vlans", "standalone_subnets"]

    def get_standalone_subnets(self, obj):
        qs = obj.subnets.filter(vlan__isnull=True)
        return SubnetTopologySerializer(qs, many=True).data


class TunnelTopologySerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)
    site_b_latitude = serializers.FloatField(source="site_b.latitude", read_only=True, default=None)
    site_b_longitude = serializers.FloatField(source="site_b.longitude", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name",
            "site_b_latitude", "site_b_longitude", "ip_b",
            "external_endpoint", "enabled",
        ]


class ProjectTopologySerializer(serializers.Serializer):
    """Full topology data for a project - used by the topology view."""
    sites = SiteTopologySerializer(many=True, read_only=True)
    tunnels = TunnelTopologySerializer(many=True, read_only=True)
    standalone_subnets = SubnetTopologySerializer(many=True, read_only=True)
