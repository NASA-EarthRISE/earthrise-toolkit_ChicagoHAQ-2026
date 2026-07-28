// ──────────────────────────────────────────────────────────────────────────────
// map_init.js — Map configuration, global state, and initialisation
// Load order: time_utils.js → map_init.js → map_layers.js → data_loader.js → map_controls.js
// ──────────────────────────────────────────────────────────────────────────────

// ── CONFIGURATION ────────────────────────────────────────────────────────────
// NOTE: TIME_SCALE must be set by the map.html BEFORE this script loads.
// The map.html template includes a small inline script: let TIME_SCALE = '{{ time_scale|default:"hourly" }}';
// If not set, default to "hourly".
if (typeof window.TIME_SCALE === 'undefined') {
    window.TIME_SCALE = 'hourly';
}

// Alias to global for convenience throughout the codebase.
var TIME_SCALE = window.TIME_SCALE;

// ── TIMEUTILS WRAPPER FUNCTIONS (for backward compatibility) ──────────────────
// These wrappers were previously inline in map.html and are called by all modules.
function formatCentralTime(utcString) {
    return TimeUtils.formatCentralTime(utcString);
}

function getChicagoParts(date) {
    return TimeUtils.getChicagoParts(date);
}

function formatHourForDisplay(dateStr, selectedHour) {
    return TimeUtils.formatHourForDisplay(dateStr, selectedHour);
}

function formatMonthForDisplay(dateStr) {
    return TimeUtils.formatMonthForDisplay(dateStr);
}

function utcDateToCentralPretty(dateStr) {
    return TimeUtils.formatDateForDisplay(dateStr);
}

function toMonthKey(value) {
    return TimeUtils.toMonthKey(value);
}

function toDailyKey(value) {
    return TimeUtils.toDailyKey(value);
}

// ── BASEMAP LAYERS ───────────────────────────────────────────────────────────
const tileLayers = {
    osm: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    }),
};

// ── MAP INIT ─────────────────────────────────────────────────────────────────
var map = L.map('map', {
    center: [41.8, -87.629],  // Chicago, IL default
    zoom: 10,
    layers: [tileLayers.osm],
    zoomControl: true,
    preferCanvas: true
});

// ── HOME BUTTON (reset view to Chicago) ──────────────────────────────────────
const homeCoords = [41.8, -87.629];
const homeZoom = 10;

var HomeButton = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        var btn = L.DomUtil.create('a', 'leaflet-bar leaflet-control leaflet-control-home');
        btn.style.backgroundColor = '#fff';
        btn.style.width = '26px';
        btn.style.height = '26px';
        btn.style.lineHeight = '26px';
        btn.style.textAlign = 'center';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
        btn.style.borderRadius = '4px';
        btn.title = 'Reset to home view (Chicago)';

        // inline SVG house icon – no external dependencies
        btn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
            'width="16" height="16" style="vertical-align:middle;display:block;margin:5px auto 0" ' +
            'fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M3 12L5 10M19 10L21 12M12 2L4 10V20H9V15H15V20H20V10L12 2Z"/>' +
            '</svg>';

        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.disableScrollPropagation(btn);

        L.DomEvent.on(btn, 'click', L.DomEvent.preventDefault);
        L.DomEvent.on(btn, 'click', function () {
            map.flyTo(homeCoords, homeZoom, { duration: 1.5 });
        });

        return btn;
    }
});

map.addControl(new HomeButton());

// ── GLOBAL VARIABLES ─────────────────────────────────────────────────────────
var currentLayer = null;

// Clarity (Open Air) color scale – linear, ppb
const CLARITY_GLOBAL_MAX = 50;
const CLARITY_GLOBAL_MIN = 0;

// TEMPO color scale – sqrt-based, molecules/cm²
const TEMPO_GLOBAL_MAX = 5e16;
const TEMPO_GLOBAL_MIN = 1e9;

// Fusion color scale – same linear ppb scale as Clarity
const FUSION_GLOBAL_MAX = 50;
const FUSION_GLOBAL_MIN = 0;

let selectedHour = 0;
let communityData = null;
let ChicagoCommunityAreas = null;
let displayMode = "sensor";

// Normalize data product name to internal key
function normalizeDataProduct(value) {
    if (
        value === "openaq" ||
        value === "clarity" ||
        value === "openair" ||
        value === "open_air"
    ) {
        return "clarity";
    }

    if (value === "tempo") {
        return "tempo";
    }

    if (value === "fusion") {
        return "fusion";
    }

    return "clarity";
}

const urlProduct =
    new URLSearchParams(window.location.search).get("product");

let currentDataProduct = normalizeDataProduct(
    urlProduct || localStorage.getItem("selectedDataProduct") || "openaq"
);

let appInitialized = false;

// Prevent stale async fetches from rendering old products
let activeLoadToken = 0;

function startNewLoad(product) {
    activeLoadToken += 1;
    return {
        id: activeLoadToken,
        product: product
    };
}

function isMonthlyDate(value) {
    return TimeUtils.isMonthlyDate(value);
}

function isActiveLoad(load) {
    return (
        load &&
        load.id === activeLoadToken &&
        load.product === currentDataProduct
    );
}

function canRenderTempo(label) {
    if (currentDataProduct !== "tempo") {
        console.log(`Blocked TEMPO render from ${label}; current product is ${currentDataProduct}`);
        return false;
    }

    return true;
}

// ── DATE/STATE VARIABLES ─────────────────────────────────────────────────────
let rangeStartDate = null;
let rangeEndDate = null;
let rangeCurrentEndDate = null;

let dates = [];
let allDates = [];       // unfiltered copy — kept in sync by each date loader
let rangeDates = [];
let pendingPreferredDate = null;
let pendingPreferredHour = null;
let invalidClarityHourlyDates = new Set();

let tempoHourlyDates = [];
let tempoDailyDates = [];
let communityHourLookup = null;

let cachedDate = null;
let cachedFeatures = null;
let cachedHourBuckets = null;

let nextCachedDate = null;
let nextCachedHourBuckets = null;

let timeInterval = null;
let isPlaying = false;
const tempoDailyCache = {};
const tempoMonthlyCache = {};
let communityIndexCache = {};

// ── LAYER GROUPS ─────────────────────────────────────────────────────────────
const tempoLayerGroup = L.layerGroup().addTo(map);
const openaqLayerGroup = L.layerGroup();
const fusionLayerGroup = L.layerGroup();
let heatLayer = null;
let communityLayer = null;
let savedMarkers = [];
let markerIdSeq = 0;

// ── CLEAR DATA LAYERS ────────────────────────────────────────────────────────
function clearDataLayers() {
    hideNoDataNotice();
    hideLoading();

    if (currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = null;
    }

    if (communityLayer) {
        map.removeLayer(communityLayer);
        communityLayer = null;
    }

    tempoLayerGroup.clearLayers();
    openaqLayerGroup.clearLayers();
    fusionLayerGroup.clearLayers();

    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
}

// ── UPDATE BOTTOM CONTROL VISIBILITY ─────────────────────────────────────────
function updateBottomControlVisibility() {
    const hourControls = document.getElementById("hourControls");
    const timeLabel = document.getElementById("timeLabel");

    if (hourControls) {
        hourControls.style.display = TIME_SCALE === "hourly" ? "block" : "none";
    }

    if (timeLabel && TIME_SCALE !== "hourly") {
        timeLabel.innerHTML = "";
    }
}