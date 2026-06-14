"""Role-based API access rules (account role only)."""

import re

from django.conf import settings

PUBLIC_API_PATHS = (
    r'^/api/accounts/login/?$',
)

if settings.DEBUG:
    PUBLIC_API_PATHS = PUBLIC_API_PATHS + (r'^/api/accounts/register/?$',)

ROLE_API_ALLOWLIST = {
    'lab': [
        r'^/api/bootstrap/',
        r'^/api/dashboard-stats/',
        r'^/api/ai-predictions/',
        r'^/api/pending-donors/',
        r'^/api/blood-bags/',
        r'^/api/blood-inventory/',
        r'^/api/operations/submit-lab/',
        r'^/api/notifications/',
        r'^/api/messages/',
        r'^/api/audit-logs/',
        r'^/api/beneficiaries/',
    ],
    'deputy': [
        r'^/api/bootstrap/',
        r'^/api/dashboard-stats/',
        r'^/api/ai-predictions/',
        r'^/api/pending-donors/',
        r'^/api/blood-bags/',
        r'^/api/blood-inventory/',
        r'^/api/requests/',
        r'^/api/hospitals/',
        r'^/api/donors/',
        r'^/api/disposal-logs/',
        r'^/api/storage-units/',
        r'^/api/storage-config/',
        r'^/api/operations/',
        r'^/api/notifications/',
        r'^/api/messages/',
        r'^/api/audit-logs/',
        r'^/api/beneficiaries/',
        r'^/api/dashboard-stats/',
    ],
    'admin': [
        r'^/api/bootstrap/',
        r'^/api/dashboard-stats/',
        r'^/api/ai-predictions/',
        r'^/api/blood-inventory/',
        r'^/api/blood-bags/',
        r'^/api/donors/',
        r'^/api/pending-donors/',
        r'^/api/requests/',
        r'^/api/hospitals/',
        r'^/api/hospital-deliveries/',
        r'^/api/disposal-logs/',
        r'^/api/notifications/',
        r'^/api/messages/',
        r'^/api/storage-units/',
        r'^/api/storage-config/',
        r'^/api/operations/',
        r'^/api/audit-logs/',
        r'^/api/accounts/',
        r'^/api/beneficiaries/',
    ],
}


def is_public_api_path(path):
    normalized = path.rstrip('/') + '/'
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    for pattern in PUBLIC_API_PATHS:
        if re.match(pattern, normalized):
            return True
    return False


def is_api_allowed_for_role(path, role):
    if role == 'superadmin':
        return True
    normalized = path.rstrip('/') + '/'
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    if re.match(r'^/api/accounts/(me|logout)/', normalized):
        return True
    if re.match(r'^/api/(messages|notifications)/', normalized):
        return True
    patterns = ROLE_API_ALLOWLIST.get(role, [])
    return any(re.match(pattern, normalized) for pattern in patterns)
