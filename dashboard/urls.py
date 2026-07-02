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
    path("api/tempo-data/<str:date_str>/", views.tempo_data_api, name="tempo_data_api"),
    path("api/openaq-sites/", views.openaq_sites_api, name="openaq_sites_api"),
]