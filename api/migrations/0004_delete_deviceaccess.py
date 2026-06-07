from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_device_access'),
    ]

    operations = [
        migrations.DeleteModel(
            name='DeviceAccess',
        ),
    ]
