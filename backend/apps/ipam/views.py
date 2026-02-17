import ipaddress

from django.db.models import Count, Q
from django.db.models.expressions import RawSQL
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import HostFilter, SubnetFilter, TunnelFilter, VLANFilter, DHCPPoolFilter
from .models import VLAN, Host, Subnet, Tunnel, DHCPPool
from .permissions import ProjectPermission
from .serializers import HostSerializer, SubnetSerializer, TunnelSerializer, VLANSerializer, DHCPPoolSerializer


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
        """Suggest the next available IP address in this subnet."""
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

        # Skip network and broadcast addresses
        hosts = list(network.hosts())
        for ip in hosts:
            if str(ip) not in used_ips:
                return Response({"next_free_ip": str(ip)})

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
