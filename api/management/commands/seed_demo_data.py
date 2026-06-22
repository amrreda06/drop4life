from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.contrib.sessions.models import Session

from api.auth_backend import set_account_password
from api.models import (
    Account,
    AuditLog,
    Beneficiary,
    BloodBag,
    BloodInventory,
    BloodRequest,
    DisposalLog,
    Hospital,
    HospitalDeliveryRecord,
    Message,
    Notification,
    PendingDonor,
    SampleAnalysis,
)
from api import services


class Command(BaseCommand):
    help = 'Seed realistic demo data for Drop4Life so the system looks populated.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default='Demo@12345',
            help='Password for demo accounts.',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe operational data before seeding demo records.',
        )

    def handle(self, *args, **options):
        if options['reset']:
            services.reset_operational_data()

        services.setup_empty_system(superadmin_password=options['password'])
        self._seed_accounts(options['password'])
        self._seed_storage_and_inventory()
        self._seed_blood_bags()
        self._seed_requests_and_deliveries()
        self._seed_beneficiaries_and_lab_data()
        self._seed_notifications_and_audit()

        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully.'))
        self.stdout.write('Login users: superadmin / admin1 / lab1')
        self.stdout.write(f"Shared password: {options['password']}")

    def _seed_accounts(self, password):
        accounts = [
            ('admin1', 'أدمن العمليات', 'admin', 'ADM', 'admin1@drop4life.org'),
            ('lab1', 'مسؤول المعمل', 'lab', 'MLS', 'lab1@drop4life.org'),
        ]
        for username, name, role, role_code, email in accounts:
            account, _ = Account.objects.get_or_create(
                username=username,
                defaults={
                    'name': name,
                    'role': role,
                    'role_code': role_code,
                    'email': email,
                    'phone': '',
                    'status': 'active',
                },
            )
            account.name = name
            account.role = role
            account.role_code = role_code
            account.email = email
            account.status = 'active'
            account.save()
            set_account_password(account, password)

    def _seed_storage_and_inventory(self):
        config = services.get_storage_config()
        config.total_rooms = 3
        config.total_fridges_per_room = 2
        config.total_shelves_per_fridge = 4
        config.capacity_per_shelf = 100
        config.room_names = ['Room A', 'Room B', 'Room C']
        config.details = services.default_storage_details(3, 2, 4)
        config.save()
        services.rebuild_storage_rooms(config)

        inventory_targets = {
            'A+': (46, 4, 8, 1, 30),
            'A-': (18, 2, 3, 0, 15),
            'B+': (38, 3, 5, 1, 25),
            'B-': (14, 1, 2, 0, 15),
            'AB+': (22, 1, 2, 0, 20),
            'AB-': (9, 1, 1, 0, 10),
            'O+': (58, 6, 10, 2, 40),
            'O-': (27, 3, 4, 1, 25),
        }
        for blood_type, values in inventory_targets.items():
            available, reserved, issued, expired, critical = values
            inv, _ = BloodInventory.objects.get_or_create(
                blood_type=blood_type,
                defaults={'critical_limit': critical},
            )
            inv.available = available
            inv.reserved = reserved
            inv.issued = issued
            inv.expired = expired
            inv.critical_limit = critical
            inv.save()

    def _seed_blood_bags(self):
        today = date.today()
        room_cycle = [
            ('Room A', 'Fridge 1', 'Shelf 1'),
            ('Room A', 'Fridge 2', 'Shelf 2'),
            ('Room B', 'Fridge 1', 'Shelf 3'),
            ('Room B', 'Fridge 2', 'Shelf 4'),
            ('Room C', 'Fridge 1', 'Shelf 1'),
            ('Room C', 'Fridge 2', 'Shelf 2'),
        ]
        bag_specs = [
            ('BAG-0201', 'أحمد سامي', 'A+', 1, 'Approved', 5),
            ('BAG-0202', 'مجهول', 'O+', 1, 'Pending', 18),
            ('BAG-0203', 'منى حسن', 'B+', 1, 'Approved', 12),
            ('BAG-0204', 'مجهول', 'AB-', 1, 'Rejected', 2),
            ('BAG-0205', 'محمد عادل', 'O-', 1, 'Approved', 22),
            ('BAG-0206', 'مجهول', 'A-', 1, 'Pending', 8),
            ('BAG-0207', 'سارة يونس', 'AB+', 1, 'Approved', 15),
            ('BAG-0208', 'مجهول', 'B-', 1, 'Pending', 20),
            ('BAG-0209', 'خالد إبراهيم', 'O+', 1, 'Approved', 3),
            ('BAG-0210', 'مجهول', 'A+', 1, 'Pending', 10),
            ('BAG-0211', 'هبة محمود', 'B+', 1, 'Approved', 28),
            ('BAG-0212', 'مجهول', 'O-', 1, 'Rejected', 7),
        ]

        for index, (bag_id, donor, blood_type, qty, status, age_days) in enumerate(bag_specs):
            room_name, fridge_name, shelf_name = room_cycle[index % len(room_cycle)]
            BloodBag.objects.update_or_create(
                bag_id=bag_id,
                defaults={
                    'donor': donor,
                    'blood_type': blood_type,
                    'qty': qty,
                    'date': today - timedelta(days=age_days),
                    'expiry': today + timedelta(days=max(7, 42 - age_days)),
                    'location': f'{room_name} / {fridge_name} / {shelf_name}',
                    'status': status,
                },
            )
            if status == 'Pending':
                PendingDonor.objects.update_or_create(
                    bag_id=bag_id,
                    defaults={
                        'name': donor,
                        'national_id': f'2980{index:06d}',
                        'age': 24 + index,
                        'phone': f'01000010{index:02d}',
                        'address': 'القاهرة',
                        'room': room_name,
                        'fridge': fridge_name,
                    },
                )
        for bag in BloodBag.objects.filter(bag_id__in=['BAG-0201', 'BAG-0203', 'BAG-0205', 'BAG-0207', 'BAG-0209', 'BAG-0211']):
            SampleAnalysis.objects.update_or_create(
                bag=bag,
                defaults={
                    'confirmed_blood_type': bag.blood_type,
                    'detected_diseases': [] if bag.bag_id != 'BAG-0211' else ['فقر دم بسيط'],
                    'status': 'Approved' if bag.bag_id != 'BAG-0211' else 'Rejected',
                    'analyzed_at': services.timezone.localtime(),
                    'analyzed_by': Account.objects.filter(username='lab1').first(),
                    'rejection_reason': '' if bag.bag_id != 'BAG-0211' else 'نتائج غير مطابقة',
                },
            )

    def _seed_requests_and_deliveries(self):
        hospitals = [
            ('مستشفى النور', 'المعادي', 'د. ليلى عزام', '01220001001', 'Connected'),
            ('مستشفى الرحمة', 'مدينة نصر', 'د. حسام فاروق', '01220001002', 'Connected'),
            ('مستشفى الشفاء', 'الجيزة', 'د. منى زكي', '01220001003', 'Connected'),
        ]
        for name, address, manager, phone, status in hospitals:
            Hospital.objects.update_or_create(
                name=name,
                defaults={
                    'address': address,
                    'manager': manager,
                    'phone': phone,
                    'status': status,
                },
            )

        requests = [
            ('REQ-401', 'مستشفى النور', 'O+', 3, 'عادي', 'تم القبول'),
            ('REQ-402', 'مستشفى الرحمة', 'A+', 2, 'هام', 'تم التسليم'),
            ('REQ-403', 'مستشفى الشفاء', 'AB-', 1, 'حرج', 'قيد المراجعة'),
            ('REQ-404', 'مستشفى النور', 'B+', 4, 'عادي', 'تم الرفض'),
        ]
        for request_id, hospital, blood, qty, priority, status in requests:
            BloodRequest.objects.update_or_create(
                request_id=request_id,
                defaults={
                    'hospital': hospital,
                    'blood': blood,
                    'qty': qty,
                    'priority': priority,
                    'status': status,
                },
            )

        HospitalDeliveryRecord.objects.update_or_create(
            record_id='REQ-402',
            defaults={
                'hospital': 'مستشفى الرحمة',
                'blood': 'A+',
                'qty': 2,
                'priority': 'هام',
                'recipient': 'أ.ريم صبري',
                'recipient_phone': '01120002002',
                'delivery_notes': 'تم التسليم بنجاح من المخزن الرئيسي.',
                'delivered_by': 'superadmin',
                'delivered_at': date.today() - timedelta(days=1),
            },
        )

    def _seed_beneficiaries_and_lab_data(self):
        beneficiaries = [
            ('سارة علي', '01090001111', '29801234567890', 'A+', 2),
            ('أحمد شوقي', '01090002222', '29801234567891', 'O+', 1),
            ('منى مصطفى', '01090003333', '29801234567892', 'B+', 3),
        ]
        for name, phone, national_id, blood_type, bags in beneficiaries:
            Beneficiary.objects.update_or_create(
                national_id=national_id,
                defaults={
                    'name': name,
                    'phone': phone,
                    'blood_type_received': blood_type,
                    'bags_consumed': bags,
                },
            )

        lab_account = Account.objects.filter(username='lab1').first()
        for bag_id, blood_type, diseases, status in [
            ('BAG-0201', 'A+', [], 'Approved'),
            ('BAG-0203', 'B+', [], 'Approved'),
            ('BAG-0205', 'O-', ['فيروسات غير مطابقة'], 'Rejected'),
        ]:
            bag = BloodBag.objects.filter(bag_id=bag_id).first()
            if not bag:
                continue
            SampleAnalysis.objects.update_or_create(
                bag=bag,
                defaults={
                    'confirmed_blood_type': blood_type,
                    'detected_diseases': diseases,
                    'status': status,
                    'analyzed_at': services.timezone.localtime(),
                    'analyzed_by': lab_account,
                    'rejection_reason': 'تم الرفض لوجود مؤشر مرضي.' if status == 'Rejected' else '',
                },
            )

    def _seed_notifications_and_audit(self):
        notifications = [
            ('تنبيه مخزون O-', 'lab', 'انخفض المخزون الحرِج لفصيلة O- إلى ما دون الحد الآمن.'),
            ('تنبيه مخزون AB-', 'lab', 'الفصيلة AB- تحتاج دعمًا عاجلًا من حملات التبرع.'),
            ('تسليم مستشفى', 'hospital', 'تم تسليم شحنة طوارئ لمستشفى الرحمة بنجاح.'),
        ]
        for title, ntype, message in notifications:
            Notification.objects.update_or_create(
                title=title,
                defaults={
                    'notification_type': ntype,
                    'time': date.today().strftime('%Y-%m-%d %H:%M'),
                    'message': message,
                    'read': False,
                    'read_by': [],
                    'deleted_by': [],
                },
            )

        Message.objects.all().delete()
        sender = Account.objects.filter(username='admin1').first()
        Message.objects.create(
            sender=sender,
            time=date.today().strftime('%Y-%m-%d %H:%M'),
            text='تم تحديث حالة المخزون وأصبحت البيانات التجريبية جاهزة للعرض.',
            seen_by=[],
        )

        AuditLog.objects.update_or_create(
            action='تهيئة بيانات تجريبية',
            defaults={
                'time': date.today().strftime('%Y-%m-%d %H:%M'),
                'user': 'superadmin',
                'role': 'System',
                'details': 'تم ملء النظام ببيانات تجريبية شاملة لعرض الواجهات.',
            },
        )

        Session.objects.all().delete()