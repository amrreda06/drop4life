from django.core.management.base import BaseCommand
from api.services import process_expired_bags, sync_inventory_from_bags


class Command(BaseCommand):
    help = 'معالجة ذكية للمخزون: منتهي الصلاحية والمزامنة الشاملة'

    def add_arguments(self, parser):
        parser.add_argument(
            '--process-expired',
            action='store_true',
            help='معالجة الأكياس منتهية الصلاحية فقط',
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='مزامنة شاملة للمخزون من واقع الأكياس',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='تشغيل كل العمليات (الافتراضي)',
        )

    def handle(self, *args, **options):
        # تحديد العمليات
        do_expired = options['process_expired'] or options['all'] or (
            not options['process_expired'] and not options['sync']
        )
        do_sync = options['sync'] or options['all'] or (
            not options['process_expired'] and not options['sync']
        )

        self.stdout.write('🔧 بدء معالجة المخزون الذكية...\n')

        # معالجة الصلاحية
        if do_expired:
            self.stdout.write('📅 معالجة الأكياس منتهية الصلاحية...')
            result = process_expired_bags()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ تمت معالجة {result["processed"]} كيس'
                )
            )
            for blood_type, qty in result['details']:
                self.stdout.write(f'   - {blood_type}: {qty} كيس')

        # مزامنة المخزون
        if do_sync:
            self.stdout.write('\n🔄 مزامنة المخزون من واقع الأكياس...')
            results = sync_inventory_from_bags()
            changes_count = 0
            for bt, data in results.items():
                before = data['before']
                after = data['after']
                if before != after:
                    changes_count += 1
                    self.stdout.write(
                        f'   🔧 {bt}: '
                        f'available {before["available"]}→{after["available"]}, '
                        f'issued {before["issued"]}→{after["issued"]}, '
                        f'expired {before["expired"]}→{after["expired"]}'
                    )
            if changes_count == 0:
                self.stdout.write(self.style.SUCCESS('✅ المخزون متطابق بالفعل'))
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ تمت مزامنة {changes_count} فصيلة')
                )

        self.stdout.write(self.style.SUCCESS('\n✨ انتهت معالجة المخزون بنجاح!'))
