from django.db import migrations, models

PRODUCT_TYPES = ['RBC', 'Plasma', 'Platelets']
BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']


def migrate_inventory_keys(apps, schema_editor):
    BloodInventory = apps.get_model('api', 'BloodInventory')
    for inv in list(BloodInventory.objects.all()):
        bt = inv.blood_type
        if '|' in bt:
            continue
        data = {
            'available': inv.available,
            'reserved': inv.reserved,
            'issued': inv.issued,
            'expired': inv.expired,
            'critical_limit': inv.critical_limit,
        }
        inv.delete()
        BloodInventory.objects.create(blood_type=f'{bt}|RBC', **data)
        for pt in ('Plasma', 'Platelets'):
            BloodInventory.objects.get_or_create(
                blood_type=f'{bt}|{pt}',
                defaults={
                    'available': 0,
                    'reserved': 0,
                    'issued': 0,
                    'expired': 0,
                    'critical_limit': data['critical_limit'],
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_bloodrequest_reserved_bag_ids'),
    ]

    operations = [
        migrations.AddField(
            model_name='bloodbag',
            name='product_type',
            field=models.CharField(default='RBC', max_length=20, verbose_name='نوع المكون'),
        ),
        migrations.AddField(
            model_name='bloodrequest',
            name='product_type',
            field=models.CharField(default='RBC', max_length=20, verbose_name='نوع المكون'),
        ),
        migrations.AddField(
            model_name='beneficiary',
            name='product_type_received',
            field=models.CharField(default='RBC', max_length=20, verbose_name='نوع المكون المستهلك'),
        ),
        migrations.AddField(
            model_name='disposallog',
            name='product_type',
            field=models.CharField(default='RBC', max_length=20, verbose_name='نوع المكون'),
        ),
        migrations.AddField(
            model_name='hospitaldeliveryrecord',
            name='product_type',
            field=models.CharField(default='RBC', max_length=20, verbose_name='نوع المكون'),
        ),
        migrations.AlterField(
            model_name='bloodinventory',
            name='blood_type',
            field=models.CharField(max_length=20, primary_key=True, serialize=False),
        ),
        migrations.RunPython(migrate_inventory_keys, migrations.RunPython.noop),
    ]
