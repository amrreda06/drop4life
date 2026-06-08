# Copy this into your PythonAnywhere WSGI file (Web tab).
# Replace USERNAME and PROJECT_DIR if your paths differ.

import os
import sys

PROJECT_DIR = '/home/amrreda06/drop4life'
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

os.environ['DJANGO_DEBUG'] = 'false'
os.environ['DJANGO_ALLOWED_HOSTS'] = 'amrreda06.pythonanywhere.com'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'drop4life_backend.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
