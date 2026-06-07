from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.hashers import check_password, is_password_usable, make_password

from .models import Account

User = get_user_model()


def verify_account_password(account, raw_password):
    stored_password = account.password or ''
    if is_password_usable(stored_password) and check_password(raw_password, stored_password):
        return True
    if stored_password == raw_password:
        set_account_password(account, raw_password)
        return True
    return False


def sync_django_user_password(username, raw_password):
    normalized = str(username).strip().lower()
    try:
        user = User.objects.get(username=normalized)
    except User.DoesNotExist:
        return
    user.set_password(raw_password)
    user.save(update_fields=['password'])


def set_account_password(account, raw_password):
    """Persist hashed password on Account and keep Django auth User in sync."""
    if raw_password is None:
        return account
    raw_password = str(raw_password)
    account.password = make_password(raw_password)
    account.save(update_fields=['password'])
    sync_django_user_password(account.username, raw_password)
    return account


class Drop4LifeAccountBackend(ModelBackend):
    """Bridge Drop4Life Account records to Django's authenticate()."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None

        normalized_username = str(username).strip().lower()
        account = Account.objects.filter(username=normalized_username, status='active').first()
        if not account or not verify_account_password(account, password):
            return None

        user, created = User.objects.get_or_create(
            username=normalized_username,
            defaults={
                'email': account.email or '',
                'is_active': True,
                'is_staff': account.role in ('superadmin', 'admin'),
                'is_superuser': account.role == 'superadmin',
            },
        )
        if not created:
            user.email = account.email or user.email
            user.is_active = True
            user.is_staff = account.role in ('superadmin', 'admin')
            user.is_superuser = account.role == 'superadmin'
            user.save(update_fields=['email', 'is_active', 'is_staff', 'is_superuser'])

        if created or not user.check_password(password):
            sync_django_user_password(normalized_username, password)

        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
