from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("ipam", "0012_port_profile_data"),
    ]

    operations = [
        # Remove old device_type FK from PortTemplate
        migrations.RemoveField(
            model_name="porttemplate",
            name="device_type",
        ),
        # Make profile NOT NULL
        migrations.AlterField(
            model_name="porttemplate",
            name="profile",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entries",
                to="ipam.portprofile",
            ),
        ),
        # Add new unique_together
        migrations.AlterUniqueTogether(
            name="porttemplate",
            unique_together={("profile", "name")},
        ),
    ]
