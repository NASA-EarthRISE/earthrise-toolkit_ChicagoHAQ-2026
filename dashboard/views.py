from django.shortcuts import render
from django.http import JsonResponse, HttpResponseNotFound
from django.conf import settings

import re
import json
import os
#import folium
from django.utils.timezone import datetime, now

# Capture server startup time when the module is first loaded (server starts)
SERVER_START_TIME = now()

# libraries for site/html render
from django.http import HttpResponse

# libraries for message log input
from django.shortcuts import redirect
from dashboard.forms import LogMessageForm
from dashboard.models import LogMessage

# library for lists/tables
from django.views.generic import ListView

# Terminal command for running/updating server: python manage.py runserver
# Website url for browser: http://127.0.0.1:8000/

# Create your views here.
# Views are what the user sees when they interact with buttons and widgets


def home(request):
    return render(request, "dashboard/pages/home.html", {
        'server_start_time': SERVER_START_TIME
    })

def about(request):
    return render(request, "dashboard/pages/about.html")

def info(request):
    return render(request, "dashboard/pages/info.html")

def tutorial(request):
    return render(request, "dashboard/pages/userguide.html")

# ── MAP VIEWS (hourly, daily, monthly) ────────────────────────────────────────

def map_view(request):
    """Default map view — redirects to hourly."""
    return render(request, 'dashboard/pages/map.html', {
        'time_scale': 'hourly'
    })

def map_hourly(request):
    """Hourly TEMPO data view with time slider."""
    return render(request, 'dashboard/pages/map.html', {'time_scale': 'hourly'})

def map_daily(request):
    """Daily aggregated/averaged data view."""

    return render(request, 'dashboard/pages/map.html', {'time_scale': 'daily'})

def map_monthly(request):
    """Monthly climatology/averages view."""
    return render(request, 'dashboard/pages/map.html', {
        'time_scale': 'monthly'
    })

# ── COMMUNITY STATISTICAL ANALYSIS ─────────────────────────────────────────────────────────────────

def community(request):
    return render(request, 'dashboard/pages/community.html')

#supposedly this will populate the dropdown with all community names but it is not working
def community_dropdown_view(request):
    #path to community areas geojson
    file_path = os.path.join(settings.BASE_DIR, 'dashboard', 'static', 'dashboard', 'layers', 'ChicagoCommunityAreas.geojson')
    community_names = []
    # Read and parse the file
    with open(file_path, 'r') as f:
        communities_data = json.load(f)  
        # Extract feature properties (replace 'name' with your actual GeoJSON property name)
        for feature in communities_data.get('features', []):
            properties = feature.get('properties', {})
            if 'community' in properties:
                community_names.append(properties['community'])
    # Sort the names alphabetically
    community_names.sort()
    # Pass the sorted list to the template
    return render(request, 'dashboard/community.html', {'features': community_names})



# ── EXPORT ────────────────────────────────────────────────────────────────────

def export(request):
    return render(request, 'dashboard/pages/export.html', {
        'today': datetime.now().date()
    })

# ── API ENDPOINTS ─────────────────────────────────────────────────────────────

def tempo_data_api(request, date_str):
    """
    API endpoint to serve TEMPO NO2 data as GeoJSON.

    GET /api/tempo-data/<date>/
        Query params:
            scale  — 'hourly', 'daily', 'monthly' (default: 'hourly')
            hour   — 0-23 (only for hourly scale)

    Returns a GeoJSON FeatureCollection with NO2 values.
    """
    scale = request.GET.get('scale', 'hourly')
    hour = request.GET.get('hour', None)

    # Validate date format
    try:
        query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return HttpResponseNotFound(json.dumps({
            'error': 'Invalid date format. Use YYYY-MM-DD.'
        }))

    # TODO: Replace this demo data generator with actual NetCDF file reading.
    # Once data files are available, read from:
    #   - dashboard/data/TEMPO_NO2_L3_<date>.nc4
    # Using xarray or netCDF4 to extract the variable values.

    # Generate demo GeoJSON response
    features = []
    base_lat, base_lon = 41.3, -88.0
    step = 0.04

    for lat_offset in range(int((42.1 - base_lat) / step) + 1):
        for lon_offset in range(int((-87.2 - base_lon) / step) + 1):
            lat = round(base_lat + lat_offset * step, 4)
            lon = round(base_lon + lon_offset * step, 4)

            # Simulate varying values based on date/hour
            import hashlib
            seed_str = f"{date_str}-{lat}-{lon}-{hour or 'daily'}"
            hash_val = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
            value = (hash_val % 8000000000000000 + 1000000000000000)  # ~1e15 to 9e15

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                },
                'properties': {
                    'value': value,
                    'datetime': date_str,
                    'hour': int(hour) if hour else None,
                    'scale': scale,
                    'unit': 'molecules/cm2'
                }
            })

    geojson = {
        'type': 'FeatureCollection',
        'metadata': {
            'date': date_str,
            'scale': scale,
            'hour': int(hour) if hour else None,
            'feature_count': len(features),
            'source': 'TEMPO L3 NO2 (demo data — connect NetCDF files for real data)'
        },
        'features': features
    }

    return JsonResponse(geojson, content_type='application/json')


def openaq_sites_api(request):
    """
    API endpoint to serve OpenAQ air quality monitor locations.

    GET /api/openaq-sites/
        Query params:
            bbox — "min_lon,min_lat,max_lon,max_lat" (optional, for bounding box filter)

    Returns a GeoJSON FeatureCollection of monitor locations.
    """
    bbox = request.GET.get('bbox', None)

    # TODO: Replace with actual OpenAQ API call or local database query.
    # Example: fetch from https://api.openaq.org/v2/locations?bbox=...

    # Demo: return a small set of mock monitor locations around Chicago
    features = [
        {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [-87.6298, 41.8781]},
            'properties': {'name': 'Chicago-Downtown', 'parameter': 'NO2', 'unit': 'ppb'}
        },
        {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [-87.9071, 42.0304]},
            'properties': {'name': 'Evanston', 'parameter': 'NO2', 'unit': 'ppb'}
        },
        {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [-87.5902, 41.6447]},
            'properties': {'name': 'Chicago-O\'Hare', 'parameter': 'NO2', 'unit': 'ppb'}
        }
    ]

    return JsonResponse({
        'type': 'FeatureCollection',
        'features': features
    }, content_type='application/json')


print("View site in browser at: http://127.0.0.1:8000/\n")