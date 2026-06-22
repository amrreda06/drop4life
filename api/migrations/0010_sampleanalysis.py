# Generated migration for SampleAnalysis model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_account_role_code'),
    ]

    operations = [
        migrations.CreateModel(
            name='SampleAnalysis',
            fields=[
                ('confirmed_blood_type', models.CharField(blank=True, default='', max_length=5, verbose_name='فصيلة الدم المؤكدة')),
                ('detected_diseases', models.JSONField(default=list, help_text='قائمة الأمراض المكتشفة أثناء الفحص', verbose_name='الأمراض المكتشفة')),
                ('status', models.CharField(choices=[('Pending', 'قيد التحليل'), ('Approved', 'معتمد'), ('Rejected', 'مرفوض')], db_index=True, default='Pending', max_length=20, verbose_name='حالة التحليل')),
                ('analyzed_at', models.DateTimeField(blank=True, null=True, verbose_name='وقت التحليل')),
                ('rejection_reason', models.TextField(blank=True, default='', verbose_name='سبب الرفض')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('analyzed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='lab_analyses', to='api.account', verbose_name='الفاحص')),
                ('bag', models.OneToOneField(db_column='bag_id', on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name='sample_analysis', serialize=False, to='api.bloodbag')),
            ],
            options={
                'verbose_name': 'تحليل العينة',
                'verbose_name_plural': 'تحليلات العينات',
                'ordering': ['-created_at', '-pk'],
            },
        ),
    ]
