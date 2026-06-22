"""Role-based API access rules using role_code values."""

import re

from django.conf import settings

PUBLIC_API_PATHS = (
    r'^/api/accounts/login/?$',
)

if settings.DEBUG:
    PUBLIC_API_PATHS = PUBLIC_API_PATHS + (r'^/api/accounts/register/?$',)

ROLE_CODE_LABELS = {
    'DR': 'المسؤول الأعلى',
    'ADM': 'مسؤول',
    'MLS': 'معمل',
}

LEGACY_ROLE_TO_CODE = {
    'superadmin': 'DR',
    'admin': 'ADM',
    'lab': 'MLS',
}

ROLE_CODE_TO_LEGACY = {v: k for k, v in LEGACY_ROLE_TO_CODE.items()}

ROLE_API_ALLOWLIST = {
    'MLS': [
        r'^/api/bootstrap/',
        r'^/api/live-sync/',
        r'^/api/dashboard-stats/',
        r'^/api/ai-predictions/',
        r'^/api/pending-donors/',
        r'^/api/blood-bags/',
        r'^/api/blood-inventory/',
        r'^/api/sample-analyses/',
        r'^/api/operations/submit-lab/',
        r'^/api/notifications/',
        r'^/api/messages/',
        r'^/api/audit-logs/',
        r'^/api/beneficiaries/',
    ],
    'ADM': [
        r'^/api/bootstrap/',
        r'^/api/live-sync/',
        r'^/api/dashboard-stats/',
        r'^/api/ai-predictions/',
        r'^/api/blood-inventory/',
        r'^/api/blood-bags/',
        r'^/api/operations/submit-lab/',
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


def normalize_role_code(role_code):
    if not role_code:
        return None
    candidate = str(role_code).strip().upper()
    if candidate in ROLE_CODE_LABELS:
        return candidate
    return LEGACY_ROLE_TO_CODE.get(candidate.lower())


def get_role_label(role_code):
    normalized_code = normalize_role_code(role_code)
    if normalized_code in ROLE_CODE_LABELS:
        return ROLE_CODE_LABELS[normalized_code]
    return str(role_code or '').strip()


def is_api_allowed_for_role(path, role_code):
    normalized = path.rstrip('/') + '/'
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    if re.match(r'^/api/accounts/(me|logout)/', normalized):
        return True
    normalized_code = normalize_role_code(role_code)
    if normalized_code == 'DR':
        return True
    patterns = ROLE_API_ALLOWLIST.get(normalized_code, [])
    return any(re.match(pattern, normalized) for pattern in patterns)
