"""Private and group chat visibility rules."""

from django.db.models import Q

from .role_utils import normalize_role_code


def is_super_admin_account(account):
    if not account:
        return False
    return normalize_role_code(account.role_code or account.role) == 'DR'


def messages_queryset_for_account(queryset, account):
    """Group messages (no recipient) plus private threads the account participates in."""
    if not account:
        return queryset.none()
    group = Q(recipient__isnull=True)
    private = Q(recipient=account) | Q(sender=account, recipient__isnull=False)
    return queryset.filter(group | private)


def validate_private_recipient(sender, recipient):
    """Super admin may message anyone; others may only message the super admin."""
    if not recipient:
        return
    if is_super_admin_account(sender):
        return
    if is_super_admin_account(recipient):
        return
    raise ValueError('الرسائل الخاصة متاحة فقط مع المسؤول الأعلى.')


def get_super_admin_contact():
    from .models import Account

    admin = Account.objects.filter(role_code='DR').first()
    if not admin:
        admin = Account.objects.filter(role='superadmin').first()
    if not admin:
        return None
    return {
        'username': admin.username,
        'name': (admin.name or admin.username).strip(),
    }
