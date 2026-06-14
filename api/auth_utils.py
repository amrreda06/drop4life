"""Shared helpers for resolving Drop4Life accounts from API requests."""

from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore

from .models import Account

User = get_user_model()


def _account_from_session_token(token):
    if not token:
        return None

    session = SessionStore(session_key=token)
    user_id = session.get('_auth_user_id')
    if not user_id:
        return None

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None

    if not user.is_active:
        return None

    return Account.objects.filter(username=user.username).first()


def _django_http_request(request):
    return getattr(request, '_request', request)


def _account_from_user(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    return Account.objects.filter(username=user.username).first()


def get_request_account(request):
    django_request = _django_http_request(request)

    for candidate in (request, django_request):
        account = _account_from_user(getattr(candidate, 'user', None))
        if account:
            return account

    auth_header = django_request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2:
        return None

    scheme, token = parts[0], parts[1]
    if scheme.lower() not in ('bearer', 'session', 'token') or not token:
        return None

    return _account_from_session_token(token)


def account_context_from_request(request, data=None):
    """Prefer authenticated account; fall back to validated body only when anonymous ops are allowed."""
    account = get_request_account(request)
    if account:
        return account.username, account.role, account.name
    if data:
        return (
            str(data.get('username', 'system')).strip().lower(),
            str(data.get('role', 'System')),
            str(data.get('userName', data.get('username', 'system'))),
        )
    return 'system', 'System', 'system'


def is_public_account_post(request):
    if request.method != 'POST':
        return False
    path = request.path.rstrip('/')
    return path.endswith('/accounts/login') or path.endswith('/accounts/register')
