from django.urls import path

from . import views

urlpatterns = [
    path("exports/project/<int:project_id>/excel/", views.ProjectExcelView.as_view(), name="export-excel"),
    path("exports/project/<int:project_id>/pdf/", views.ProjectPDFView.as_view(), name="export-pdf"),
]
