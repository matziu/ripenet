from django.conf import settings
from django.db import models
from netfields import CidrAddressField


class Project(models.Model):
    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNING)
    supernet = CidrAddressField(blank=True, null=True, help_text="Top-level address space for this project")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_project"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Site(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sites")
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    supernet = CidrAddressField(blank=True, null=True, help_text="Override. Null = inherit from project.")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_site"
        ordering = ["name"]
        unique_together = [("project", "name")]

    def __str__(self):
        return f"{self.name} ({self.project.name})"


class SiteWanAddress(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="wan_addresses")
    ip_address = models.CharField(max_length=255, help_text="WAN IP or DNS hostname (e.g. 203.0.113.1, office.dyndns.org)")
    label = models.CharField(max_length=100, help_text="e.g. ISP1, Fiber, LTE backup")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["label"]
