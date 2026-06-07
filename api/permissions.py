from rest_framework.permissions import SAFE_METHODS, BasePermission

from .auth_utils import get_request_account, is_public_account_post
from .role_utils import is_api_allowed_for_role, is_public_api_path


class IsAuthenticatedSession(BasePermission):
    """Require a valid Bearer session token (SessionTokenAuthentication)."""

    message = 'يجب تسجيل الدخول أولاً للوصول إلى هذه البيانات.'

    def has_permission(self, request, view):
        return bool(get_request_account(request))


class RoleBasedPermission(BasePermission):
    """Enforce API access based on account role only."""

    message = 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'

    def has_permission(self, request, view):
        path = request.path

        if is_public_api_path(path) or is_public_account_post(request):
            return True

        account = get_request_account(request)
        if not account:
            return False

        if not is_api_allowed_for_role(path, account.role):
            self.message = 'صلاحية حسابك لا تسمح بهذا الإجراء.'
            return False

        return True


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        account = get_request_account(request)
        return account is not None and account.role == 'superadmin'


class IsSuperAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(get_request_account(request))
        account = get_request_account(request)
        return account is not None and account.role == 'superadmin'
