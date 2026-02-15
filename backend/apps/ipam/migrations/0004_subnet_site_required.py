"""Make subnet.site required (non-nullable)."""

import django.db.models.deletion
from django.db import migrations, models


def assign_site_to_orphans(apps, schema_editor):
    """Assign project's first site to any subnet missing a site."""
    Subnet = apps.get_model("ipam", "Subnet")
    Site = apps.get_model("projects", "Site")
    for subnet in Subnet.objects.filter(site__isnull=True).select_related("project"):
        first_site = Site.objects.filter(project=subnet.project).first()
        if first_site:
            subnet.site = first_site
            subnet.save(update_fields=["site_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("ipam", "0003_subnet_project_site_nullable_vlan"),
    ]

    operations = [
        migrations.RunPython(assign_site_to_orphans, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="subnet",
            name="site",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subnets",
                to="projects.site",
            ),
        ),
    ]
