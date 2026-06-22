from django.db import migrations, models


LEGACY_ROLE_TO_CODE = {
    'superadmin': 'DR',
    'admin': 'ADM',
    'deputy': 'DPM',
    'lab': 'MLS',
}


def forwards(apps, schema_editor):
    Account = apps.get_model('api', 'Account')
    for account in Account.objects.all().iterator():
        legacy_role = str(getattr(account, 'role', '') or '').strip().lower()
        account.role_code = LEGACY_ROLE_TO_CODE.get(legacy_role, 'MLS')
        account.save(update_fields=['role_code'])


def backwards(apps, schema_editor):
    Account = apps.get_model('api', 'Account')
    for account in Account.objects.all().iterator():
        role_code = str(getattr(account, 'role_code', '') or '').strip().upper()
        if role_code == 'DR':
            account.role = 'superadmin'
        elif role_code == 'ADM':
            account.role = 'admin'
        elif role_code == 'DPM':
            account.role = 'deputy'
        else:
            account.role = 'lab'
        account.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_account_phone_it_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='role_code',
            field=models.CharField(choices=[('DR', 'سوبر أدمن'), ('ADM', 'أدمن'), ('DPM', 'نائب مدير'), ('MLS', 'معمل')], default='MLS', max_length=10),
        ),
        migrations.RunPython(forwards, backwards),
    ]