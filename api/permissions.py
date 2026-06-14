from rest_framework.permissions import SAFE_METHODS, BasePermission

from .auth_utils import get_request_account, is_public_account_post
from .role_utils import is_api_allowed_for_role, is_public_api_path


class IsAuthenticatedSession(BasePermission):
    """Require a valid session token (header or cookie) backed by an Account."""

    message = 'يجب تسجيل الدخول أولاً للوصول إلى هذه البيانات.'

    def has_permission(self, request, view):
        if is_public_api_path(request.path) or is_public_account_post(request):
            return True
        return bool(get_request_account(request))


class RoleBasedPermission(BasePermission):
    """Enforce API access based on account role."""

    message = 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'

    def has_permission(self, request, view):
        if is_public_api_path(request.path) or is_public_account_post(request):
            return True

        account = get_request_account(request)
        if not account:
            self.message = 'يجب تسجيل الدخول أولاً للوصول إلى هذه البيانات.'
            return False

        if not is_api_allowed_for_role(request.path, account.role):
            self.message = 'صلاحية حسابك لا تسمح بهذا الإجراء.'
            return False

        return True


class IsSuperAdmin(BasePermission):
    message = 'فقط المسؤول الأعلى (Super Admin) يمكنه تنفيذ هذا الإجراء.'

    def has_permission(self, request, view):
        account = get_request_account(request)
        return account is not None and account.role == 'superadmin'


class IsSuperAdminOrAdmin(BasePermission):
    message = 'فقط المسؤول الأعلى أو الأدمن أو النائب يمكنه تنفيذ هذا الإجراء.'

    def has_permission(self, request, view):
        account = get_request_account(request)
        return account is not None and account.role in ('superadmin', 'admin', 'deputy')


class IsSuperAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        account = get_request_account(request)
        if not account:
            return False
        if request.method in SAFE_METHODS:
            return True
        return account.role == 'superadmin'


class IsSuperAdminWriteOnly(BasePermission):
    """Allow reads for authenticated roles; restrict PUT/PATCH/DELETE to superadmin."""

    message = 'فقط المسؤول الأعلى (Super Admin) يمكنه تعديل أو حذف السجلات.'

    def has_permission(self, request, view):
        account = get_request_account(request)
        if not account:
            return False
        if request.method in SAFE_METHODS or request.method == 'POST':
            return True
        return account.role == 'superadmin'


class SuperAdminWritesPermissionMixin:
    """Attach superadmin-only write permissions to destructive/update actions."""

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticatedSession(), IsSuperAdmin()]
        return super().get_permissions()
