from django.db.models import Q, Value, CharField
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ipam.models import VLAN, Host, Subnet
from apps.projects.models import Project, Site


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response({"results": []})

        results = []

        # Search hosts by IP or hostname
        hosts = Host.objects.filter(
            Q(hostname__icontains=q) | Q(ip_address__startswith=q) | Q(description__icontains=q)
        ).select_related(
            "subnet__project", "subnet__site", "subnet__vlan"
        )[:10]

        for host in hosts:
            parts = [host.subnet.project.name]
            if host.subnet.site:
                parts.append(host.subnet.site.name)
            if host.subnet.vlan:
                parts.append(f"VLAN {host.subnet.vlan.vlan_id}")
            results.append({
                "type": "host",
                "id": host.id,
                "label": str(host.ip_address),
                "secondary": host.hostname,
                "breadcrumb": " > ".join(parts),
                "project_id": host.subnet.project_id,
                "site_id": host.subnet.site_id,
                "vlan_id": host.subnet.vlan_id if host.subnet.vlan else None,
                "subnet_id": host.subnet_id,
            })

        # Search subnets
        subnets = Subnet.objects.filter(
            Q(description__icontains=q) | Q(network__startswith=q)
        ).select_related("project", "site", "vlan")[:10]

        for subnet in subnets:
            parts = [subnet.project.name]
            if subnet.site:
                parts.append(subnet.site.name)
            if subnet.vlan:
                parts.append(f"VLAN {subnet.vlan.vlan_id}")
            results.append({
                "type": "subnet",
                "id": subnet.id,
                "label": str(subnet.network),
                "secondary": subnet.description,
                "breadcrumb": " > ".join(parts),
                "project_id": subnet.project_id,
                "site_id": subnet.site_id,
                "vlan_id": subnet.vlan_id,
            })

        # Search VLANs
        vlans = VLAN.objects.filter(
            Q(name__icontains=q) | Q(purpose__icontains=q)
        ).select_related("site__project")[:10]

        for vlan in vlans:
            results.append({
                "type": "vlan",
                "id": vlan.id,
                "label": f"VLAN {vlan.vlan_id} - {vlan.name}",
                "secondary": vlan.purpose,
                "breadcrumb": f"{vlan.site.project.name} > {vlan.site.name}",
                "project_id": vlan.site.project_id,
                "site_id": vlan.site_id,
            })

        # Search sites
        sites = Site.objects.filter(
            Q(name__icontains=q) | Q(address__icontains=q)
        ).select_related("project")[:10]

        for site in sites:
            results.append({
                "type": "site",
                "id": site.id,
                "label": site.name,
                "secondary": site.address,
                "breadcrumb": site.project.name,
                "project_id": site.project_id,
            })

        # Search projects
        projects = Project.objects.filter(
            Q(name__icontains=q) | Q(description__icontains=q)
        )[:5]

        for project in projects:
            results.append({
                "type": "project",
                "id": project.id,
                "label": project.name,
                "secondary": project.description[:100] if project.description else "",
                "breadcrumb": "",
                "project_id": project.id,
            })

        return Response({"results": results})
