"""Add project/site FKs to Subnet, make vlan nullable."""

import django.db.models.deletion
from django.db import migrations, models


def populate_project_and_site(apps, schema_editor):
    """Back-fill project and site from vlan -> site -> project."""
    Subnet = apps.get_model("ipam", "Subnet")
    for subnet in Subnet.objects.select_related("vlan__site__project").all():
        subnet.project_id = subnet.vlan.site.project_id
        subnet.site_id = subnet.vlan.site_id
        subnet.save(update_fields=["project_id", "site_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("ipam", "0002_remove_host_status_add_nas"),
        ("projects", "0001_initial"),
    ]

    operations = [
        # 1. Add project FK (temporarily nullable for back-fill)
        migrations.AddField(
            model_name="subnet",
            name="project",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subnets",
                to="projects.project",
            ),
        ),
        # 2. Add site FK (nullable)
        migrations.AddField(
            model_name="subnet",
            name="site",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subnets",
                to="projects.site",
            ),
        ),
        # 3. Back-fill project and site from vlan
        migrations.RunPython(populate_project_and_site, migrations.RunPython.noop),
        # 4. Make project non-nullable
        migrations.AlterField(
            model_name="subnet",
            name="project",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subnets",
                to="projects.project",
            ),
        ),
        # 5. Make vlan nullable
        migrations.AlterField(
            model_name="subnet",
            name="vlan",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subnets",
                to="ipam.vlan",
            ),
        ),
    ]
