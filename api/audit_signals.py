from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.forms.models import model_to_dict
from django.utils import timezone

from .audit_context import get_audit_actor, is_audit_suppressed
from .models import AuditLog
from .services import invalidate_runtime_caches

SKIP_MODELS = {AuditLog}

FIELD_LABELS = {
    'name': 'الاسم',
    'phone': 'رقم الهاتف',
    'national_id': 'رقم البطاقة',
    'blood_type_received': 'نوع الفصيلة المستهلكة',
    'bags_consumed': 'عدد الأكياس المستهلكة',
    'username': 'اسم المستخدم',
    'email': 'البريد الإلكتروني',
    'role': 'الصلاحية',
    'status': 'الحالة',
    'password': 'كلمة المرور',
    'blood_type': 'فصيلة الدم',
    'available': 'المتاح',
    'reserved': 'المحجوز',
    'issued': 'المُصدَر',
    'expired': 'المنتهي',
    'critical_limit': 'حد الخطر',
    'donor': 'المتبرع',
    'qty': 'الكمية',
    'date': 'التاريخ',
    'expiry': 'تاريخ الصلاحية',
    'location': 'الموقع',
    'hospital': 'المستشفى',
    'blood': 'فصيلة الدم',
    'priority': 'الأولوية',
    'address': 'العنوان',
    'manager': 'المدير',
    'from_name': 'المرسل',
    'text': 'نص الرسالة',
    'title': 'العنوان',
    'message': 'الرسالة',
    'reason': 'السبب',
    'worker': 'الموظف',
}

SENSITIVE_FIELDS = {'password'}


class AuditQuerySet(models.QuerySet):
    def update(self, **kwargs):
        if self.model in SKIP_MODELS or is_audit_suppressed():
            return super().update(**kwargs)

        instances = list(self)
        if not instances:
            return super().update(**kwargs)

        old_states = {instance.pk: model_to_dict(instance) for instance in instances}
        updated_count = super().update(**kwargs)

        fresh_instances = {
            instance.pk: instance
            for instance in self.model._base_manager.filter(pk__in=old_states)
        }
        for pk, old_state in old_states.items():
            fresh_instance = fresh_instances.get(pk)
            if fresh_instance is None:
                continue

            new_state = model_to_dict(fresh_instance)
            changes = _state_changes(old_state, new_state)
            if not changes:
                continue

            _write_audit(
                f'تعديل {_model_label(fresh_instance)}',
                ' | '.join(changes),
            )

        if updated_count:
            invalidate_runtime_caches()
        return updated_count

    def bulk_update(self, objs, fields, batch_size=None):
        if self.model in SKIP_MODELS or is_audit_suppressed():
            return super().bulk_update(objs, fields, batch_size=batch_size)

        pks = [instance.pk for instance in objs if getattr(instance, 'pk', None) is not None]
        if not pks:
            return super().bulk_update(objs, fields, batch_size=batch_size)

        old_states = {
            instance.pk: model_to_dict(instance)
            for instance in self.model._base_manager.filter(pk__in=pks)
        }
        updated_count = super().bulk_update(objs, fields, batch_size=batch_size)

        fresh_instances = {
            instance.pk: instance
            for instance in self.model._base_manager.filter(pk__in=old_states)
        }
        for pk, old_state in old_states.items():
            fresh_instance = fresh_instances.get(pk)
            if fresh_instance is None:
                continue

            new_state = model_to_dict(fresh_instance)
            changes = _state_changes(old_state, new_state)
            if not changes:
                continue

            _write_audit(
                f'تعديل {_model_label(fresh_instance)}',
                ' | '.join(f'{_actor_info()[0]} عدّل {change}' for change in changes),
            )

        if updated_count:
            invalidate_runtime_caches()
        return updated_count

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        if self.model in SKIP_MODELS or is_audit_suppressed():
            return super().bulk_create(
                objs,
                batch_size=batch_size,
                ignore_conflicts=ignore_conflicts,
                update_conflicts=update_conflicts,
                update_fields=update_fields,
                unique_fields=unique_fields,
            )

        created_objects = super().bulk_create(
            objs,
            batch_size=batch_size,
            ignore_conflicts=ignore_conflicts,
            update_conflicts=update_conflicts,
            update_fields=update_fields,
            unique_fields=unique_fields,
        )
        for instance in created_objects:
            _write_audit(
                f'إنشاء {_model_label(instance)}',
                f'{_actor_info()[0]} أنشأ {_model_label(instance)} "{_instance_identifier(instance)}"',
            )
        return created_objects


class AuditManager(models.Manager.from_queryset(AuditQuerySet)):
    pass


def _field_label(field_name):
    return FIELD_LABELS.get(field_name, field_name)


def _actor_info():
    account = get_audit_actor()
    if account:
        return account.name, account.role, account
    return 'system', 'System', None


def _model_label(instance):
    return instance._meta.verbose_name


def _instance_identifier(instance):
    for attr in ('name', 'username', 'bag_id', 'donor_id', 'request_id', 'title', 'from_name'):
        if hasattr(instance, attr):
            value = getattr(instance, attr, None)
            if value:
                return str(value)
    pk = getattr(instance, 'pk', None)
    return str(pk) if pk is not None else '—'


def _format_value(field_name, value):
    if field_name in SENSITIVE_FIELDS:
        return '********'
    if value is None:
        return ''
    if isinstance(value, (list, dict)):
        return str(value)
    return str(value)


def _state_changes(old_state, new_state):
    changes = []
    for field, new_val in new_state.items():
        old_val = old_state.get(field)
        if _format_value(field, old_val) == _format_value(field, new_val):
            continue
        field_name = _field_label(field)
        changes.append(
            f'{field_name} من "{_format_value(field, old_val)}" إلى "{_format_value(field, new_val)}"'
        )
    return changes


def _write_audit(action, details):
    if is_audit_suppressed():
        return
    actor_name, actor_role, account = _actor_info()
    now = timezone.localtime()
    AuditLog.objects.create(
        account=account,
        time=now.strftime('%Y-%m-%d %H:%M'),
        user=actor_name,
        role=actor_role,
        action=action,
        details=details,
    )


def _capture_old_state(sender, instance, **kwargs):
    if is_audit_suppressed():
        return
    if not instance.pk:
        instance._audit_old_state = None
        return
    try:
        old = sender.objects.get(pk=instance.pk)
        instance._audit_old_state = model_to_dict(old)
    except sender.DoesNotExist:
        instance._audit_old_state = None


def _log_save(sender, instance, created, **kwargs):
    if is_audit_suppressed():
        return
    actor_name, _, _ = _actor_info()
    label = _model_label(instance)
    identifier = _instance_identifier(instance)

    if created:
        _write_audit(
            f'إنشاء {label}',
            f'{actor_name} أنشأ {label} "{identifier}"',
        )
        return

    old_state = getattr(instance, '_audit_old_state', None) or {}
    new_state = model_to_dict(instance)
    changes = [
        f'{actor_name} عدّل {change}'
        for change in _state_changes(old_state, new_state)
    ]

    if not changes:
        invalidate_runtime_caches()
        return

    _write_audit(f'تعديل {label}', ' | '.join(changes))
    invalidate_runtime_caches()


def _log_delete(sender, instance, **kwargs):
    if is_audit_suppressed():
        return
    actor_name, _, _ = _actor_info()
    label = _model_label(instance)
    identifier = _instance_identifier(instance)
    _write_audit(
        f'حذف {label}',
        f'{actor_name} حذف {label} "{identifier}"',
    )
    invalidate_runtime_caches()


def connect_audit_signals():
    from django.apps import apps

    for model in apps.get_app_config('api').get_models():
        if model in SKIP_MODELS:
            continue
        model.add_to_class('objects', AuditManager())
        pre_save.connect(_capture_old_state, sender=model, dispatch_uid=f'audit_pre_{model.__name__}')
        post_save.connect(_log_save, sender=model, dispatch_uid=f'audit_post_{model.__name__}')
        post_delete.connect(_log_delete, sender=model, dispatch_uid=f'audit_del_{model.__name__}')
