from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_remove_deputy_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='beneficiary',
            name='consumed_bag_ids',
            field=models.JSONField(blank=True, default=list, verbose_name='أكياس مستهلكة'),
        ),
    ]
