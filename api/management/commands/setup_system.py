from django.core.management.base import BaseCommand

from api import services
from api.auth_backend import set_account_password
from api.models import Account


class Command(BaseCommand):
    help = 'Initialize empty Drop4Life system (no demo records). Creates superadmin if missing.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=services.DEFAULT_SUPERADMIN_PASSWORD,
            help='Initial password only when superadmin is created or with --reset-password.',
        )
        parser.add_argument(
            '--reset-data',
            action='store_true',
            help='Delete all operational data and keep only structure + superadmin.',
        )
        parser.add_argument(
            '--reset-password',
            action='store_true',
            help='With --reset-data, also reset superadmin password to --password.',
        )
        parser.add_argument(
            '--factory-reset',
            action='store_true',
            help='Same as --reset-data: wipe all user data and return to a fresh empty system.',
        )

    def handle(self, *args, **options):
        reset = options['reset_data'] or options['factory_reset']
        if reset:
            self.stdout.write('Clearing all operational data...')
            services.reset_operational_data()

        superadmin = Account.objects.filter(username=services.SUPERADMIN_USERNAME).first()
        if reset and options['reset_password'] and superadmin:
            set_account_password(superadmin, options['password'])
            self.stdout.write(self.style.WARNING('Superadmin password was reset.'))

        superadmin_existed = superadmin is not None
        services.setup_empty_system(superadmin_password=options['password'])
        self.stdout.write(self.style.SUCCESS('System ready — empty site with no demo data.'))
        self.stdout.write('Login: superadmin')
        if superadmin_existed and not (reset and options['reset_password']):
            self.stdout.write('Note: existing superadmin password was kept unchanged.')
        else:
            self.stdout.write(f"Password: {options['password']}")
        self.stdout.write('Tip: clear browser session (localStorage token) then log in again.')
