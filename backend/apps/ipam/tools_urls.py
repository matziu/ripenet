from django.urls import path

from . import views

urlpatterns = [
    path("subnet-info/", views.SubnetInfoView.as_view(), name="subnet-info"),
    path("vlsm/", views.VLSMView.as_view(), name="vlsm"),
]
