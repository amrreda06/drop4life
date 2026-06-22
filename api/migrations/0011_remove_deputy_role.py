from django.db import migrations, models


def migrate_deputy_to_admin(apps, schema_editor):
    Account = apps.get_model('api', 'Account')
    Account.objects.filter(role='deputy').update(role='admin', role_code='ADM')
    Account.objects.filter(role_code='DPM').update(role='admin', role_code='ADM')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_sampleanalysis'),
    ]

    operations = [
        migrations.RunPython(migrate_deputy_to_admin, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='account',
            name='role',
            field=models.CharField(
                choices=[
                    ('superadmin', 'Super Admin'),
                    ('admin', 'Admin'),
                    ('lab', 'Lab'),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='account',
            name='role_code',
            field=models.CharField(
                choices=[
                    ('DR', 'سوبر أدمن'),
                    ('ADM', 'أدمن'),
                    ('MLS', 'معمل'),
                ],
                default='MLS',
                max_length=10,
            ),
        ),
    ]
