"""Shared helpers for resolving Drop4Life accounts from API requests."""

from .models import Account


def get_request_account(request):
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    return Account.objects.filter(username=user.username).first()


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
