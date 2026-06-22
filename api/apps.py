from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        from django.db.utils import OperationalError, ProgrammingError

        from .audit_signals import connect_audit_signals
        from .services import ensure_default_superadmin, remove_default_it_account

        connect_audit_signals()

        try:
            ensure_default_superadmin()
            remove_default_it_account()
        except (OperationalError, ProgrammingError):
            pass
