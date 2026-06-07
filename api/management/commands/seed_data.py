from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Deprecated: use setup_system instead (no demo data).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('seed_data is deprecated. Run: python manage.py setup_system'))
