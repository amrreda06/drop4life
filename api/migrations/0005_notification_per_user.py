from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_delete_deviceaccess'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='read_by',
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name='notification',
            name='deleted_by',
            field=models.JSONField(default=list),
        ),
    ]
