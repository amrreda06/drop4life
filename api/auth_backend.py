from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.hashers import check_password, is_password_usable, make_password

from .models import Account
from .role_utils import normalize_role_code

User = get_user_model()


def verify_account_password(account, raw_password):
    stored_password = account.password or ''
    if is_password_usable(stored_password) and check_password(raw_password, stored_password):
        return True
    if stored_password == raw_password:
        set_account_password(account, raw_password)
        return True
    return False


def _apply_account_flags(user, account):
    user.email = account.email or user.email
    user.is_active = account.status == 'active'
    normalized_role = normalize_role_code(account.role_code or account.role)
    user.is_staff = normalized_role in ('DR', 'ADM')
    user.is_superuser = normalized_role == 'DR'


def sync_django_user_password(username, raw_password):
    """Sync Django auth user password without running AUTH_PASSWORD_VALIDATORS."""
    normalized = str(username).strip().lower()
    if raw_password is None:
        return None
    try:
        user = User.objects.get(username=normalized)
    except User.DoesNotExist:
        return None
    user.password = make_password(str(raw_password))
    user.save(update_fields=['password'])
    return user


def ensure_django_user_for_account(account, raw_password=None):
    """Create or update the Django auth user linked to a Drop4Life Account."""
    normalized = str(account.username).strip().lower()
    normalized_role = normalize_role_code(account.role_code or account.role)
    defaults = {
        'email': account.email or '',
        'is_active': account.status == 'active',
        'is_staff': normalized_role in ('DR', 'ADM'),
        'is_superuser': normalized_role == 'DR',
    }
    if raw_password is not None:
        defaults['password'] = make_password(str(raw_password))

    user, created = User.objects.get_or_create(username=normalized, defaults=defaults)
    if not created:
        _apply_account_flags(user, account)
        if raw_password is not None:
            user.password = make_password(str(raw_password))
        user.save()
    return user


def set_account_password(account, raw_password):
    """Persist hashed password on Account and keep Django auth User in sync."""
    if raw_password is None:
        return account
    raw_password = str(raw_password)
    account.password = make_password(raw_password)
    account.save(update_fields=['password'])
    ensure_django_user_for_account(account, raw_password)
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

        return ensure_django_user_for_account(account, password)

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
