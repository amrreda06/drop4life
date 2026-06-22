from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_beneficiary_consumed_bag_ids'),
    ]

    operations = [
        migrations.AddField(
            model_name='bloodrequest',
            name='reserved_bag_ids',
            field=models.JSONField(blank=True, default=list, verbose_name='أكياس محجوزة'),
        ),
    ]
