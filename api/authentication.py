from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

User = get_user_model()


class SessionTokenAuthentication(authentication.BaseAuthentication):
    """Authenticate API requests via Authorization: Bearer <session_key> or Session <session_key>."""

    def authenticate(self, request):
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
        user_id = session.get('_auth_user_id')
        if not user_id:
            raise AuthenticationFailed('جلسة غير صالحة أو منتهية.')

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('المستخدم غير موجود.')

        if not user.is_active:
            raise AuthenticationFailed('الحساب معطل.')

        return (user, token)


class RequireSessionTokenAuthentication(SessionTokenAuthentication):
    """Like SessionTokenAuthentication but returns 401 when Authorization header is missing."""

    def authenticate(self, request):
        if not request.META.get('HTTP_AUTHORIZATION', ''):
            raise NotAuthenticated('يجب تسجيل الدخول أولاً.')
        return super().authenticate(request)
