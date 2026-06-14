import threading

_local = threading.local()


def set_audit_actor(account):
    _local.account = account


def get_audit_actor():
    return getattr(_local, 'account', None)


def clear_audit_actor():
    if hasattr(_local, 'account'):
        del _local.account
