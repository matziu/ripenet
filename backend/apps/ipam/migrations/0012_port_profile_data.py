from django.db import migrations


def migrate_templates_to_profiles(apps, schema_editor):
    DeviceType = apps.get_model("ipam", "DeviceType")
    PortProfile = apps.get_model("ipam", "PortProfile")
    PortTemplate = apps.get_model("ipam", "PortTemplate")

    for dt in DeviceType.objects.all():
        templates = PortTemplate.objects.filter(device_type=dt)
        if not templates.exists():
            continue
        profile, _ = PortProfile.objects.get_or_create(
            name=dt.label,
            defaults={"description": f"Migrated from device type: {dt.value}"},
        )
        templates.update(profile=profile)


def reverse_migration(apps, schema_editor):
    # No reverse needed — the next migration removes device_type FK anyway
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("ipam", "0011_port_profile_step1"),
    ]

    operations = [
        migrations.RunPython(migrate_templates_to_profiles, reverse_migration),
    ]
