from django.db import models


class PortProfile(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "ipam_port_profile"
        ordering = ["name"]

    def __str__(self):
        return self.name
