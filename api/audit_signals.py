from django.db.models.signals import post_delete, post_save, pre_save
from django.forms.models import model_to_dict
from django.utils import timezone

from .audit_context import get_audit_actor
from .models import AuditLog

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


def _write_audit(action, details):
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
    if not instance.pk:
        instance._audit_old_state = None
        return
    try:
        old = sender.objects.get(pk=instance.pk)
        instance._audit_old_state = model_to_dict(old)
    except sender.DoesNotExist:
        instance._audit_old_state = None


def _log_save(sender, instance, created, **kwargs):
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
    changes = []
    for field, new_val in new_state.items():
        if field in SENSITIVE_FIELDS and _format_value(field, old_state.get(field)) == _format_value(field, new_val):
            continue
        old_val = old_state.get(field)
        if _format_value(field, old_val) != _format_value(field, new_val):
            field_name = _field_label(field)
            changes.append(
                f'{actor_name} عدّل {field_name} من "{_format_value(field, old_val)}" إلى "{_format_value(field, new_val)}"'
            )

    if not changes:
        return

    _write_audit(f'تعديل {label}', ' | '.join(changes))


def _log_delete(sender, instance, **kwargs):
    actor_name, _, _ = _actor_info()
    label = _model_label(instance)
    identifier = _instance_identifier(instance)
    _write_audit(
        f'حذف {label}',
        f'{actor_name} حذف {label} "{identifier}"',
    )


def connect_audit_signals():
    from django.apps import apps

    for model in apps.get_app_config('api').get_models():
        if model in SKIP_MODELS:
            continue
        pre_save.connect(_capture_old_state, sender=model, dispatch_uid=f'audit_pre_{model.__name__}')
        post_save.connect(_log_save, sender=model, dispatch_uid=f'audit_post_{model.__name__}')
        post_delete.connect(_log_delete, sender=model, dispatch_uid=f'audit_del_{model.__name__}')
