import threading
from contextlib import contextmanager

_local = threading.local()


def set_audit_actor(account):
    _local.account = account


def get_audit_actor():
    return getattr(_local, 'account', None)


def clear_audit_actor():
    if hasattr(_local, 'account'):
        del _local.account


def set_audit_suppressed(value):
    _local.audit_suppressed = bool(value)


def is_audit_suppressed():
    return getattr(_local, 'audit_suppressed', False)


@contextmanager
def suppress_audit_logging():
    previous = is_audit_suppressed()
    set_audit_suppressed(True)
    try:
        yield
    finally:
        set_audit_suppressed(previous)
