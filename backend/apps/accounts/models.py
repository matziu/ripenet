from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.VIEWER)

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.username

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_editor(self):
        return self.role in (self.Role.ADMIN, self.Role.EDITOR)
