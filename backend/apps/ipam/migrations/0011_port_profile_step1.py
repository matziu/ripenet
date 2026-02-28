from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("ipam", "0010_device_type_color"),
    ]

    operations = [
        # Create PortProfile table
        migrations.CreateModel(
            name="PortProfile",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "db_table": "ipam_port_profile",
                "ordering": ["name"],
            },
        ),
        # Remove old unique_together on PortTemplate
        migrations.AlterUniqueTogether(
            name="porttemplate",
            unique_together=set(),
        ),
        # Add nullable profile FK to PortTemplate
        migrations.AddField(
            model_name="porttemplate",
            name="profile",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entries",
                to="ipam.portprofile",
            ),
        ),
    ]
