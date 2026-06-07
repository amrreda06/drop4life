from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        from django.db.utils import OperationalError, ProgrammingError

        from .services import ensure_default_superadmin

        try:
            ensure_default_superadmin()
        except (OperationalError, ProgrammingError):
            pass
