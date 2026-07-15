from django.shortcuts import render
from django.http import JsonResponse, HttpResponseNotFound, HttpResponse
from django.conf import settings

import re
import json
import os
import csv
import io
#import folium
from django.utils.timezone import datetime, now

# Capture server startup time when the module is first loaded (server starts)
SERVER_START_TIME = now()

# libraries for message log input
from django.shortcuts import redirect
from dashboard.forms import LogMessageForm
from dashboard.models import LogMessage

# library for lists/tables
from django.views.generic import ListView


# ── LOCAL DATA STATUS CHECK ──────────────────────────────────────────
# Checks local data directories for TEMPO, Clarity, and wind data files
# and returns status info for the "Recent Activity" section on home page.

DATA_DIR = os.path.join(settings.BASE_DIR, 'dashboard', 'data')


# ── FILE-BASED ACTIVITY LOG ──────────────────────────────────────────
# Stores recent activities in a simple JSON file (no database needed).
# Activity types:
#   server_start       — Server started / restarted
#   data_ingestion     — TEMPO or OpenAir data ingestion (success/failure)
#   system_status      — System health check or status change
#   new_data_file      — New data file detected in a data directory
#   page_refresh       — Dashboard page was refreshed/reloaded
#   notification       — General notification

ACTIVITY_FILE = os.path.join(settings.BASE_DIR, 'activity_log.json')
MAX_ACTIVITIES = 50
NOTIFICATION_LIMIT = 5  # Show the 5 most recent user-facing notifications

# Notification types — these appear in the "Recent Notifications" section
NOTIFICATION_TYPES = {'export_completed', 'community_selected', 'new_data_file', 'page_refresh'}


def _load_activities():
    """Load activities from JSON file."""
    if os.path.exists(ACTIVITY_FILE):
        try:
            with open(ACTIVITY_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def _save_activities(activities):
    """Save activities to JSON file, keeping only the last MAX_ACTIVITIES."""
    activities = activities[:MAX_ACTIVITIES]
    with open(ACTIVITY_FILE, 'w') as f:
        json.dump(activities, f, indent=2)


def log_activity(activity_type, title, details=''):
    """Add an activity entry to the file-based log."""
    activities = _load_activities()
    entry = {
        'type': activity_type,
        'title': title,
        'details': details,
        'timestamp': now().strftime('%Y-%m-%d %H:%M:%S'),
    }
    activities.insert(0, entry)  # Newest first
    _save_activities(activities)


def get_recent_activities(limit=20):
    """Retrieve recent activities from the file-based log."""
    return _load_activities()[:limit]


def get_recent_notifications(limit=NOTIFICATION_LIMIT):
    """Retrieve the most recent user-facing notifications only."""
    activities = _load_activities()
    notifications = [a for a in activities if a['type'] in NOTIFICATION_TYPES]
    return notifications[:limit]


# Log server start on module load
log_activity('server_start', 'Dashboard server started')


def check_data_status():
    """Scan local data directories and return status of each data source."""
    status = {
        'server_start': str(SERVER_START_TIME.strftime('%Y-%m-%d %H:%M:%S')),
        'sources': []
    }

    # Check TEMPO data
    tempo_dir = os.path.join(DATA_DIR, 'tempo')
    tempo_exists = os.path.isdir(tempo_dir)
    tempo_count = 0
    tempo_latest = None
    if tempo_exists:
        tempo_files = [f for f in os.listdir(tempo_dir) if os.path.isfile(os.path.join(tempo_dir, f))]
        tempo_count = len(tempo_files)
        if tempo_files:
            tempo_latest = sorted(tempo_files)[-1]

    status['sources'].append({
        'name': 'TEMPO Data',
        'type': 'tempo',
        'exists': tempo_exists,
        'file_count': tempo_count,
        'latest_file': tempo_latest,
        'status': 'success' if tempo_exists and tempo_count > 0 else 'failure',
    })


    # Check Clarity data
    clarity_dir = os.path.join(DATA_DIR, 'clarity')
    clarity_exists = os.path.isdir(clarity_dir)
    clarity_count = 0
    clarity_latest = None
    if clarity_exists:
        clarity_files = [f for f in os.listdir(clarity_dir) if os.path.isfile(os.path.join(clarity_dir, f))]
        clarity_count = len(clarity_files)
        if clarity_files:
            clarity_latest = sorted(clarity_files)[-1]

    status['sources'].append({
        'name': 'OpenAir Clarity Data',
        'type': 'clarity',
        'exists': clarity_exists,
        'file_count': clarity_count,
        'latest_file': clarity_latest,
        'status': 'success' if clarity_exists and clarity_count > 0 else 'failure',
    })


    # Check fused data
    fused_dir = os.path.join(DATA_DIR, 'fused')
    fused_exists = os.path.isdir(fused_dir)
    fused_count = 0
    fused_latest = None
    if fused_exists:
        fused_files = [f for f in os.listdir(fused_dir) if os.path.isfile(os.path.join(fused_dir, f))]
        fused_count = len(fused_files)
        if fused_files:
            fused_latest = sorted(fused_files)[-1]

    status['sources'].append({
        'name': 'Fused Data',
        'type': 'fused',
        'exists': fused_exists,
        'file_count': fused_count,
        'latest_file': fused_latest,
        'status': 'success' if fused_exists and fused_count > 0 else 'failure',
    })

    return status

# Terminal command for running/updating server: python manage.py runserver
# Create your views here.
# Views are what the user sees when they interact with buttons and widgets


def home(request):
    """Home page — logs a page_refresh notification."""
    log_activity('page_refresh', 'Dashboard home page refreshed')
    return render(request, "dashboard/pages/home.html", {
        'server_start_time': SERVER_START_TIME
    })


def about(request):
    return render(request, "dashboard/pages/about.html")


def info(request):
    return render(request, "dashboard/pages/info.html")


def tutorial(request):
    return render(request, "dashboard/pages/userguide.html")


#  MAP VIEWS (hourly, daily, monthly) 

def map_view(request):
    """Default map view — redirects to hourly."""
    return render(request, 'dashboard/pages/map.html', {'time_scale': 'hourly'})


def map_hourly(request):
    """Hourly TEMPO data view with time slider."""
    log_activity('map_view', 'User viewed hourly map')
    return render(request, 'dashboard/pages/map.html', {'time_scale': 'hourly'})


def map_daily(request):
    """Daily aggregated/averaged data view."""
    log_activity('map_view', 'User viewed daily map')
    return render(request, 'dashboard/pages/map.html', {'time_scale': 'daily'})


def map_monthly(request):
    """Monthly climatology/averages view."""
    log_activity('map_view', 'User viewed monthly map')
    return render(request, 'dashboard/pages/map.html', {'time_scale': 'monthly'})


#  COMMUNITY TOOLS

def community(request):
    """Community analysis tool."""
    log_activity('community_analysis', 'User opened community analysis tool')
    return render(request, 'dashboard/pages/community.html')


#  EXPORT DATA

def export(request):
    """Export tool — allows users to export maps."""
    log_activity('map_export', 'User opened export tool')
    return render(request, 'dashboard/pages/export.html', {
        'today': datetime.now().date()
    })


#  API ENDPOINTS 

def data_status_api(request):
    """
    API endpoint to return local data file status AND recent notifications.

    GET /api/data-status/
    Returns JSON with:
      - server_start: server start timestamp
      - sources: list of data source statuses (success/failure, file counts)
      - recent_activities: all recent log entries (up to 20)
      - notifications: the 5 most recent user-facing notifications
    """
    status = check_data_status()
    status['recent_activities'] = get_recent_activities(limit=20)
    status['notifications'] = get_recent_notifications(limit=NOTIFICATION_LIMIT)
    return JsonResponse(status, content_type='application/json')


print("View site in browser at: http://127.0.0.1:8000/\n")


# ── CLARITY DATA SERVING ─────────────────────────────────────────────
# Serves GeoJSON and JSON data files from dashboard/data/clarity/
# and the dates.json index from dashboard/data/

import mimetypes

mimetypes.add_type('application/json', '.json')
mimetypes.add_type('application/geo+json', '.geojson')


def clarity_data_file(request, filename):
    """
    Serve clarity data files (GeoJSON or JSON) from dashboard/data/clarity/.
    URL pattern: /data/clarity/<filename>
    Examples:
      /data/clarity/2025-09-01.geojson
      /data/clarity/daily_community_2025-09-13.geojson
      /data/clarity/monthly_sensor_2025-09.geojson
    """
    clarity_dir = os.path.join(settings.BASE_DIR, 'dashboard', 'data', 'clarity')
    file_path = os.path.join(clarity_dir, filename)

    # Prevent path traversal attacks
    if not os.path.abspath(file_path).startswith(os.path.abspath(clarity_dir)):
        return HttpResponseNotFound("Invalid file path")

    if not os.path.isfile(file_path):
        return HttpResponseNotFound(f"File not found: {filename}")

    # Determine content type
    content_type, _ = mimetypes.guess_type(filename)
    if content_type is None:
        content_type = 'application/octet-stream'

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return HttpResponse(content, content_type=content_type)


def clarity_dates_index(request):
    """
    Serve the dates.json index file from dashboard/data/.
    URL pattern: /api/clarity-dates/
    """
    dates_file = os.path.join(settings.BASE_DIR, 'dashboard', 'data', 'dates.json')

    if not os.path.isfile(dates_file):
        return JsonResponse({"error": "dates.json not found"}, status=404)

    with open(dates_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return JsonResponse(data if isinstance(data, dict) else {"dates": data})


# ── DATA FILE EXPORT API ─────────────────────────────────────────────
# Allows browsing and exporting (GeoJSON/JSON or CSV) of data files from
# dashboard/data/{tempo,clarity,fused}/ directories.
# Handles both .geojson (most data files) and .json (e.g. dates.json) extensions.


def _scan_data_files(source):
    """
    Scan a data source directory and return a sorted list of file info dicts.
    Each dict: { "filename": ..., "size": ..., "type": ..., "ext": ... }
    File type is inferred from filename prefix:
      - daily_community_  -> "daily_community"
      - daily_sensor_     -> "daily_sensor"
      - monthly_community -> "monthly_community"
      - monthly_sensor    -> "monthly_sensor"
      - YYYY-MM-DD.json/geojson -> "daily"
      - else              -> "other"
    """
    source_dir = os.path.join(DATA_DIR, source)
    if not os.path.isdir(source_dir):
        return []

    files = []
    for f in sorted(os.listdir(source_dir)):
        full_path = os.path.join(source_dir, f)
        if not os.path.isfile(full_path):
            continue

        # File extension
        ext = 'geojson' if f.endswith('.geojson') else ('json' if f.endswith('.json') else 'unknown')

        # Classify file type by prefix
        if f.startswith('daily_community_'):
            ftype = 'daily_community'
        elif f.startswith('daily_sensor_'):
            ftype = 'daily_sensor'
        elif f.startswith('monthly_community_'):
            ftype = 'monthly_community'
        elif f.startswith('monthly_sensor_'):
            ftype = 'monthly_sensor'
        elif re.match(r'^\d{4}-\d{2}-\d{2}', f):
            ftype = 'daily'
        else:
            ftype = 'other'

        files.append({
            'filename': f,
            'size': os.path.getsize(full_path),
            'type': ftype,
            'ext': ext,
        })

    return files


def list_data_files_api(request):
    """
    GET /api/list-data-files/?source=clarity&type=daily&date=2025-09
    Returns JSON array of file info for the requested source, optionally
    filtered by type and date prefix.
    """
    source = request.GET.get('source', 'clarity').lower()
    if source not in ('tempo', 'clarity', 'fused'):
        return JsonResponse({'error': 'Invalid source. Use: tempo, clarity, fused'}, status=400)

    file_type = request.GET.get('type', '').lower()
    date_filter = request.GET.get('date', '').strip()

    files = _scan_data_files(source)

    # Filter by type
    if file_type:
        files = [f for f in files if f['type'] == file_type]

    # Filter by date (match YYYY-MM or YYYY-MM-DD in filename)
    if date_filter:
        files = [f for f in files if date_filter in f['filename']]

    return JsonResponse({'source': source, 'files': files})


def _geojson_to_csv(data):
    """
    Convert a GeoJSON FeatureCollection to CSV bytes.
    Extracts geometry coordinates and all properties as columns.
    For non-GeoJSON JSON files, returns the raw JSON as a single column.
    """
    output = io.StringIO()

    features = data.get('features', []) if isinstance(data, dict) else []
    if not features:
        # Not a FeatureCollection — try to handle as generic JSON list
        if isinstance(data, list):
            output.write('data\n')
            for item in data:
                output.write(json.dumps(item) + '\n')
            return '\ufeff'.encode('utf-8') + output.getvalue().encode('utf-8')
        output.write('No features found\n')
        return output.getvalue().encode('utf-8')

    # Collect all property keys across features
    all_keys = ['longitude', 'latitude']
    for feature in features:
        props = feature.get('properties', {})
        for key in props.keys():
            if key not in all_keys:
                all_keys.append(key)

    writer = csv.DictWriter(output, fieldnames=all_keys, extrasaction='ignore')
    writer.writeheader()

    for feature in features:
        geom = feature.get('geometry', {})
        props = feature.get('properties', {})
        row = {}

        # Extract coordinates
        coords = geom.get('coordinates', [])
        if coords and geom.get('type') == 'Point':
            row['longitude'] = coords[0]
            row['latitude'] = coords[1]

        # Merge properties
        row.update(props)
        writer.writerow(row)

    # Add UTF-8 BOM for Excel compatibility
    return '\ufeff'.encode('utf-8') + output.getvalue().encode('utf-8')


def community_rankings_api(request):
    """
    GET /api/community-rankings/
    Returns the community_rankings_ground_vs_tempo.csv as a JSON array.
    """
    csv_path = os.path.join(settings.BASE_DIR, 'dashboard', 'data',
                            'community_statistics', 'community_rankings_ground_vs_tempo.csv')
    if not os.path.isfile(csv_path):
        return JsonResponse({"error": "Rankings file not found"}, status=404)

    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            converted = {}
            for k, v in row.items():
                try:
                    converted[k] = float(v) if v.strip() else None
                except ValueError:
                    converted[k] = v
            rows.append(converted)

    return JsonResponse({"rankings": rows})


def export_data_file(request):
    """
    GET /api/export-data-file/?source=clarity&file=2025-09-01.geojson&format=geojson
    Downloads a single data file, optionally converted to CSV.
    Format options: geojson (original), csv (converted from geojson)
    """
    source = request.GET.get('source', 'clarity').lower()
    if source not in ('tempo', 'clarity', 'fused'):
        return HttpResponseNotFound('Invalid source')

    filename = request.GET.get('file', '').strip()
    if not filename:
        return HttpResponseNotFound('No file specified')

    fmt = request.GET.get('format', 'geojson').lower()

    source_dir = os.path.join(DATA_DIR, source)
    file_path = os.path.join(source_dir, filename)

    # Prevent path traversal
    if not os.path.abspath(file_path).startswith(os.path.abspath(source_dir)):
        return HttpResponseNotFound('Invalid file path')

    if not os.path.isfile(file_path):
        return HttpResponseNotFound(f'File not found: {filename}')

    with open(file_path, 'r', encoding='utf-8') as f:
        raw_content = f.read()

    if fmt == 'csv':
        try:
            data = json.loads(raw_content)
            csv_bytes = _geojson_to_csv(data)
            response = HttpResponse(csv_bytes, content_type='text/csv; charset=utf-8')
            # Rename extension to .csv
            base_name = os.path.splitext(filename)[0]
            response['Content-Disposition'] = f'attachment; filename="{base_name}.csv"'
            return response
        except json.JSONDecodeError:
            return HttpResponseNotFound('Cannot convert: invalid JSON')
    else:
        # Serve as GeoJSON/JSON
        if filename.endswith('.geojson'):
            content_type = 'application/geo+json'
        else:
            content_type = 'application/json'
        response = HttpResponse(raw_content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response