from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_notification_per_user'),
    ]

    operations = [
        migrations.CreateModel(
            name='Beneficiary',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='الاسم')),
                ('phone', models.CharField(max_length=20, verbose_name='رقم الهاتف')),
                ('national_id', models.CharField(max_length=20, verbose_name='رقم البطاقة')),
                ('blood_type_received', models.CharField(max_length=5, verbose_name='نوع الفصيلة المستهلكة')),
                ('bags_consumed', models.IntegerField(default=1, verbose_name='عدد الأكياس المستهلكة')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Beneficiary',
                'verbose_name_plural': 'Beneficiaries',
                'ordering': ['-created_at', '-pk'],
            },
        ),
    ]
