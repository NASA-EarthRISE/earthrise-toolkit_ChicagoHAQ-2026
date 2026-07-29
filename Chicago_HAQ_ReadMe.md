# Regional Ozone Precursor Dashboard

A real-time visualization tool for TEMPO satellite and Open Air Chicago ground sensor NO₂ data, developed by the
EarthRISE Developers Academy in collaboration with NASA LaRC and community partners.

---

## Table of Contents

### Getting Started
- [This Project](#this-project)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
  - [1. Python 3.14](#1-python-312)
  - [2. Git](#2-git)
  - [3. A terminal](#3-a-terminal)
  - [4. A code editor (recommended)](#4-a-code-editor-recommended)
- [Local Setup — Step by Step](#local-setup--step-by-step)
  - [Step 1 — Clone the repository](#step-1--clone-the-repository)
  - [Step 2 — Create a virtual environment](#step-2--create-a-virtual-environment)
  - [Step 3 — Install dependencies](#step-3--install-dependencies)
  - [Step 4 — Run database migrations](#step-4--run-database-migrations)
  - [Step 5 — (Optional) Create a superuser](#step-5--optional-create-a-superuser)
  - [Step 6 — Start the development server](#step-6--start-the-development-server)

### Project Architecture
- [Project Structure](#project-structure)
- [Running the Dashboard](#running-the-dashboard)
  - [Start the server](#start-the-server)
  - [Run on a different port](#run-on-a-different-port-if-8000-is-in-use)
  - [Run accessible on local network](#run-accessible-to-other-devices-on-your-local-network)
  - [Check for configuration errors](#check-for-configuration-errors-without-starting-the-server)
  - [Create migrations after editing models](#create-new-migration-files-after-editing-models)
- [Available Routes](#available-routes)
- [Frontend JavaScript Architecture](#frontend-javascript-architecture)
  - [time_utils.js](#time_utilsjs)
  - [map_init.js](#map_initjs)
  - [map_layers.js](#map_layersjs)
  - [data_loader.js](#data_loaderjs)
  - [map_controls.js](#map_controlsjs)
  - [export.js](#exportjs)
  - [home.js](#homejs)
  - [community.js](#communityjs)
  - [navbar.js](#navbarjs)

### Data
- [Data Models](#data-models)
  - [LogMessage](#logmessage)
  - [ActivityLog](#activitylog)
  - [File-based activity log](#file-based-activity-log)
- [Database](#database)
  - [Local development — SQLite](#local-development--sqlite)
  - [Production — PostgreSQL](#production--postgresql)
- [Processing Raw Data](#processing-raw-data)
  - [Available scripts](#available-scripts)
  - [Data pipeline overview](#data-pipeline-overview)
  - [Adding new processing scripts](#adding-new-processing-scripts)
- [Adding Data Files](#adding-data-files)
  - [Directory structure](#directory-structure)
  - [File naming conventions](#file-naming-conventions)
  - [Clarity (Open Air) data files](#clarity-open-air-data-files)
  - [TEMPO data files](#tempo-data-files)
  - [Fused data files](#fused-data-files)
  - [Community statistics files](#community-statistics-files)
  - [Date index files (dates.json)](#date-index-files-datesjson)
  - [Automatic file discovery](#automatic-file-discovery)

### Development Guide
- [Setting Up a New API Endpoint](#setting-up-a-new-api-endpoint)
  - [Step 1 — Write the view function](#step-1--write-the-view-function)
  - [Step 2 — Register the URL pattern](#step-2--register-the-url-pattern)
  - [Step 3 — Call from the frontend](#step-3--call-from-the-frontend)
  - [Query parameter filtering](#query-parameter-filtering)
  - [Complete example](#complete-example)
- [Adding a New Page](#adding-a-new-page)
  - [Step 1 — Create the template](#step-1--create-the-template)
  - [Step 2 — Add the view function](#step-2--add-the-view-function)
  - [Step 3 — Register the URL](#step-3--register-the-url)
  - [Step 4 — Add nav link](#step-4--add-nav-link)
- [Configuration & Environment Variables](#configuration--environment-variables)
  - [Local development settings](#local-development-settings)
  - [Production environment variables](#production-environment-variables)
  - [Generating a secure secret key](#generating-a-secure-secret-key)
- [Common Errors and Fixes](#common-errors-and-fixes)
  - [Virtual environment not active](#venv-is-not-showing-in-my-prompt)
  - [ModuleNotFoundError](#modulenotfounderror-no-module-named-)
  - [Port 8000 already in use](#port-8000-already-in-use)
  - [TemplateDoesNotExist](#templatedoesnotexist)
  - [Database table errors](#djangodbutilsoperationerror-no-such-table)
  - [Data file 404 errors](#data-file-not-found-404-errors)
  - [Dashboard webpage not updating after saved changes](#dashboard-webpage-not-updating-after-saved-changes)

### Deployment & Collaboration
- [Deploying to Production](#deploying-to-production)
  - [Procfile and Gunicorn](#procfile-and-gunicorn)
  - [runtime.txt](#runtimetxt)
  - [Collecting static files](#collecting-static-files)
  - [Deploying to Render](#deploying-to-render)
- [Making Changes with a Git Workflow](#making-changes-with-a-git-workflow)
  - [How pushing to GitHub shares your changes](#how-pushing-to-github-shares-your-changes-with-other-developers)
  - [First-time setup](#first-time-setup-on-a-new-machine)
  - [Daily workflow](#daily-workflow)
  - [Feature branches](#creating-a-feature-branch)

### Other
- [Extending the Project](#extending-the-project)
- [Support & Resources](#support--resources)
  - [Contact](#contact)
  - [Technical Paper](#technical-paper)
  - [Dashboard Tutorial](#dashboard-tutorial)

---

![Regional Ozone Dashboard](../docs/screenshots/regionalozone_dashboard.png)

---

## This Project

The **Regional Ozone Precursor Dashboard** is an interactive web application that visualizes nitrogen dioxide (NO₂) pollution data over the Chicago metropolitan region from multiple sources:

- **TEMPO (Tropospheric Emissions: Monitoring of Pollution)** — NASA's geostationary satellite instrument that provides hourly column measurements of NO₂ in molecules/cm².
- **Open Air Chicago (Clarity sensors)** — A network of ground-level air quality sensors deployed across Chicago communities, providing hourly NO₂ readings in ppb (parts per billion).
- **Fused Data** — A combination of TEMPO satellite and ground sensor data, aligned to a common linear ppb scale for direct comparison.

### Key features

- **Interactive map** with three time scales: hourly (with time-of-day slider), daily, and monthly.
- **Playback controls** to animate data changes over time.
- **Multiple display modes**: sensor-level pixels, community-area averages (colored Chicago community boundaries), and heatmaps.
- **Community statistics page** with Plotly charts comparing ground vs. TEMPO vs. Fused NO₂ levels, percentile rankings, and time-series trends.
- **Data export tools** to download data files in GeoJSON, CSV, or PNG map screenshots.
- **File-based activity logging** that tracks server starts, page refreshes, data exports, and map views.

The project is built with Django and uses a file-based data architecture — data files (GeoJSON, parquet, CSV) are stored on disk and served directly through API endpoints, with no intermediate database required for the pollution data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 6.0 |
| Language | Python 3.14.6 |
| Frontend | Django Templates + JavaScript (ES6) |
| Map library | Leaflet 1.9.4 (CDN) |
| Map drawing | Leaflet Draw 1.0.4 (CDN) |
| Heatmap | Leaflet Heat 0.2.0 (CDN) |
| Spatial analysis | Turf.js 6 (CDN) — point-in-polygon |
| Charting | Plotly.js (CDN) — community statistics |
| PNG export | html2canvas 1.4.1 (CDN) |
| File processing | Pandas, PyArrow |
| Numerical computing | NumPy |
| Database (local) | SQLite |
| Database (production) | PostgreSQL via `psycopg2-binary` |
| Static files | WhiteNoise |
| Production server | Gunicorn |
| Hosting | Heroku / Render |

---

## Prerequisites — Cold Start Checklist

Complete every item here before touching any project code. This is a true cold-start list for a machine that has nothing installed.

### 1. Python 3.14

This project requires **Python 3.14** (specified in `runtime.txt`).

Check if you have it:
```bash
python --version
# or
python3 --version
```

If you don't have Python 3.14, download it from https://www.python.org/downloads/ and install it. Make sure to check **"Add Python to PATH"** during the Windows installer.

After installing, confirm it works:
```bash
python --version
# Expected: Python 3.14.x
```

### 2. Git

Check if Git is installed:
```bash
git --version
```

If not, download from https://git-scm.com/downloads and install with default settings.

### 3. A terminal

- **Windows:** Use **PowerShell** or **Git Bash** (installed with Git). Do not use the old `cmd.exe`.
- **Mac/Linux:** Use the built-in Terminal app.

### 4. A code editor (recommended)

[VS Code](https://code.visualstudio.com/) is recommended. Install the **Python** extension by Microsoft once you open the project.

---

## Local Setup — Step by Step

Follow these steps in order. Do not skip steps. Type and 'Enter' each line one-by-one.

### Step 1 — Clone the repository

```bash
git clone https://github.com/NASA-EarthRISE-DevelopersAcademy/develop-AQ_LaRC_2026.git
cd develop-AQ_LaRC_2026
```

You are now inside the project root. All remaining commands run from this directory unless noted otherwise.

### Step 2 — Create a virtual environment

A virtual environment isolates this project's Python packages from everything else on your machine. You only do this once.

**Windows (PowerShell):**
```powershell
python -m venv venv
venv\Scripts\activate
```

**Mac / Linux:**
```bash
python3.12 -m venv venv
source venv/bin/activate
```

When the virtual environment is active, your terminal prompt will show `(venv)` at the start. **Every command from this point forward assumes the virtual environment is active.** If you close your terminal and come back later, you must re-run the activate command above before doing anything else.

To deactivate the virtual environment when you're done working:
```bash
deactivate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

This installs Django, Gunicorn, WhiteNoise, psycopg2, pandas, pyarrow, numpy, and all other packages the project needs. It may take 30–60 seconds.

Verify the install worked:
```bash
python -m django --version
# Expected: 6.0.x
```

### Step 4 — Run database migrations

Django uses migrations to create and update database tables. Run this once on first setup, and again any time someone adds new migrations to the repo.

```bash
python manage.py migrate
```

Expected output — you should see a list of migrations each ending in `OK`:
```
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, dashboard, sessions
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying auth.0001_initial... OK
  ...
```

If you see `OK` for all items, the database is ready.

### Step 5 — (Optional) Create a superuser

If you want to access the Django admin panel at `/admin/`, create an admin account:

```bash
python manage.py createsuperuser
```

You'll be prompted for a username, email, and password. The email can be left blank. Use any password you like for local development.

### Step 6 — Start the development server

```bash
python manage.py runserver
```

Expected output:
```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
Django version 6.0.x, using settings 'config.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

Open your browser and go to:

| URL | What you see |
|---|---|
| `http://127.0.0.1:8000/` | Dashboard home page |
| `http://127.0.0.1:8000/map/` | Interactive pollution map |
| `http://127.0.0.1:8000/community/` | Community statistics with charts |
| `http://127.0.0.1:8000/export/` | Data export tools |
| `http://127.0.0.1:8000/admin/` | Django admin login |

To stop the server press `CTRL + C`.

---

## Project Structure

```
develop-AQ_LaRC_2026/
│
├── config/                     # Django project configuration
│   ├── settings.py             # All settings: database, apps, static files, timezone
│   ├── urls.py                 # Root URL router — links to dashboard/urls.py
│   ├── wsgi.py                 # WSGI entry point (used by Gunicorn in production)
│   └── asgi.py                 # ASGI entry point (for future async support)
│
├── dashboard/                  # Main Django app — all feature code lives here
│   ├── migrations/             # Auto-generated database migration files
│   ├── data/                   # Study period data products stored here
│   │   ├── clarity/            # Open Air Chicago hourly, daily, monthly GeoJSONs, dates.json
│   │   ├── fused/              # Fused hourly, daily, monthly GeoJSONs, dates.json
│   │   ├── tempo/              # TEMPO hourly, daily, monthly GeoJSONs, dates.json
│   │   ├── community_statistics/  # Community percentile & ranking datasets (CSV, parquet)
│   │   └── activity_log.json   # File-based activity log (auto-created at runtime)
│   ├── templates/
│   │   └── dashboard/
│   │       ├── includes/       # Reusable HTML fragments (navbar, map sidebar)
│   │       └── pages/          # Web page templates
│   │           ├── about.html
│   │           ├── community.html    # Community statistics (map + Plotly charts)
│   │           ├── export.html       # Data export page
│   │           ├── home.html         # Home page with server stats
│   │           ├── info.html         # Study area and data product information
│   │           ├── map.html          # Full interactive pollution map (Leaflet)
│   │           └── userguide.html    # Dashboard tutorial
│   ├── static/
│   │   └── dashboard/
│   │       ├── css/            # Stylesheet files (one per page/feature)
│   │       │   ├── layout.css      # Base layout: nav, footer, body, toast
│   │       │   ├── map.css         # Map page: container, overlays, legends
│   │       │   ├── map_sidebar.css # Map sidebar: controls, sliders, playback
│   │       │   ├── community.css   # Community statistics page
│   │       │   └── export.css      # Data export page
│   │       ├── images/         # Logos, gradients, team photos, compass SVG
│   │       ├── js/             # Application JavaScript
│   │       │   ├── navbar.js
│   │       │   ├── export.js
│   │       │   ├── home.js
│   │       │   ├── community.js
│   │       │   └── map/        # Map-related JS modules
│   │       │       ├── time_utils.js     # Shared time/date conversion utilities
│   │       │       ├── map_init.js       # Map configuration, global state, initialization
│   │       │       ├── map_layers.js     # Color scales, layer rendering, legends
│   │       │       ├── data_loader.js    # Data fetching, date loading, caching
│   │       │       └── map_controls.js   # UI controls, events, notices, initialization
│   │       └── layers/         # Chicago boundary GeoJSON files
│   │           ├── Chicago.geojson
│   │           ├── ChicagoCommunityAreas.geojson
│   │           └── oacd.geojson
│   ├── views.py                # Request handlers and API endpoints
│   ├── urls.py                 # URL patterns for this app
│   ├── models.py               # Database models (LogMessage, ActivityLog)
│   ├── forms.py                # Django form for message logging
│   ├── admin.py                # Django admin registration
│   └── apps.py                 # App configuration
│
├── processing-scripts/         # Data processing notebooks and scripts
│   ├── clarity-tempo-aggregation.ipynb
│   ├── clarity-tempo-fusion.ipynb
│   └── ...
│
├── manage.py                   # Django CLI entry point
├── requirements.txt            # Python package dependencies
├── Procfile                    # Heroku/Render process definition
├── runtime.txt                 # Python version for hosting platforms
└── db.sqlite3                  # Local SQLite database (auto-created)
```

---

## Running the Dashboard

### Start the server
```bash
python manage.py runserver
```

### Run on a different port (if 8000 is in use)
```bash
python manage.py runserver 8080
```

### Run accessible to other devices on your local network
```bash
python manage.py runserver 0.0.0.0:8000
```

### Check for configuration errors without starting the server
```bash
python manage.py check
```

### Create new migration files after editing `models.py`
```bash
python manage.py makemigrations
python manage.py migrate
```

---

## Available Routes

| Method | URL | Description |
|---|---|---|
| GET | `/` | Home page with server stats and activity log |
| GET | `/about/` | About the project page |
| GET | `/info/` | Study area and data product information |
| GET | `/tutorial/` | User guide / tutorial page |
| GET | `/community/` | Community statistical analysis (map + Plotly charts) |
| GET | `/export/` | Data export page |
| GET | `/map/` | Interactive map page (redirects to hourly) |
| GET | `/map/hourly/` | Hourly observation window map |
| GET | `/map/daily/` | Daily aggregated map |
| GET | `/map/monthly/` | Monthly climatology map |
| GET | `/api/data-status/` | JSON: data source statuses + recent activities |
| GET | `/api/community-rankings/` | JSON: community rankings CSV data |
| GET | `/api/community-no2-data/` | JSON: community NO₂ time series (parquet) |
| GET | `/api/clarity-dates/` | JSON: available Clarity dates index |
| GET | `/api/list-data-files/` | JSON: list data files by source/type/date |
| GET | `/api/export-data-file/` | Download a data file (GeoJSON/CSV) |
| GET | `/data/clarity/<filename>` | Serve a Clarity data file directly |
| GET | `/data/tempo/<filename>` | Serve a TEMPO data file directly |
| GET | `/data/fused/<filename>` | Serve a fused data file directly |
| GET | `/admin/` | Django admin panel (requires superuser) |

---

## Frontend JavaScript Architecture

The dashboard's frontend is split into modular JavaScript files under `dashboard/static/dashboard/js/`. Understanding this structure helps when customizing maps, controls, or export behavior.

### time_utils.js

**Purpose:** Shared time/date conversion and formatting utilities, exported as a `TimeUtils` namespace (IIFE module). Loaded first in the map JS chain.

**Load order:** `time_utils.js` → `map_init.js` → `map_layers.js` → `data_loader.js` → `map_controls.js`

Key responsibilities:
- `parseUTCString()` — parses UTC date strings (with or without timezone indicator) into JavaScript `Date` objects
- `getChicagoParts()` — returns an object with year, month, day, hour, and timeZoneName for a given Date in Chicago time using `Intl.DateTimeFormat`
- `getChicagoDateString()` — extracts a Chicago `YYYY-MM-DD` string from a UTC string
- `formatCentralTime()` — formats a UTC timestamp to a readable Central Time string (e.g., "09:30:45 CDT")
- `formatCentralDate()` — formats a UTC string to a human-readable Chicago date (e.g., "Sep 15, 2025")
- `isDailyDate()` / `isMonthlyDate()` — regex checks for `YYYY-MM-DD` and `YYYY-MM` formats
- `toMonthKey()` / `toDailyKey()` — normalize date strings to month or daily keys
- `formatMonthForDisplay()` — converts a `YYYY-MM` key to a localized month name (e.g., "September 2025")
- `formatDailyForDisplay()` — converts a `YYYY-MM-DD` key to a localized date string (e.g., "September 1, 2025")
- `formatDateForDisplay()` — universal formatter that dispatches to monthly or daily based on input
- `formatHourForDisplay()` — converts a slider hour (0–23) and date to a human-readable label (e.g., "2 PM CDT"), with DST gap handling
- `getPreviousDay()` — returns the day before a given `YYYY-MM-DD` string
- `extractChicagoDateHour()` — parses a feature's `time` property and returns `{ date, hour }` in Chicago timezone

### map_init.js

**Purpose:** Map configuration, global state, backward-compatibility wrappers, and initialization. Second in the load chain.

Key responsibilities:
- Creates the `L.map()` instance centered on Chicago `[41.8, -87.629]` with Esri basemap tiles
- Adds the home/reset button control (inline SVG house icon)
- Defines backward-compatibility wrapper functions (`formatCentralTime`, `formatHourForDisplay`, `formatMonthForDisplay`, etc.) that delegate to `TimeUtils`
- Sets global state variables: color scale constants (`CLARITY_GLOBAL_MAX/MIN`, `TEMPO_GLOBAL_MAX/MIN`, `FUSION_GLOBAL_MAX/MIN`), `selectedHour`, `displayMode`, `currentDataProduct`, `dates`, `allDates`, caching vars, layer groups
- `normalizeDataProduct()` — maps user-facing product names ("openaq", "openair") to internal keys ("clarity")
- `startNewLoad()` / `isActiveLoad()` — load token system to prevent stale async renders
- `canRenderTempo()` — guard to block TEMPO renders when product has switched
- `clearDataLayers()` — removes all data layers, community layers, and heat layers from the map
- `updateBottomControlVisibility()` — shows/hides hour controls based on `TIME_SCALE`

### map_layers.js

**Purpose:** Color scales, feature rendering, community area drawing, and legend updates. Third in the load chain.

Key responsibilities:
- Defines color scales for each data source:
  - Clarity: linear 0–50 ppb (`getColorClarity`)
  - TEMPO: sqrt-based 1e9–5e16 molecules/cm² (`getColorTempo`)
  - Unified `getColor()` delegates to the correct scale based on `currentDataProduct`
- Clarity rendering: `renderFeatures()` — groups sensor readings by name, creates circle markers sized by average NO₂
- Community area rendering: `drawCommunityAreas()` — computes per-community averages using Turf.js point-in-polygon
- TEMPO rendering: `renderTempoFeatures()` (hourly grid cells), `renderDailyTempoData()`, `renderMonthlyTempoData()`
- TEMPO community areas: `drawTempoCommunityAreas()`
- Fusion rendering: `renderFusionFeatures()` (grid cells), `renderFusionCommunityAreas()` (weighted community averages)
- `getFusionValue()` — extracts `no2_estimate` from fusion feature properties
- Legend: `updateLegend()` — updates legend title and numbers based on active data product
- `updateIndividualModeLabel()` — changes "Individual Sensor" / "Individual Pixel" / "Individual Grid Cell" label text

### data_loader.js

**Purpose:** Data fetching, date loading, caching, and prefetching. Fourth in the load chain.

Key responsibilities:
- CSV parsing and community helpers: `parseSimpleCSV()`, `normalizeCommunityName()`, `getCommunityFeatureName()`
- Fusion community CSV loader: `loadFusionCommunityCSV()` — loads and caches `/data/fused/fused_hourly_by_community.csv`
- Hour bucket builders and prefetching: `buildHourBuckets()`, `prefetchNextDay()`, `prefetchTempoNextDay()`
- Fusion data loaders: `loadFusionHourly()`, `loadFusionDaily()`, `loadFusionMonthly()`, `loadFusionCommunities()`
- Clarity data loaders: `loadDailySensors()`, `loadMonthlySensors()`, `loadDailyCommunities()`, `loadMonthlyCommunities()`, `loadDateRange()`, `renderCommunityRange()`
- TEMPO data loaders: `loadDailyTempo()`, `loadMonthlyTempo()`, `loadTempoDailyCommunities()`, `loadTempoMonthlyCommunities()`, `loadTempoDateRange()`, `loadTempoCommunityDateRange()`
- Invalid date handling: `removeInvalidHourlyDate()` — removes dates with no valid hourly data from the slider
- Fusion no-data messages: `showFusionNoDataMessage()`
- Unified router: `loadDate()` — dispatches to the correct loader based on product, time scale, and display mode

### map_controls.js

**Purpose:** UI controls, event bindings, notices, playback, and page initialization. Fifth (last) in the load chain.

Key responsibilities:
- Loading and notice UI: `showLoading()`, `hideLoading()`, `showNoDataNotice()`, `hideNoDataNotice()`, `showMapWarningNotice()`, `hideMapWarningNotice()`
- Toast notifications: `showToast()` — displays temporary messages on the map
- PNG export: `exportMapAsPNG()` — captures map container as PNG via html2canvas
- Scalebar: `updateScaleBar()` — draws dynamic scalebar ruler with proper units (ft/mi) based on zoom level
- Playback: `resetPlaybackUI()` — resets play/pause button states
- Map navigation: `refreshMap()`, `updateDateAndTimeLabels()`, `selectMapType()`, `handleMapTypeClick()`
- Aggregation changes: `changeAggregation()` — switches TIME_SCALE, updates UI, reloads dates
- Date/hour preference capture: `captureCurrentDateHourPreference()`, `findBestDateIndex()`, `applyPreferredDateAndHourAfterDateLoad()`
- Page init (inside `setTimeout`): binds all event listeners for sliders, play/pause, data product radios, display mode radios, sidebar toggle, help panel, region dropdown, load buttons, and coordinate/zoom display

### export.js

**Purpose:** Export page tab navigation and export form logic.

Key responsibilities:
- Tab switching between Clarity, TEMPO, and Fused export options
- Date picker and file type selectors
- File format options (GeoJSON, CSV)
- Preview and download triggers

### home.js

**Purpose:** Home page interactivity and server statistics display.

Key responsibilities:
- Displays server uptime and start time
- Renders recent activity notifications
- Auto-refreshes server status data

### community.js

**Purpose:** Community statistics page logic and Plotly chart rendering.

Key responsibilities:
- Fetches community NO₂ data from `/api/community-no2-data/`
- Renders Plotly charts (time series, bar charts, scatter plots)
- Handles community selection filters
- Displays percentile rankings and ground-vs-TEMPO comparisons

### navbar.js

**Purpose:** Navigation bar interactivity.

Key responsibilities:
- Active page highlighting
- Mobile menu toggle behavior

---

## Data Models

The project defines two Django models in `dashboard/models.py` for tracking user messages and system activity.

### LogMessage

A simple model for storing user-submitted messages through a form on the frontend.

| Field | Type | Description |
|---|---|---|
| `message` | `CharField(max_length=300)` | The message text |
| `log_date` | `DateTimeField` | When the message was logged |

Messages are submitted through `LogMessageForm` in `dashboard/forms.py`.

### ActivityLog

Tracks system events and user interactions for the "Recent Activity" feed on the home page.

| Field | Type | Description |
|---|---|---|
| `activity_type` | `CharField` (choices) | Event category |
| `title` | `CharField(max_length=200)` | Short summary |
| `details` | `TextField` (blank) | Optional longer description |
| `timestamp` | `DateTimeField` | When the event occurred |

**Activity types:**
- `server_start` — Server started/restarted
- `data_ingestion` — Data ingestion completed
- `system_status` — Health check or status change
- `notification` — General notification

### File-based activity log

In addition to the database model, `views.py` implements a **file-based activity log** stored in `dashboard/data/activity_log.json`. The location is defined by the `ACTIVITY_FILE` constant in `views.py`:

```python
ACTIVITY_FILE = os.path.join(settings.BASE_DIR, 'dashboard', 'data', 'activity_log.json')
```

This provides a lightweight, no-database alternative for tracking:

- Server starts
- Page refreshes
- Map views (hourly/daily/monthly)
- Community analysis opens
- Data exports
- Notification events

The log keeps the most recent 50 entries.

---

## Database

### Local development — SQLite

SQLite requires no setup. The file `db.sqlite3` is created automatically when you run `python manage.py migrate`. It lives in the project root and stores:
- Django auth users (superuser accounts)
- `LogMessage` entries
- `ActivityLog` entries

This is fine for development and testing. The pollution data (GeoJSON, parquet, CSV) is stored as files on disk, not in the database.

### Production — PostgreSQL

When deploying to Heroku or Render, add a **PostgreSQL** database service. The platform will automatically inject a `DATABASE_URL` environment variable. The project already has `dj-database-url` and `psycopg2-binary` installed to handle this connection.

To wire it up, add this to the bottom of `config/settings.py`:

```python
import dj_database_url
import os

if not DEBUG:
    DATABASES['default'] = dj_database_url.config(
        conn_max_age=600,
        ssl_require=True,
    )
```

---

## Processing Raw Data

The `processing-scripts/` directory contains Jupyter notebooks and Python scripts that transform raw satellite and ground sensor data into the dashboard-ready data products (GeoJSON, parquet, CSV) stored in `dashboard/data/`.

> **Note:** These scripts are still being organized. Not all processing steps are fully documented yet. Use these as a starting point and reach out to the team for the latest data pipeline details.

### Available scripts

| Script | Purpose |
|---|---|
| `clarity-prelim.ipynb` | Preliminary cleaning and exploration of Open Air Chicago (Clarity) sensor data |
| `clarity-tempo-aggregation.ipynb` | Aggregates Clarity and TEMPO data into daily/monthly products |
| `clarity-tempo-fusion.ipynb` | Fuses TEMPO satellite data with Clarity ground sensor data onto a common scale |
| `Fused Community Stats Generation.py` | Generates community-level statistics from fused data |
| `merge_fusion_by_community.py` | Merges fused data by Chicago community area |
| `Update Community Percentile CSV.py` | Updates the community percentile ranking CSV |

### Data pipeline overview

The general data processing flow from raw satellite/sensor data to dashboard-ready products:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: DOWNLOAD RAW DATA                                                  │
│  Source: NASA Earthdata (TEMPO)  +  OpenAQ API (Open Air Chicago sensors)   │
│  Script: clarity-prelim.ipynb                                               │
│  Output: Raw CSV/NetCDF files                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: CLEAN AND FILTER                                                   │
│  Remove invalid readings, filter by Chicago study area, handle missing data │
│  Script: clarity-prelim.ipynb                                               │
│  Output: Cleaned CSV files                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: AGGREGATE                                                          │
│  Convert hourly readings into daily and monthly GeoJSON products             │
│  Script: clarity-tempo-aggregation.ipynb                                    │
│  Output: daily_sensor_*.geojson, monthly_sensor_*.geojson                   │
│         daily_community_*.geojson, monthly_community_*.geojson              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: FUSE TEMPO + GROUND DATA                                           │
│  Align TEMPO satellite column data with ground sensor ppb using regression  │
│  Script: clarity-tempo-fusion.ipynb                                         │
│  Output: Fused GeoJSON files in dashboard/data/fused/                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: GENERATE COMMUNITY STATISTICS                                      │
│  Compute per-community averages, percentiles, and ground-vs-TEMPO rankings  │
│  Scripts: Fused Community Stats Generation.py                               │
│          merge_fusion_by_community.py                                       │
│          Update Community Percentile CSV.py                                 │
│  Output: community_no2_master.parquet, community_rankings_ground_vs_tempo.csv│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: PLACE FILES IN DASHBOARD DATA FOLDERS                              │
│  Copy output files into the correct subdirectories:                         │
│    • dashboard/data/clarity/     — Open Air sensor GeoJSON                  │
│    • dashboard/data/tempo/       — TEMPO satellite GeoJSON                  │
│    • dashboard/data/fused/       — Fused GeoJSON                            │
│    • dashboard/data/community_statistics/  — CSV and parquet files          │
│  Don't forget to update dates.json index files!                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Note:** This pipeline is still being refined. Not every step is fully automated or documented. If you're unsure which script to run for a particular transformation, reach out to the team for the latest workflow details.

### Adding new processing scripts

1. Create a new `.ipynb` notebook or `.py` script in `processing-scripts/`.
2. Use `pandas` and `pyarrow` for data manipulation (already in `requirements.txt`).
3. Output files should be saved to the appropriate subdirectory in `dashboard/data/`:
   - Map data → `dashboard/data/{clarity,tempo,fused}/`
   - Community stats → `dashboard/data/community_statistics/`
4. Follow the file naming conventions documented in the [Adding Data Files](#adding-data-files) section below.
5. Update the date index files (`dates.json`) after adding new data.

---

## Adding Data Files

The dashboard serves data files directly from the `dashboard/data/` directory. **No code changes are needed** to add new data files — the backend automatically discovers new files through the `_scan_data_files()` function in `views.py`, and the frontend fetches them via `fetch()` calls.

### Directory structure

```
dashboard/data/
├── clarity/                   # Open Air Chicago (ground sensor) data
│   ├── dates.json             # Index of available dates
│   ├── daily_sensor_YYYY-MM-DD.geojson
│   ├── daily_community_YYYY-MM-DD.geojson
│   ├── monthly_sensor_YYYY-MM.geojson
│   └── monthly_community_YYYY-MM.geojson
├── tempo/                     # TEMPO satellite data
│   ├── TEMPOdates.json        # Index of available dates
│   ├── TEMPOdaily_dates.json  # Index of available daily dates
│   ├── day_YYYY-MM-DD.geojson
│   ├── day_community_YYYY-MM-DD.geojson
│   └── month_YYYY-MM.geojson
├── fused/                     # Fused (TEMPO + ground) data
│   ├── dates.json
│   └── ...
└── community_statistics/      # Community-level statistics
    ├── community_rankings_ground_vs_tempo.csv
    └── community_no2_master.parquet
```

### File naming conventions

The `_scan_data_files()` function in `views.py` classifies files by their filename prefix. Follow these patterns:

| Prefix | Classified as | Example |
|---|---|---|
| `daily_sensor_` | daily pixel | `daily_sensor_2025-09-01.geojson` |
| `daily_community_` | daily community | `daily_community_2025-09-01.geojson` |
| `monthly_sensor_` | monthly pixel | `monthly_sensor_2025-09.geojson` |
| `monthly_community_` | monthly community | `monthly_community_2025-09.geojson` |
| `day_` (TEMPO) | daily pixel | `day_2025-09-01.geojson` |
| `day_community_` (TEMPO) | daily community | `day_community_2025-09-01.geojson` |
| `month_` (TEMPO) | monthly pixel | `month_2025-09.geojson` |
| `YYYY-MM-DD` | daily | `2025-09-01.geojson` |

### Clarity (Open Air) data files

Place Open Air Chicago sensor GeoJSON files in `dashboard/data/clarity/`. The frontend fetches these from `/data/clarity/<filename>`.

**Clarity data file naming conventions:**

| File Type | Naming Pattern | Example |
|---|---|---|
| Hourly GeoJSON | `YYYY-MM-DD.geojson` | `2025-09-01.geojson` |
| Daily sensor GeoJSON | `daily_sensor_YYYY-MM-DD.geojson` | `daily_sensor_2025-09-01.geojson` |
| Daily community GeoJSON | `daily_community_YYYY-MM-DD.geojson` | `daily_community_2025-09-01.geojson` |
| Monthly sensor GeoJSON | `monthly_sensor_YYYY-MM.geojson` | `monthly_sensor_2025-09.geojson` |
| Monthly community GeoJSON | `monthly_community_YYYY-MM.geojson` | `monthly_community_2025-09.geojson` |

**To add a new daily sensor file:**
1. Save your GeoJSON as `daily_sensor_YYYY-MM-DD.geojson` (e.g., `daily_sensor_2025-09-15.geojson`)
2. Place it in `dashboard/data/clarity/`
3. Add the date to `dashboard/data/clarity/dates.json`
4. Restart the server — the file will be automatically available
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/clarity/daily_sensor_2025-09-15.geojson` to confirm the file is served correctly. If you see a 404 error or the file is not found, see the [Data file not found (404 errors)](#data-file-not-found-404-errors) section below.

**To add a new daily community file:**
1. Save your GeoJSON as `daily_community_YYYY-MM-DD.geojson` (e.g., `daily_community_2025-09-15.geojson`)
2. Place it in `dashboard/data/clarity/`
3. Add the date to `dashboard/data/clarity/dates.json`
4. Restart the server
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/clarity/daily_community_2025-09-15.geojson` to confirm the file is served correctly.

**To add a new monthly file:**
1. Save your GeoJSON as `monthly_sensor_YYYY-MM.geojson` or `monthly_community_YYYY-MM.geojson` (e.g., `monthly_sensor_2025-09.geojson`)
2. Place it in `dashboard/data/clarity/`
3. Restart the server
4. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/clarity/monthly_sensor_2025-09.geojson` to confirm the file is served correctly.

### TEMPO data files

Place TEMPO satellite GeoJSON files in `dashboard/data/tempo/`. The frontend fetches these from `/data/tempo/<filename>`.

**TEMPO data file naming conventions:**

| File Type | Naming Pattern | Example |
|---|---|---|
| Hourly GeoJSON | `YYYY-MM-DD.geojson` | `2025-09-01.geojson` |
| Daily GeoJSON | `day_YYYY-MM-DD.geojson` | `day_2025-09-01.geojson` |
| Daily community GeoJSON | `day_community_YYYY-MM-DD.geojson` | `day_community_2025-09-01.geojson` |
| Monthly GeoJSON | `month_YYYY-MM.geojson` | `month_2025-09.geojson` |

**To add a new daily TEMPO file:**
1. Save your GeoJSON as `day_YYYY-MM-DD.geojson` (e.g., `day_2025-09-15.geojson`)
2. Place it in `dashboard/data/tempo/`
3. Add the date to the appropriate TEMPO dates index file (`TEMPOdates.json` or `TEMPOdaily_dates.json`)
4. Restart the server
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/tempo/day_2025-09-15.geojson` to confirm the file is served correctly. If you see a 404 error or the file is not found, see the [Data file not found (404 errors)](#data-file-not-found-404-errors) section below.

**To add a new daily community TEMPO file:**
1. Save your GeoJSON as `day_community_YYYY-MM-DD.geojson` (e.g., `day_community_2025-09-15.geojson`)
2. Place it in `dashboard/data/tempo/`
3. Add the date to the appropriate TEMPO dates index file
4. Restart the server
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/tempo/day_community_2025-09-15.geojson` to confirm the file is served correctly.

**To add a new monthly TEMPO file:**
1. Save your GeoJSON as `month_YYYY-MM.geojson` (e.g., `month_2025-09.geojson`)
2. Place it in `dashboard/data/tempo/`
3. Restart the server
4. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/tempo/month_2025-09.geojson` to confirm the file is served correctly.

### Fused data files

Place fused (TEMPO + ground sensor) GeoJSON files in `dashboard/data/fused/`. The frontend fetches these from `/data/fused/<filename>`.

**Fused data file naming conventions:**

| File Type | Naming Pattern | Example |
|---|---|---|
| Hourly GeoJSON | `YYYY-MM-DD.geojson` | `2025-09-01.geojson` |
| Daily GeoJSON | `day_YYYY-MM-DD.geojson` | `day_2025-09-01.geojson` |
| Monthly GeoJSON | `month_YYYY-MM.geojson` | `month_2025-09.geojson` |
| Community CSV | `fused_hourly_by_community.csv` | (single file, updated in place) |

**To add a new fused hourly file:**
1. Save your GeoJSON as `YYYY-MM-DD.geojson` (e.g., `2025-09-15.geojson`)
2. Place it in `dashboard/data/fused/`
3. Add the date to `dashboard/data/fused/dates.json`
4. Restart the server — the file will be automatically available
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/fused/2025-09-15.geojson` to confirm the file is served correctly. If you see a 404 error or the file is not found, see the [Data file not found (404 errors)](#data-file-not-found-404-errors) section below.

**To add a new fused daily file:**
1. Save your GeoJSON as `day_YYYY-MM-DD.geojson` (e.g., `day_2025-09-15.geojson`)
2. Place it in `dashboard/data/fused/`
3. Update the corresponding `dates.json` index file
4. Restart the server
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/fused/day_2025-09-15.geojson` to confirm the file is served correctly.

**To add a new fused monthly file:**
1. Save your GeoJSON as `month_YYYY-MM.geojson` (e.g., `month_2025-09.geojson`)
2. Place it in `dashboard/data/fused/`
3. Update the corresponding `dates.json` index file
4. Restart the server
5. **Verify in browser:** Navigate to `http://127.0.0.1:8000/data/fused/month_2025-09.geojson` to confirm the file is served correctly.

### Community statistics files

Community-level statistics are stored in `dashboard/data/community_statistics/`:

| File | Format | Used by |
|---|---|---|
| `community_rankings_ground_vs_tempo.csv` | CSV | `/api/community-rankings/` endpoint |
| `community_no2_master.parquet` | Parquet | `/api/community-no2-data/` endpoint (read with pandas) |

To update these files, replace the existing file with the same filename. No code changes are needed.

### Date index files (dates.json)

Each data source directory contains a `dates.json` file that lists all available dates. The frontend reads these to populate the date slider.

**Example `dates.json` format:**
```json
{
  "dates": [
    "2025-09-01",
    "2025-09-02",
    "2025-09-03"
  ]
}
```

After adding new data files, update the corresponding `dates.json` to include the new date(s).

### Automatic file discovery

The `list_data_files_api()` view endpoint (`/api/list-data-files/`) automatically scans the data directories and returns a list of all files, optionally filtered by source, type, and date. This powers the export page's file browser. No manual configuration is needed — just drop files into the correct directory.

---

## Setting Up a New API Endpoint

An **API endpoint** is a specific URL that, when visited, returns data (usually in JSON format) instead of an HTML web page. The frontend JavaScript uses these endpoints to fetch data dynamically without reloading the page. For example, the map page calls `/api/clarity-dates/` to get the list of available dates for the slider.

The dashboard uses Django **view functions** that return `JsonResponse` for API endpoints. Think of a view function as a handler: when someone visits a URL, Django calls the corresponding view function, which processes the request and sends back a response.

Adding a new endpoint is a three-step process: **write the function** → **register the URL** → **call it from the frontend**.

### Step 1 — Write the view function

A view function is a regular Python function that takes an HTTP `request` as its input and returns an HTTP response. Open `dashboard/views.py` and add a new function:

```python
from django.http import JsonResponse

def my_new_api(request):
    """GET /api/my-data/ — Returns custom data."""
    # Access query parameters from the URL
    # Example URL: /api/my-data/?community=Hyde+Park
    community = request.GET.get('community', '').strip()

    # Build your response data as a Python dictionary
    data = {
        "source": "custom",
        "count": 42,
    }

    # JsonResponse converts the dictionary to JSON and sends it back to the browser
    return JsonResponse(data)
```

**What this does:**
- `request` — contains all the information about the incoming HTTP request (URL, query parameters, headers, etc.).
- `request.GET.get('community', '')` — reads the `community` parameter from the URL query string. If it's not present, it defaults to an empty string.
- `JsonResponse(data)` — converts the Python dictionary `data` into a JSON object and returns it with the correct `application/json` content type header.

### Step 2 — Register the URL pattern

Django doesn't automatically know about your new function. You need to tell Django which URL should trigger which view function. This mapping is done in `dashboard/urls.py`.

Open `dashboard/urls.py` and add a new `path()` entry to the `urlpatterns` list:

```python
urlpatterns = [
    # ... existing routes ...
    path("api/my-data/", views.my_new_api, name="my_new_api"),
]
```

**What each part means:**
- `"api/my-data/"` — the URL path (relative to the domain). When someone visits `http://127.0.0.1:8000/api/my-data/`, Django matches this pattern.
- `views.my_new_api` — the function to call. Django automatically passes the `request` object as the first argument.
- `name="my_new_api"` — a human-readable name you can reference in templates and other parts of the code (e.g., `{% url 'my_new_api' %}` in templates).

### Step 3 — Call from the frontend

Now that your endpoint is live, you can call it from JavaScript (in a template or a static JS file) or test it directly in your browser.

**Test in browser:** Open `http://127.0.0.1:8000/api/my-data/?community=Hyde+Park` — you should see the JSON response.

**Call from JavaScript:** Use the `fetch()` API to make an HTTP request and process the JSON response:

```javascript
fetch('/api/my-data/?community=Hyde%20Park')
  .then(response => response.json())  // Parse the JSON response
  .then(data => console.log(data));   // Use the data (e.g., display it, render a chart)
```

**What this does:**
- `fetch('/api/my-data/?community=Hyde%20Park')` — sends a GET request to the endpoint.
- `.then(response => response.json())` — converts the raw HTTP response into a JavaScript object.
- `.then(data => ...)` — now you can use `data.source`, `data.count`, etc., in your JavaScript code.

### Query parameter filtering

Query parameters let the frontend control what data the API returns without changing the URL structure. This is how the existing `/api/community-no2-data/?community=Hyde+Park` endpoint filters data for a specific community.

Use `request.GET.get('param_name', 'default_value')` to read any query parameter:

```python
def filtered_data_api(request):
    # Read parameters with defaults
    source = request.GET.get('source', 'clarity').lower()  # Defaults to 'clarity'
    date   = request.GET.get('date', '').strip()            # Defaults to empty string
    limit  = int(request.GET.get('limit', 100))             # Defaults to 100

    # Filter your data based on parameters...
    # For example, only return data matching the requested source and date

    return JsonResponse({"results": filtered_data})
```

**Example URL:** `/api/filtered-data/?source=tempo&date=2025-09-01&limit=50`

### Complete example

Here is a complete example that serves sensor readings from a GeoJSON file, with optional filtering by community name:

**`dashboard/views.py`:**
```python
def sensor_readings_api(request):
    """
    GET /api/sensor-readings/?date=2025-09-01&community=Loop
    Returns sensor data from a daily GeoJSON file, optionally filtered by community.
    """
    import os
    import json

    # Step 1: Read query parameters
    date = request.GET.get('date', '').strip()
    community = request.GET.get('community', '').strip()

    # Step 2: Validate required parameters
    if not date:
        return JsonResponse({"error": "date parameter required"}, status=400)

    # Step 3: Build the file path
    file_path = os.path.join(
        settings.BASE_DIR, 'dashboard', 'data', 'clarity',
        f'daily_sensor_{date}.geojson'
    )

    # Step 4: Check if the file exists
    if not os.path.isfile(file_path):
        return JsonResponse({"error": f"No data for date {date}"}, status=404)

    # Step 5: Read and parse the GeoJSON file
    with open(file_path, 'r') as f:
        data = json.load(f)

    features = data.get('features', [])

    # Step 6: Optionally filter by community name
    if community:
        features = [
            f for f in features
            if community.lower() in str(f.get('properties', {})).lower()
        ]

    # Step 7: Return the filtered data
    return JsonResponse({
        "date": date,
        "community_filter": community,
        "feature_count": len(features),
        "features": features[:500]  # Limit to 500 features for performance
    })
```

**`dashboard/urls.py`:**
```python
path("api/sensor-readings/", views.sensor_readings_api, name="sensor_readings_api"),
```

**Testing in browser:** Visit `http://127.0.0.1:8000/api/sensor-readings/?date=2025-09-01` to see the full response, or `http://127.0.0.1:8000/api/sensor-readings/?date=2025-09-01&community=Loop` to filter by community.


---

## Adding a New Page

Adding a new page to the dashboard follows a consistent four-step pattern.

### Step 1 — Create the template

Create a new HTML file in `dashboard/templates/dashboard/pages/`. Name the file to match the purpose of the page (e.g., `my_page.html`).

Copy-paste the following code into your new template file:

```html
{# dashboard/templates/dashboard/pages/my_page.html #}
{% extends "dashboard/layout.html" %}
{% load static %}

{% block title %}My New Page{% endblock %}

{# This endblock is where you put page-unique CSS/styling #}
{% block extra_css %}
<style>
  /* Page-specific styles go here */
</style>
{% endblock %}

{# This endblock is where you put the main page content (HTML body) #}
{% block content %}
<h1>My New Page</h1>
<p>This is a new dashboard page.</p>
{% endblock %}

{# This endblock is where you put page-unique JavaScript #}
{% block extra_js %}
<script>
  // Page-specific JavaScript goes here
</script>
{% endblock %}
```

**Explanation of the template blocks:**
- `{% extends "dashboard/layout.html" %}` — inherits the shared layout (navbar, footer, base CSS (static/site.css)) used by all pages.
- `{% block title %}` — sets the browser tab title for this page.
- `{% block extra_css %}` — page-unique CSS/styling goes between this block and its `{% endblock %}`. These styles only apply to this page.
- `{% block content %}` — the main HTML body of your page goes here. This is where you add headings, paragraphs, charts, tables, etc.
- `{% block extra_js %}` — page-unique JavaScript goes between this block and its `{% endblock %}`. Use this for interactive behavior specific to this page.

### Step 2 — Add the view function

Open `dashboard/views.py` and add a new view function. The view function is the Python handler that Django calls when someone requests the page URL. It renders your HTML template and optionally passes data (context variables) from the backend to the template.

Copy-paste the following code into `dashboard/views.py`, adjusting the template path and context as needed:

```python
def my_page(request):
    """Render the My New Page view."""
    return render(request, 'dashboard/pages/my_page.html', {
        # Add context variables here if your template needs data from the backend
        # For example: "some_data": some_query_result
    })
```

**Explanation:**
- `request` — the HTTP request object passed automatically by Django.
- `'dashboard/pages/my_page.html'` — the path to your template file relative to the `templates/` directory. Make sure this matches the filename you created in Step 1.
- The dictionary `{}` allows you to pass variables from Python to the template. For a static page with no backend data, leave it empty.

### Step 3 — Register the URL

Open `dashboard/urls.py` and add a new `path()` entry to the `urlpatterns` list. This step tells Django which URL triggers your new view function.

Copy-paste the following line into the `urlpatterns` list in `dashboard/urls.py`:

```python
path("my-page/", views.my_page, name="my_page"),
```

**Explanation:**
- `"my-page/"` — the URL path users will visit (e.g., `http://127.0.0.1:8000/my-page/`).
- `views.my_page` — the view function defined in Step 2 that handles the request.
- `name="my_page"` — a unique identifier for this URL, used to reference it in templates (e.g., `{% url 'my_page' %}`) and other Python code.

After adding the route, test it by navigating to `http://127.0.0.1:8000/my-page/` in your browser. You should see your new page rendered.

### Step 4 — Add nav link

So users can discover your new page, add a link to the top navigation bar. Open `dashboard/templates/dashboard/includes/navbar.html` and add a new `<a>` tag among the existing nav links:

```html
<a href="{% url 'my_page' %}" class="nav-link">My Page</a>
```

**Explanation:**
- `{% url 'my_page' %}` — uses the `name` you defined in Step 3 to generate the correct URL. This is preferred over hard-coding `/my-page/` because if the URL ever changes, the link updates automatically.
- `class="nav-link"` — applies the shared navbar styling used by all navigation links.
- `My Page` — the display text users will see and click in the navigation bar.

After saving all files, refresh your browser and you should see the new link in the navbar. Clicking it should navigate to your new page.

---

## Configuration & Environment Variables

### Local development settings

For local development, no `.env` file is needed. Key settings in `config/settings.py`:

| Setting | Current Value | Purpose |
|---|---|---|
| `DEBUG` | `True` | Enable detailed error pages |
| `SECRET_KEY` | Insecure default | Change for production |
| `ALLOWED_HOSTS` | `['*']` | Restrict for production |
| `TIME_ZONE` | `'America/Chicago'` | All timestamps in Chicago time |
| `STATIC_URL` | `'static/'` | URL prefix for static files |
| `STATIC_ROOT` | `BASE_DIR / 'staticfiles'` | Collected static files directory |

### Production environment variables

For production on Render or Heroku, set these in your hosting platform's dashboard:

| Variable | Value | Notes |
|---|---|---|
| `SECRET_KEY` | A long random string | Generate at https://djecrety.ir/ |
| `DEBUG` | `False` | Never run `True` in production |
| `ALLOWED_HOSTS` | `your-app.onrender.com` | Your actual domain |
| `DATABASE_URL` | Set automatically | PostgreSQL connection string |

### Generating a secure secret key

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Common Errors and Fixes

### `(venv)` is not showing in my prompt

Your virtual environment is not active. Run the activate command for your OS (see [Step 2 — Create a virtual environment](#step-2--create-a-virtual-environment)). You need to do this every time you open a new terminal window.

### `ModuleNotFoundError: No module named '...'`

This error can occur for **any Python library** (django, pandas, numpy, pyarrow, etc.) when the required package is not installed in the active virtual environment. The error message will indicate which module is missing (e.g., `No module named 'pandas'`, `No module named 'numpy'`).

**Solution:**
1. Make sure your virtual environment is active — your prompt should show `(venv)` at the start.
   - **Windows (PowerShell):** Run `venv\Scripts\activate`
   - **Mac/Linux:** Run `source venv/bin/activate`
2. Re-install all project dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. If the error persists for a specific library or that library is not listed in `requirements.txt`, install it manually:
   ```bash
   pip install <package_name>
   or 
   python -m pip install <package_name>
   ```
   Then ask a team lead to add it to `requirements.txt` so other developers get it as well.

### Port 8000 already in use

Another process is using port 8000. Either stop it or use a different port:
```bash
python manage.py runserver 8001
```

### `TemplateDoesNotExist: dashboard/my_page.html`

The template file is missing or `settings.py` doesn't point to the correct directory. Confirm the file exists:
```bash
ls dashboard/templates/dashboard/pages/my_page.html
```
And confirm `config/settings.py` has this in the `TEMPLATES` setting:
```python
'DIRS': [BASE_DIR / 'dashboard' / 'templates'],
```

### `django.db.utils.OperationalError: no such table`

You haven't run migrations yet, or new migrations were added. Run:
```bash
python manage.py migrate
```

### Data file not found (404 errors)

If you see 404 errors when accessing `/data/clarity/<filename>` or similar URLs:
1. Verify the file exists in the correct directory: `ls dashboard/data/clarity/`
2. Check the filename matches exactly (case-sensitive)
3. Ensure the file is a valid GeoJSON or JSON file

### Dashboard webpage not updating after saved changes

If you save changes to the dashboard (especially updated images, CSS, or JavaScript) but the browser still shows the old version, your browser is likely serving cached files instead of the updated ones.

**Solution: Clear your browser cache.**

- **Chrome/Edge:** Press `Ctrl + Shift + Delete` → select "Cached images and files" → click "Clear data". Alternatively, use `Ctrl + F5` or `Ctrl + Shift + R` for a hard refresh on the current page.
- **Firefox:** Press `Ctrl + Shift + Delete` → select "Cache" → click "Clear Now". Alternatively, use `Ctrl + F5` for a hard refresh.
- **Safari:** Press `Cmd + Shift + R` for a hard refresh, or go to Preferences → Advanced → check "Show Develop menu" → Develop → Empty Caches.

**Tip:** During active development, you can also disable cache entirely in your browser's DevTools:
1. Open DevTools (`F12` in Chrome/Edge, `F12` in Firefox)
2. Go to the **Network** tab
3. Check the **"Disable cache"** option
4. Keep DevTools open while working — cache will be disabled as long as the DevTools window remains open

---

## Deploying to Production

### Procfile and Gunicorn

The `Procfile` at the project root defines how the app runs in production:

```
web: gunicorn config.wsgi
```

This tells Heroku/Render to use Gunicorn as the WSGI server, pointing to `config/wsgi.py` as the application entry point.

### runtime.txt

The `runtime.txt` file specifies the Python version for the hosting platform:

```
python-3.12.x
```

Ensure this matches your local Python version to avoid compatibility issues.

### Collecting static files

Before deploying, collect all static files (CSS, JS, images) into `STATIC_ROOT`:

```bash
python manage.py collectstatic --no-input
```

This is typically run as part of the build command on Render/Heroku.

### Deploying to Render

1. Push your code to GitHub.
2. Go to https://render.com and sign in.
3. Click **New → Web Service**.
4. Connect your GitHub account and select the repository.
5. Configure the service:
   - **Environment:** Python
   - **Build Command:** `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --no-input`
   - **Start Command:** `gunicorn config.wsgi`
6. Add Environment Variables (see [Configuration & Environment Variables](#configuration--environment-variables) above).
7. Click **Create Web Service**.

Render will build and deploy automatically. Every push to `main` triggers a new deploy.

Your app will be live at: `https://your-app-name.onrender.com`

---

## Making Changes with a Git Workflow

Git is the version control system used by this project to **track every change made to the codebase**. It serves two critical purposes:

1. **Change history:** Every commit records *what* changed, *who* changed it, *when* it was changed, and *why* (via the commit message). This makes it easy to review past changes, debug regressions, or revert accidental breakage.
2. **Collaboration across multiple developers:** When multiple developers are editing the same project on different machines, Git (combined with GitHub as the remote host) ensures everyone stays in sync. Changes made by one developer are pushed to the shared GitHub repository, where other developers can pull them down to their local machines. Without this push/pull workflow, each developer would only ever see their own local changes and would quickly fall out of sync.

### How pushing to GitHub shares your changes with other developers

When you run `git push`, your local commits are uploaded to the remote repository on GitHub. This is the critical step that makes your work visible to the rest of the team:

- **Before `git push`:** Your changes only exist on your local machine. No one else can see them.
- **After `git push`:** Your commits are now stored on GitHub. Other developers can run `git pull` on their machines to download your changes and incorporate them into their local copies of the project.

Think of GitHub as the central "source of truth" that all developers share. Your local machine is your personal workspace. `git push` uploads your work to the central hub, and `git pull` downloads work from the central hub to your machine. Both directions are necessary for the team to stay synchronized.

### First-time setup on a new machine
```bash
git clone https://github.com/NASA-EarthRISE-DevelopersAcademy/develop-AQ_LaRC_2026.git
cd develop-AQ_LaRC_2026
# Then follow Local Setup steps above
```

`git clone` downloads the entire project from GitHub — including all files, commit history, and branches — to your local machine. After cloning, your local copy is synchronized with the remote repository.

### Daily workflow
```bash
git pull                          # Download and merge latest changes from GitHub
# Make your edits
git add .                         # Stage all changed files for the next commit
git commit -m "describe what you changed"  # Save a snapshot of your staged changes
git push                          # Upload your commits to GitHub so other developers can pull them
```

**Explanation of each step:**
- **`git pull`** — Always start by pulling the latest changes from GitHub. This ensures you are building on top of what your teammates have already pushed, reducing the chance of merge conflicts.
- **`git add .`** — Stages all your modified, new, or deleted files. Think of this as selecting which files should be included in your next commit.
- **`git commit -m "..."`** — Saves a named snapshot of your staged changes. Write clear, descriptive commit messages (e.g., "add community ranking chart to stats page" instead of "update stuff").
- **`git push`** — Uploads your commits to the remote GitHub repository. **This is the step that makes your changes available to other developers.** Until you push, your work stays local.

### Creating a feature branch (recommended for larger changes)

Feature branches isolate your work from the main codebase, allowing you to develop and test changes without affecting the shared `main` branch until you are ready.

```bash
git checkout -b feature/my-feature-name   # Create and switch to a new branch
# Make changes
git add .
git commit -m "add my feature"
git push -u origin feature/my-feature-name  # Push the branch to GitHub
# Then open a Pull Request on GitHub
```

**Why use feature branches?**
- Your experimental changes stay isolated until they are reviewed and merged.
- Other developers can continue working on `main` without being blocked by incomplete work.
- Pull Requests on GitHub enable code review, discussion, and automated testing before changes are merged.

---

## Extending the Project

The project is structured so that each new feature lives in `dashboard/` and is wired into the existing URL and template system. Here are ideas for extending the dashboard:

**Add real-time data ingestion**
Create a Django management command in `dashboard/management/commands/` that fetches the latest TEMPO or OpenAQ data on a schedule and saves it to the `dashboard/data/` directories.

**Add a charts/analysis page**
Use Plotly.js (already loaded on the community page) to create a standalone `/analysis/` page with customizable time-series charts, correlation plots, and downloadable figures.

**Add user authentication**
Django ships with a full auth system. Enable login/logout views and protect admin-only features with `@login_required` or `@staff_member_required`.

**Add a data quality dashboard**
Create a page that shows sensor health metrics, data gaps, and quality flags from the Open Air Chicago sensor network.

**Swap SQLite for PostgreSQL locally**
Install PostgreSQL, create a database, and update `DATABASES` in `settings.py`. Use `dj-database-url` to parse the connection string.

**Add a full REST API**
Install `djangorestframework` for a complete REST API with serializers, authentication, and browsable API pages.

---

## Support & Resources

### Contact

For any questions about the framework, codebase, data pipeline, or dashboard functionality, please reach out to:

**Team Contact:** Caitlyn McClanahan
**Email:** mcclan.caitlyn@gmail.com
**Project Coordinator:** Kristina Glass
**Email:** kristina.glass@ama-inc.com

### Technical Paper

For a detailed scientific analysis of the data processing methods, statistical approaches, and fusion techniques used in this dashboard, see the accompanying technical paper:

**[Insert Technical Paper Title/Link]**

### Dashboard Tutorial

For a step-by-step guide on how to navigate and use the dashboard web application, visit the **User Guide** built into the dashboard:

**Tutorial URL:** `/tutorial/` in the app (or navigate to **User Guide** from the navbar)
