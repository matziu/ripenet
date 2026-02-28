import ipaddress

from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q
from django.db.models.expressions import RawSQL
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.permissions import IsAuthenticated

from .filters import HostFilter, SubnetFilter, TunnelFilter, VLANFilter, DHCPPoolFilter, DevicePortFilter, CableFilter, PatchPanelFilter
from .models import VLAN, Host, Subnet, Tunnel, DHCPPool, DeviceType, PortProfile, PortTemplate, DevicePort, PatchPanel, Cable
from .permissions import IsAdmin, ProjectPermission
from .serializers import (
    HostSerializer, SubnetSerializer, TunnelSerializer, VLANSerializer,
    DHCPPoolSerializer, DeviceTypeSerializer, PortProfileSerializer,
    PortTemplateSerializer, DevicePortSerializer, PatchPanelSerializer, CableSerializer,
    PhysicalHostSerializer, PhysicalPatchPanelSerializer, PhysicalCableSerializer,
)


class VLANViewSet(viewsets.ModelViewSet):
    serializer_class = VLANSerializer
    permission_classes = [ProjectPermission]
    filterset_class = VLANFilter
    search_fields = ["name", "purpose"]

    def get_queryset(self):
        return VLAN.objects.annotate(
            subnet_count=Count("subnets", distinct=True),
            host_count=Count("subnets__hosts", distinct=True),
        ).select_related("site", "site__project")


class DeviceTypeViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceTypeSerializer
    queryset = DeviceType.objects.all()
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        device_type = self.get_object()
        host_count = Host.objects.filter(device_type=device_type.value).count()
        if host_count > 0:
            return Response(
                {"detail": f"Cannot delete: {host_count} host(s) use this device type."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SubnetViewSet(viewsets.ModelViewSet):
    serializer_class = SubnetSerializer
    permission_classes = [ProjectPermission]
    filterset_class = SubnetFilter
    search_fields = ["description"]

    def get_queryset(self):
        return Subnet.objects.annotate(
            host_count=Count("hosts", distinct=True),
            static_host_count=Count(
                "hosts",
                filter=Q(hosts__ip_type="static"),
                distinct=True,
            ),
            dhcp_pool_total_size=RawSQL(
                "COALESCE((SELECT SUM(dp.end_ip - dp.start_ip + 1) "
                "FROM ipam_dhcp_pool dp WHERE dp.subnet_id = ipam_subnet.id), 0)",
                [],
            ),
        ).select_related("project", "site", "vlan", "vlan__site")

    @action(detail=True, methods=["get"], url_path="next-free-ip")
    def next_free_ip(self, request, pk=None):
        """Suggest the next available IP address in this subnet.

        Query params:
          ?pool=<id>  — restrict suggestions to the given DHCP pool range
        """
        subnet_obj = self.get_object()
        network = ipaddress.ip_network(str(subnet_obj.network), strict=False)

        used_ips = set(
            str(h.ip_address).split("/")[0] for h in subnet_obj.hosts.all()
        )
        # Also check tunnel IPs in the same project
        project = subnet_obj.project
        tunnels = Tunnel.objects.filter(project=project)
        for t in tunnels:
            used_ips.add(str(t.ip_a).split("/")[0])
            used_ips.add(str(t.ip_b).split("/")[0])

        # Exclude gateway
        if subnet_obj.gateway:
            used_ips.add(str(subnet_obj.gateway).split("/")[0])

        # If pool param is given, search only within that pool's range
        pool_id = request.query_params.get("pool")
        if pool_id:
            from .models import DHCPPool
            try:
                pool = DHCPPool.objects.get(pk=pool_id, subnet=subnet_obj)
            except DHCPPool.DoesNotExist:
                return Response(
                    {"detail": "Pool not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            pool_start = int(ipaddress.ip_address(str(pool.start_ip).split("/")[0]))
            pool_end = int(ipaddress.ip_address(str(pool.end_ip).split("/")[0]))
            for ip_int in range(pool_start, pool_end + 1):
                ip = ipaddress.ip_address(ip_int)
                if str(ip) not in used_ips:
                    return Response({"next_free_ip": str(ip)})
            return Response(
                {"detail": "No free IP addresses in this pool"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Default: search entire subnet, skip DHCP pool ranges
        pool_ranges = []
        for pool in subnet_obj.dhcp_pools.all():
            ps = int(ipaddress.ip_address(str(pool.start_ip).split("/")[0]))
            pe = int(ipaddress.ip_address(str(pool.end_ip).split("/")[0]))
            pool_ranges.append((ps, pe))

        for ip in network.hosts():
            ip_str = str(ip)
            if ip_str in used_ips:
                continue
            ip_int = int(ip)
            if any(ps <= ip_int <= pe for ps, pe in pool_ranges):
                continue
            return Response({"next_free_ip": ip_str})

        return Response(
            {"detail": "No free IP addresses in this subnet"},
            status=status.HTTP_404_NOT_FOUND,
        )

    @action(detail=True, methods=["get"], url_path="suggested-pool-range")
    def suggested_pool_range(self, request, pk=None):
        """Suggest the largest contiguous free IP block for a DHCP pool."""
        subnet_obj = self.get_object()
        network = ipaddress.ip_network(str(subnet_obj.network), strict=False)

        # Usable host range (exclude network + broadcast)
        range_start = int(network.network_address) + 1
        range_end = int(network.broadcast_address) - 1

        if range_start > range_end:
            return Response(
                {"detail": "Subnet too small for a pool"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Collect occupied intervals as (start_int, end_int)
        occupied = []

        if subnet_obj.gateway:
            gw = int(ipaddress.ip_address(str(subnet_obj.gateway).split("/")[0]))
            occupied.append((gw, gw))

        for h in subnet_obj.hosts.all():
            ip = int(ipaddress.ip_address(str(h.ip_address).split("/")[0]))
            occupied.append((ip, ip))

        for pool in subnet_obj.dhcp_pools.all():
            s = int(ipaddress.ip_address(str(pool.start_ip).split("/")[0]))
            e = int(ipaddress.ip_address(str(pool.end_ip).split("/")[0]))
            occupied.append((s, e))

        # Sort and merge intervals
        occupied.sort()
        merged = []
        for start, end in occupied:
            if merged and start <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))

        # Find largest gap
        best = None
        prev_end = range_start - 1

        for occ_start, occ_end in merged:
            gap_start = prev_end + 1
            gap_end = occ_start - 1
            if gap_start <= gap_end and gap_start >= range_start and gap_end <= range_end:
                size = gap_end - gap_start + 1
                if best is None or size > best[2]:
                    best = (gap_start, gap_end, size)
            prev_end = max(prev_end, occ_end)

        # Gap after last occupied
        gap_start = prev_end + 1
        if gap_start <= range_end:
            size = range_end - gap_start + 1
            if best is None or size > best[2]:
                best = (gap_start, range_end, size)

        if best:
            return Response({
                "start_ip": str(ipaddress.ip_address(best[0])),
                "end_ip": str(ipaddress.ip_address(best[1])),
                "size": best[2],
            })

        return Response(
            {"detail": "No free address space in this subnet"},
            status=status.HTTP_404_NOT_FOUND,
        )


class HostViewSet(viewsets.ModelViewSet):
    serializer_class = HostSerializer
    permission_classes = [ProjectPermission]
    filterset_class = HostFilter
    search_fields = ["hostname", "description"]

    def get_queryset(self):
        return Host.objects.select_related(
            "subnet", "subnet__project", "subnet__site", "subnet__vlan"
        )

    @action(detail=True, methods=["post"], url_path="apply-port-profile")
    def apply_port_profile(self, request, pk=None):
        """Apply port entries from a port profile to this host."""
        host = self.get_object()
        profile_id = request.data.get("profile_id")
        if not profile_id:
            return Response(
                {"detail": "profile_id is required.", "created": 0},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            profile = PortProfile.objects.get(pk=profile_id)
        except PortProfile.DoesNotExist:
            return Response(
                {"detail": f"Port profile not found.", "created": 0},
                status=status.HTTP_404_NOT_FOUND,
            )
        entries = profile.entries.all()
        if not entries.exists():
            return Response(
                {"detail": "No entries defined in this profile.", "created": 0},
            )
        created = 0
        with transaction.atomic():
            for entry in entries:
                _, was_created = DevicePort.objects.get_or_create(
                    host=host, name=entry.name,
                    defaults={"port_type": entry.port_type, "position": entry.position},
                )
                if was_created:
                    created += 1
        return Response({"detail": f"Created {created} port(s) from profile.", "created": created})


class DHCPPoolViewSet(viewsets.ModelViewSet):
    serializer_class = DHCPPoolSerializer
    permission_classes = [ProjectPermission]
    filterset_class = DHCPPoolFilter

    def get_queryset(self):
        return DHCPPool.objects.annotate(
            lease_count=Count("leases", distinct=True),
        ).select_related("subnet", "subnet__project", "subnet__site")

    def destroy(self, request, *args, **kwargs):
        pool = self.get_object()
        if pool.leases.exists():
            return Response(
                {"detail": "Cannot delete pool with existing leases. Remove leases first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class TunnelViewSet(viewsets.ModelViewSet):
    serializer_class = TunnelSerializer
    permission_classes = [ProjectPermission]
    filterset_class = TunnelFilter
    search_fields = ["name", "description"]

    def get_queryset(self):
        qs = Tunnel.objects.select_related("site_a", "site_b", "site_b__project", "project")
        project_pk = self.kwargs.get("project_pk")
        if project_pk:
            qs = qs.filter(project_id=project_pk)
        return qs


class PortProfileViewSet(viewsets.ModelViewSet):
    serializer_class = PortProfileSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        return PortProfile.objects.annotate(entry_count=Count("entries"))


class PortTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = PortTemplateSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        return PortTemplate.objects.filter(profile_id=self.kwargs["profile_pk"])

    def perform_create(self, serializer):
        serializer.save(profile_id=self.kwargs["profile_pk"])

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, profile_pk=None):
        """Create multiple port entries at once."""
        profile = get_object_or_404(PortProfile, pk=profile_pk)
        templates_data = request.data.get("templates", [])
        if not isinstance(templates_data, list) or len(templates_data) == 0:
            return Response(
                {"detail": "Provide a non-empty 'templates' list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(templates_data) > 200:
            return Response(
                {"detail": "Maximum 200 entries per request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        names = [t.get("name", "").strip() for t in templates_data]
        if len(names) != len(set(names)):
            return Response(
                {"detail": "Duplicate names in request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        existing = set(profile.entries.values_list("name", flat=True))
        conflicts = [n for n in names if n in existing]
        if conflicts:
            return Response(
                {"detail": f"Names already exist: {', '.join(conflicts[:10])}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        max_pos = profile.entries.aggregate(m=Max("position"))["m"] or 0
        created = []
        with transaction.atomic():
            for i, tpl_data in enumerate(templates_data, start=1):
                name = tpl_data.get("name", "").strip()
                port_type = tpl_data.get("port_type", "rj45")
                if not name:
                    continue
                obj = PortTemplate.objects.create(
                    profile=profile,
                    name=name,
                    port_type=port_type,
                    position=max_pos + i,
                )
                created.append(obj)
        serializer = self.get_serializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DevicePortViewSet(viewsets.ModelViewSet):
    serializer_class = DevicePortSerializer
    permission_classes = [ProjectPermission]
    filterset_class = DevicePortFilter
    pagination_class = None

    def get_queryset(self):
        return DevicePort.objects.select_related(
            "host", "host__subnet", "host__subnet__site",
            "patch_panel", "patch_panel__site",
        )

    def destroy(self, request, *args, **kwargs):
        port = self.get_object()
        has_cable = Cable.objects.filter(Q(port_a=port) | Q(port_b=port)).exists()
        if has_cable:
            return Response(
                {"detail": "Cannot delete port with connected cable. Remove cable first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class PatchPanelViewSet(viewsets.ModelViewSet):
    serializer_class = PatchPanelSerializer
    permission_classes = [ProjectPermission]
    filterset_class = PatchPanelFilter

    def get_queryset(self):
        return PatchPanel.objects.select_related("site", "site__project").prefetch_related("ports")

    def destroy(self, request, *args, **kwargs):
        pp = self.get_object()
        cables = Cable.objects.filter(
            Q(port_a__patch_panel=pp) | Q(port_b__patch_panel=pp)
        )
        if cables.exists():
            return Response(
                {"detail": "Cannot delete patch panel with connected cables."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class CableViewSet(viewsets.ModelViewSet):
    serializer_class = CableSerializer
    permission_classes = [ProjectPermission]
    filterset_class = CableFilter

    def get_queryset(self):
        return Cable.objects.select_related(
            "port_a__host", "port_a__patch_panel",
            "port_b__host", "port_b__patch_panel",
        )


class PhysicalTopologyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, site_pk):
        from apps.projects.models import Site
        get_object_or_404(Site, pk=site_pk)
        hosts = Host.objects.filter(
            subnet__site_id=site_pk
        ).select_related("subnet", "subnet__site").prefetch_related(
            Prefetch("ports", queryset=DevicePort.objects.order_by("position")),
        )
        patch_panels = PatchPanel.objects.filter(
            site_id=site_pk
        ).prefetch_related(
            Prefetch("ports", queryset=DevicePort.objects.order_by("position")),
        )
        # All cables touching this site (including cross-site)
        site_port_ids = DevicePort.objects.filter(
            Q(host__subnet__site_id=site_pk) | Q(patch_panel__site_id=site_pk)
        ).values_list("id", flat=True)
        cables = Cable.objects.filter(
            Q(port_a_id__in=site_port_ids) | Q(port_b_id__in=site_port_ids)
        ).select_related(
            "port_a__host", "port_a__patch_panel", "port_a__host__subnet__site",
            "port_b__host", "port_b__patch_panel", "port_b__host__subnet__site",
        )

        return Response({
            "hosts": PhysicalHostSerializer(hosts, many=True).data,
            "patch_panels": PhysicalPatchPanelSerializer(patch_panels, many=True).data,
            "cables": PhysicalCableSerializer(cables, many=True).data,
        })


class SubnetInfoView(APIView):
    """Subnet calculator tool."""

    def post(self, request):
        cidr = request.data.get("cidr")
        if not cidr:
            return Response({"detail": "cidr is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            network = ipaddress.ip_network(cidr, strict=False)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "network": str(network.network_address),
            "broadcast": str(network.broadcast_address),
            "netmask": str(network.netmask),
            "wildcard": str(network.hostmask),
            "prefix_length": network.prefixlen,
            "num_addresses": network.num_addresses,
            "num_hosts": max(0, network.num_addresses - 2),
            "first_host": str(list(network.hosts())[0]) if network.num_addresses > 2 else None,
            "last_host": str(list(network.hosts())[-1]) if network.num_addresses > 2 else None,
            "is_private": network.is_private,
        })


class VLSMView(APIView):
    """VLSM subnet partitioning tool."""

    def post(self, request):
        cidr = request.data.get("cidr")
        requirements = request.data.get("requirements", [])

        if not cidr or not requirements:
            return Response(
                {"detail": "cidr and requirements are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            network = ipaddress.ip_network(cidr, strict=False)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Sort requirements by size (largest first)
        sorted_reqs = sorted(requirements, key=lambda r: r.get("hosts", 0), reverse=True)

        results = []
        remaining = [network]

        for req in sorted_reqs:
            hosts_needed = req.get("hosts", 0)
            name = req.get("name", "")

            # Calculate required prefix length
            prefix_len = 32
            while (2 ** (32 - prefix_len) - 2) < hosts_needed:
                prefix_len -= 1

            allocated = False
            for i, avail in enumerate(remaining):
                if avail.prefixlen <= prefix_len:
                    subnets = list(avail.subnets(new_prefix=prefix_len))
                    allocated_subnet = subnets[0]
                    results.append({
                        "name": name,
                        "hosts_requested": hosts_needed,
                        "subnet": str(allocated_subnet),
                        "hosts_available": 2 ** (32 - prefix_len) - 2,
                    })
                    # Remove used block, add remaining
                    remaining.pop(i)
                    remaining.extend(subnets[1:])
                    remaining.sort(key=lambda n: n.network_address)
                    allocated = True
                    break

            if not allocated:
                results.append({
                    "name": name,
                    "hosts_requested": hosts_needed,
                    "subnet": None,
                    "error": "Not enough space",
                })

        return Response({
            "parent": str(network),
            "allocations": results,
            "remaining": [str(r) for r in remaining],
        })
