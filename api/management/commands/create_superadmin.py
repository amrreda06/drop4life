from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from api.auth_backend import set_account_password
from api.models import Account
from api.services import DEFAULT_SUPERADMIN_PASSWORD, SUPERADMIN_USERNAME, push_audit


class Command(BaseCommand):
    help = (
        'Create superadmin if missing. Does not change an existing password '
        'unless --reset-password is passed.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=DEFAULT_SUPERADMIN_PASSWORD,
            help='Password used only when creating superadmin or with --reset-password.',
        )
        parser.add_argument(
            '--reset-password',
            action='store_true',
            help='Force-reset superadmin password to --password (existing accounts only).',
        )

    def handle(self, *args, **options):
        password = options['password']
        account = Account.objects.filter(username=SUPERADMIN_USERNAME).first()

        if account:
            if not options['reset_password']:
                self.stdout.write(self.style.SUCCESS('Superadmin already exists — password unchanged.'))
                self.stdout.write(f'Username: {SUPERADMIN_USERNAME}')
                return

            set_account_password(account, password)
            push_audit('system', 'Engine', 'تحديث الحساب', 'تم إعادة تعيين كلمة مرور superadmin يدوياً.')
            self.stdout.write(self.style.SUCCESS('Superadmin password reset.'))
            self.stdout.write(f'Username: {SUPERADMIN_USERNAME}')
            self.stdout.write(f'Password: {password}')
            return

        account = Account.objects.create(
            username=SUPERADMIN_USERNAME,
            name='مدير النظام',
            role='superadmin',
            email='admin@drop4life.org',
            password=make_password(password),
            status='active',
        )
        set_account_password(account, password)
        push_audit('system', 'Engine', 'تهيئة النظام', 'تم إنشاء حساب superadmin الافتراضي.')
        self.stdout.write(self.style.SUCCESS('Superadmin account created.'))
        self.stdout.write(f'Username: {SUPERADMIN_USERNAME}')
        self.stdout.write(f'Password: {password}')
