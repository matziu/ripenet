from django.db import models


class DeviceType(models.Model):
    value = models.CharField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_device_type"
        ordering = ["position", "label"]

    def __str__(self):
        return self.label
