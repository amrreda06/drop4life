"""Per-user notification helpers (SQLite-safe — no JSON contains lookup)."""

from .models import Notification


def notifications_for_account(account):
    queryset = Notification.objects.all()
    if not account:
        return queryset
    username = account.username
    visible_ids = [
        item.pk
        for item in queryset.only('pk', 'deleted_by')
        if username not in (item.deleted_by or [])
    ]
    return Notification.objects.filter(pk__in=visible_ids)
