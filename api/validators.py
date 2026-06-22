"""Shared field validators for Drop4Life."""

import re


def normalize_digits(value):
    return re.sub(r'\D', '', str(value or ''))


def validate_egypt_phone(value, field_name='رقم الهاتف'):
    digits = normalize_digits(value)
    if len(digits) != 11:
        raise ValueError(f'{field_name} يجب أن يكون 11 رقماً بالضبط.')
    return digits


def validate_national_id(value, field_name='الرقم القومي'):
    digits = normalize_digits(value)
    if len(digits) != 14:
        raise ValueError(f'{field_name} يجب أن يكون 14 رقماً بالضبط.')
    return digits
