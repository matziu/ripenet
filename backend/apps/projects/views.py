from django.db.models import Count, Prefetch, Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.ipam.models import VLAN, Host, Subnet, Tunnel
from apps.ipam.permissions import ProjectPermission
from apps.ipam.serializers import ProjectTopologySerializer

from .models import Project, Site
from .serializers import ProjectListSerializer, ProjectSerializer, SiteSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [ProjectPermission]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return Project.objects.annotate(
            site_count=Count("sites", distinct=True),
        ).select_related("created_by")

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        return ProjectSerializer

    @method_decorator(cache_page(30))
    @action(detail=True, methods=["get"], url_path="topology")
    def topology(self, request, pk=None):
        """Full project topology for visualization."""
        project = self.get_object()

        sites = (
            Site.objects.filter(project=project)
            .prefetch_related(
                "wan_addresses",
                Prefetch(
                    "vlans",
                    queryset=VLAN.objects.prefetch_related(
                        Prefetch(
                            "subnets",
                            queryset=Subnet.objects.prefetch_related(
                                Prefetch(
                                    "hosts",
                                    queryset=Host.objects.all(),
                                )
                            ),
                        )
                    ),
                ),
                Prefetch(
                    "subnets",
                    queryset=Subnet.objects.filter(vlan__isnull=True).prefetch_related("hosts"),
                ),
            )
        )

        tunnels = Tunnel.objects.filter(
            Q(project=project) | Q(site_b__project=project)
        ).select_related("site_a", "site_b", "site_b__project").distinct()

        data = {
            "sites": sites,
            "tunnels": tunnels,
            "standalone_subnets": Subnet.objects.none(),
        }
        serializer = ProjectTopologySerializer(data)
        return Response(serializer.data)


class SiteViewSet(viewsets.ModelViewSet):
    serializer_class = SiteSerializer
    permission_classes = [ProjectPermission]
    search_fields = ["name", "address"]

    def get_queryset(self):
        qs = Site.objects.annotate(
            vlan_count=Count("vlans", distinct=True),
            host_count=Count("vlans__subnets__hosts", distinct=True),
        ).prefetch_related("wan_addresses")
        project_pk = self.kwargs.get("project_pk")
        if project_pk:
            qs = qs.filter(project_id=project_pk)
        return qs

    def perform_create(self, serializer):
        project_pk = self.kwargs.get("project_pk")
        if project_pk:
            serializer.save(project_id=project_pk)
        else:
            serializer.save()
