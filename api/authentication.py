from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

User = get_user_model()


def _django_http_request(request):
    return getattr(request, '_request', request)


class SessionTokenAuthentication(authentication.BaseAuthentication):
    """Authenticate via Authorization header or the Django session cookie."""

    def authenticate_header(self, request):
        # Required so DRF returns 401 (not 403) when authentication fails.
        return 'Token'

    def authenticate(self, request):
        header_result = self._authenticate_from_header(request)
        if header_result is not None:
            return header_result
        return self._authenticate_from_session_cookie(request)

    def _authenticate_from_header(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2:
            return None

        scheme, token = parts[0], parts[1]
        if scheme.lower() not in ('bearer', 'session', 'token'):
            return None

        if not token:
            return None

        session = SessionStore(session_key=token)
        if not session.exists(token):
            return None

        user_id = session.get('_auth_user_id')
        if not user_id:
            return None

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('المستخدم غير موجود.')

        if not user.is_active:
            raise AuthenticationFailed('الحساب معطل.')

        django_request = _django_http_request(request)
        if django_request is not None and not getattr(django_request.user, 'is_authenticated', False):
            from django.conf import settings
            from django.contrib.auth import login
            login(django_request, user, backend=settings.AUTHENTICATION_BACKENDS[0])

        return (user, token)

    def _authenticate_from_session_cookie(self, request):
        django_request = _django_http_request(request)
        user = getattr(django_request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return None

        session = getattr(django_request, 'session', None)
        session_key = getattr(session, 'session_key', None) or ''
        return (user, session_key or None)


class RequireSessionTokenAuthentication(SessionTokenAuthentication):
    """Require a valid session token header or authenticated Django session cookie."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            raise NotAuthenticated('يجب تسجيل الدخول أولاً.')
        return result
