from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"vlans", views.VLANViewSet, basename="vlan")
router.register(r"subnets", views.SubnetViewSet, basename="subnet")
router.register(r"hosts", views.HostViewSet, basename="host")
router.register(r"tunnels", views.TunnelViewSet, basename="tunnel")
router.register(r"dhcp-pools", views.DHCPPoolViewSet, basename="dhcppool")

urlpatterns = [
    path("", include(router.urls)),
]
