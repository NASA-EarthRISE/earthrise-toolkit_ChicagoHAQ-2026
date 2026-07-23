# Regional Ozone Precoursor Dashboard

A real-time visualization tool for TEMPO satellite and Open Air Clarity ground sensor NO₂ data, developed by the
EarthRISE Developers Academy in collaboration with NASA LaRC and community partners.

---

## Table of Contents

1. [This Project](#this-project)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Local Setup — Step by Step](#local-setup--step-by-step)
5. [Project Structure](#project-structure)
6. [Running the App](#running-the-app)
7. [Available Routes](#available-routes)
9. [Database](#database)

---
![Alt Text](images/regionalozone_dashboard.png)
---

## This Project

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 6.0 |
| Language | Python 3.14 |
| Frontend | Django Templates + Leaflet.js |
| Map library | Leaflet 1.9.4 (CDN, no build step required) |
| File library | Pandas, Pyarrow |
| Database (local) | ? |
| Database (production) | ? |
| Static files | WhiteNoise |
| Production server | Gunicorn |
| Hosting | ? |

---

## Prerequisites — Cold Start Checklist

Complete every item here before touching any project code. This is a true cold-start list for a machine that has nothing installed.

### 1. Python 3.12

This project requires **Python 3.12 exactly** (specified in `runtime.txt`).

Check if you have it:
```bash
python --version
# or
python3 --version
```

If you don't have Python 3.12, download it from https://www.python.org/downloads/release/python-3123/ and install it. Make sure to check **"Add Python to PATH"** during the Windows installer.

After installing, confirm it works:
```bash
python3.12 --version
# Expected: Python 3.12.x
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

Follow these steps in order. Do not skip steps.

### Step 1 — Clone the repository

```bash
git clone https://github.com/MayerT1/tempo_dashboard.git
cd tempo_dashboard
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

This installs Django, Gunicorn, WhiteNoise, psycopg2, and all other packages the project needs. It may take 30–60 seconds.

Verify the install worked:
```bash
python -m django --version
# Expected: 6.0.x
```
---

## Project Structure

```
DEVELOP-AQ_LARC_2026/
│
├── config/                     # Django project configuration
│   ├── settings.py             # All settings: database, apps, static files
│   ├── urls.py                 # Root URL router — links to dashboard/urls.py
│   ├── wsgi.py                 # WSGI entry point (used by Gunicorn in production)
│   └── asgi.py                 # ASGI entry point (for future async support)
│
├── dashboard/                  # Main Django app — all feature code lives here
│   ├── migrations/             # Auto-generated database migration files
│   │       └── _pycache_/      # Pycache storage
│   ├── data/                   # Study period data products stored here
│   │   └── clarity/            # Open Air hourly, daily, monthly GeoJSONs, Open Air dates.json
│   │   └── fused/              # Fused hourly, daily, monthly GeoJSONs, Fused dates.json
│   │   └── tempo/              # TEMPO hourly, daily, monthly GeoJSONs, TEMPO dates.json
│   │   └── community_statistics/   # Community statistics percentile metric datasets
│   ├── templates/
│   │   └── dashboard/
│   │       └── includes/       # Static html features
│   │       └── pages/          # Web pages
│   │           └── about.html    # About the project page
│   │           └── community.html    # Community statisitcs page (Drop-down and plotly graphs)
│   │           └── export.html # Export datafiles page
│   │           └── home.html   # Home page with server stats
│   │           └── info.html   # Information page on the study area and data products
│   │           └── map.html    # The full Pollution Map page (Leaflet and sidebar)
│   │           └── userguide.html    # Dashboard tutorial page
│   ├── static/
│   │   └── dashboard/          
│   │       └── css/            # App-specific CSS
│   │       └── images/         # App-specific Images
│   │       └── js/             # App-specific JS
│   │       └── layers/         # App-specific GeoJSON Boundary Files for Chicago Region
│   ├── views.py                # Request handlers: home(), map_view(), community(), etc.
│   ├── urls.py                 # URL patterns for this app: /, /map/, /api/community-rankings
│   ├── models.py               # Database models for tracking server status
│   ├── admin.py                # Registers models with Django admin
│   ├── forms.py                # Logs messages to display on frontend
│   └── apps.py                 # App configuration
│
├── processing-scripts/         # Data processing scripts for product regression/aggregation
├── manage.py                   # Django CLI entry point — used for all dev commands
├── requirements.txt            # Python package dependencies (pinned versions)
├── Procfile                    # Render/Heroku process definition: web: gunicorn config.wsgi
├── runtime.txt                 # Specifies Python version for Render: python-3.12.3
└── db.sqlite3                  # Local SQLite database (auto-created, do not commit to prod)
```
---

## Running the App

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
| GET | `/` | Home page |
| GET | `/about/` | About the Project page |
| GET | `/info/` | Information page |
| GET | `/tutorial/` | User guide page |
| GET | `/community/` | Commmunity statistcial analysis page |
| GET | `/export/` | Export data files page |
| GET | `/map/` | Interactive map page |
| GET | `/map/hourly` | Hourly observation window map page |
| GET | `/map/daily` | Daily observation window map page |
| GET | `/map/monthly` | Monthly observation window map page |
| GET | `/api/data-status/` | Returns status of data intake |
| GET | `/api/community-rankings/` | Returns community_rankings_ground_vs_tempo.csv |
| GET | `/api/community-no2-data/` | Returns community_no2_master.parquet |
| GET | `/admin/` | Django admin panel (requires superuser) |

---

## Database