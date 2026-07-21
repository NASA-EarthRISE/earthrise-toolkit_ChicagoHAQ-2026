# URL patterns for the TEMPO Dashboard
# Terminal command for running/updating server: python manage.py runserver

from django.urls import path
from dashboard import views

# Note: Home was defined as a function in "views.py" that acts as a request

urlpatterns = [
    # ── Page Views ──────────────────────────────────────────────
    path("", views.home, name="home"),
    path("about/", views.about, name="about"),
    path("info/", views.info, name="info"),
    path("tutorial/", views.tutorial, name="tutorial"),
    path("community/", views.community, name="community"),
    path("export/", views.export, name="export"),

    # ── Map Views (hourly, daily, monthly) ──────────────────────
    path("map/", views.map_view, name="map"),
    path("map/hourly/", views.map_hourly, name="map_hourly"),
    path("map/daily/", views.map_daily, name="map_daily"),
    path("map/monthly/", views.map_monthly, name="map_monthly"),

    # ── API Endpoints ───────────────────────────────────────────
    path("api/data-status/", views.data_status_api, name="data_status_api"),
    path("api/community-rankings/", views.community_rankings_api, name="community_rankings_api"),
    path("api/community-no2-data/", views.community_no2_data_api, name="community_no2_data_api"),

    # ── Clarity Data Files (served from dashboard/data/clarity/) ──
    path("data/clarity/<path:filename>", views.clarity_data_file, name="clarity_data_file"),

    # ── TEMPO Data Files (served from dashboard/data/tempo/) ──
    path("data/tempo/<path:filename>", views.tempo_data_file, name="tempo_data_file"),

    # ── Fused Data Files (served from dashboard/data/fused/) ──
    path("data/fused/<path:filename>", views.fused_data_file, name="fused_data_file"),

    # ── Clarity Dates Index ──────────────────────────────────────
    path("api/clarity-dates/", views.clarity_dates_index, name="clarity_dates_index"),

    # ── Data File Export API ──────────────────────────────────────
    path("api/list-data-files/", views.list_data_files_api, name="list_data_files_api"),
    path("api/export-data-file/", views.export_data_file, name="export_data_file"),
]
