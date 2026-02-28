from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"vlans", views.VLANViewSet, basename="vlan")
router.register(r"subnets", views.SubnetViewSet, basename="subnet")
router.register(r"hosts", views.HostViewSet, basename="host")
router.register(r"tunnels", views.TunnelViewSet, basename="tunnel")
router.register(r"dhcp-pools", views.DHCPPoolViewSet, basename="dhcppool")
router.register(r"device-types", views.DeviceTypeViewSet, basename="devicetype")
router.register(r"port-profiles", views.PortProfileViewSet, basename="portprofile")
router.register(r"ports", views.DevicePortViewSet, basename="deviceport")
router.register(r"patch-panels", views.PatchPanelViewSet, basename="patchpanel")
router.register(r"cables", views.CableViewSet, basename="cable")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "port-profiles/<int:profile_pk>/entries/",
        views.PortTemplateViewSet.as_view({"get": "list", "post": "create"}),
        name="port-profile-entry-list",
    ),
    path(
        "port-profiles/<int:profile_pk>/entries/bulk-create/",
        views.PortTemplateViewSet.as_view({"post": "bulk_create"}),
        name="port-profile-entry-bulk-create",
    ),
    path(
        "port-profiles/<int:profile_pk>/entries/<int:pk>/",
        views.PortTemplateViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="port-profile-entry-detail",
    ),
    path(
        "sites/<int:site_pk>/physical-topology/",
        views.PhysicalTopologyView.as_view(),
        name="physical-topology",
    ),
]
