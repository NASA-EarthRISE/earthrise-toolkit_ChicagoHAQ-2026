from django.shortcuts import render
from django.http import JsonResponse

import re
from django.utils.timezone import datetime

#libraries for site/html render
from django.http import HttpResponse

#libraries for message log input
from django.shortcuts import redirect
from dashboard.forms import LogMessageForm
from dashboard.models import LogMessage

#library for lists/tables
from django.views.generic import ListView

# Terminal command for running/updating server: python manage.py runserver
# Website url for browser: http://127.0.0.1:8000/hello/VSCode

# Create your views here.
# Views are what the user sees when they interact with buttons and widgets


def home(request):
    return render(request, "dashboard/home.html")
    
def about(request):
    return render(request, "dashboard/about.html")

def contact(request):
    return render(request, "dashboard/contact.html")


def statushome(request):
    return JsonResponse({
        "status": "ok",
        "message": "TEMPO Dashboard Running",
        "links": {
            "map": "/map/",
        }
    })

def map_view(request):
    return render(request, 'dashboard/map.html')

def map_markers_api(request):
    """
    Simple marker API scaffold.
    GET  /api/markers/  → list saved markers from session
    POST /api/markers/  → save a marker to session
    """
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        markers = request.session.get('markers', [])
        markers.append({
            'id': len(markers) + 1,
            'lat': data.get('lat'),
            'lng': data.get('lng'),
            'label': data.get('label', f'Pin #{len(markers)+1}'),
        })
        request.session['markers'] = markers
        return JsonResponse({'status': 'saved', 'marker': markers[-1]})

    markers = request.session.get('markers', [])
    return JsonResponse({'markers': markers})

print("View site in browser at: http://127.0.0.1:8000/\n")