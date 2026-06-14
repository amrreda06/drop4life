from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore

from .audit_context import clear_audit_actor, set_audit_actor
from .models import Account

User = get_user_model()


def _user_from_session_token(token):
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

    return user


def _parse_authorization_token(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2:
        return None

    scheme, token = parts[0], parts[1]
    if scheme.lower() not in ('bearer', 'session', 'token') or not token:
        return None

    return token


def _account_from_request(request):
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        account = Account.objects.filter(username=user.username).first()
        if account:
            return account

    token = _parse_authorization_token(request)
    if not token:
        return None

    user = _user_from_session_token(token)
    if not user:
        return None

    return Account.objects.filter(username=user.username).first()


class SessionTokenMiddleware:
    """Authenticate requests from Authorization header before view/DRF handling."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            token = _parse_authorization_token(request)
            authenticated_user = _user_from_session_token(token)
            if authenticated_user is not None:
                request.user = authenticated_user
        elif user is None:
            request.user = AnonymousUser()

        return self.get_response(request)


class AuditActorMiddleware:
    """Attach the current Account to thread-local storage for audit signals."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_audit_actor(_account_from_request(request))
        try:
            return self.get_response(request)
        finally:
            clear_audit_actor()
