from django.conf import settings
from django.db import models


class ProjectTemplate(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    structure = models.JSONField(
        default=dict,
        help_text="JSON with VLAN definitions, subnet patterns, etc.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "templates_projecttemplate"
        ordering = ["name"]

    def __str__(self):
        return self.name
