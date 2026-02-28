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
router.register(r"ports", views.DevicePortViewSet, basename="deviceport")
router.register(r"patch-panels", views.PatchPanelViewSet, basename="patchpanel")
router.register(r"cables", views.CableViewSet, basename="cable")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "device-types/<int:device_type_pk>/port-templates/",
        views.PortTemplateViewSet.as_view({"get": "list", "post": "create"}),
        name="port-template-list",
    ),
    path(
        "device-types/<int:device_type_pk>/port-templates/apply/",
        views.PortTemplateViewSet.as_view({"post": "apply"}),
        name="port-template-apply",
    ),
    path(
        "device-types/<int:device_type_pk>/port-templates/<int:pk>/",
        views.PortTemplateViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="port-template-detail",
    ),
]
