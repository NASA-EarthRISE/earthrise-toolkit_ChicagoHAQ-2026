"""
URL configuration for web_project project.
"""

from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path
from django.views.static import serve


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("dashboard.urls")),
]

# Recognizes static file URLs
urlpatterns += staticfiles_urlpatterns()

# Serve local dashboard/data files during development.
# This makes URLs like /data/clarity/dates.json resolve to:
# dashboard/data/clarity/dates.json
if settings.DEBUG:
    urlpatterns += [
        re_path(
            r"^data/(?P<path>.*)$",
            serve,
            {
                "document_root": Path(settings.BASE_DIR) / "dashboard" / "data",
            },
        ),
    ]