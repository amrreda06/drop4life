from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path

from api.frontend_views import index_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

if settings.DEBUG:
    urlpatterns = staticfiles_urlpatterns() + urlpatterns

# Catch-all: every non-admin, non-api path serves the SPA shell for client-side routing.
urlpatterns += [
    re_path(r'^.*$', index_view, name='index-fallback'),
]
