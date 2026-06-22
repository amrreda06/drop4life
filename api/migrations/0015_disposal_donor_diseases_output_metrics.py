from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_blood_product_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='disposallog',
            name='donor_name',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='اسم المتبرع'),
        ),
        migrations.AddField(
            model_name='disposallog',
            name='detected_diseases',
            field=models.JSONField(blank=True, default=list, verbose_name='الأمراض المكتشفة'),
        ),
        migrations.CreateModel(
            name='SystemMetricsConfig',
            fields=[
                ('singleton_key', models.CharField(default='default', max_length=20, primary_key=True, serialize=False)),
                ('blood_output_cleared_at', models.DateTimeField(blank=True, null=True, verbose_name='بداية احتساب إخراج الدم')),
            ],
        ),
    ]
