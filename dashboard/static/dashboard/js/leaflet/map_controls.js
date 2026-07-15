// ── HOME BUTTON (reset view to Chicago) ──────────────────────────────────
const homeCoords = [41.83772083187901, -87.68664593458594];
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


function showLoading(message = "Loading...") {
      if (!loadingControl) {
          loadingControl = L.control({ position: "topright" });
          loadingControl.onAdd = function() {
              let div = L.DomUtil.create("div");
              div.id = "loadingIndicator";
              div.style.background = "white";
              div.style.padding = "8px";
              div.style.borderRadius = "6px";
              div.style.fontWeight = "bold";
              div.style.boxShadow = "0 0 4px rgba(0,0,0,0.3)";
              div.innerHTML = message;
              return div;
          };
          loadingControl.addTo(map);
      } else {
          document.getElementById("loadingIndicator").innerHTML = message;
      }
  }

function hideLoading() {
    if (loadingControl) {
        map.removeControl(loadingControl);
        loadingControl = null;
    }
}

function refreshMap() {
    if (dates.length === 0) {
        return;
    }
    let date = dates[Number(document.getElementById("dateSlider").value)];
    loadDate(date);
}

// -- SELECT MAP TYPE ------
let currentMapType = TIME_SCALE;

function selectMapType(type) {
  currentMapType = type;

  // Update active state on buttons
  document.querySelectorAll('.map-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Update active state on parent link elements
  document.querySelectorAll('.map-type-link').forEach(link => {
    link.classList.toggle('active', link.dataset.type === type);
  });

  // Show/hide date controls based on map type
  const singleDateGroup = document.getElementById('single-date-group');
  const dateRangeGroup = document.getElementById('date-range-group');
  const monthRangeGroup = document.getElementById('month-range-group');
  const dateSectionLabel = document.getElementById('date-section-label');

  if (type === 'hourly') {
    if (singleDateGroup) singleDateGroup.style.display = 'block';
    if (dateRangeGroup) dateRangeGroup.style.display = 'none';
    if (monthRangeGroup) monthRangeGroup.style.display = 'none';
    if (dateSectionLabel) dateSectionLabel.textContent = 'Date';
  } else if (type === 'daily') {
    if (singleDateGroup) singleDateGroup.style.display = 'none';
    if (dateRangeGroup) dateRangeGroup.style.display = 'block';
    if (monthRangeGroup) monthRangeGroup.style.display = 'none';
    if (dateSectionLabel) dateSectionLabel.textContent = 'Date Range';
  } else if (type === 'monthly') {
    if (singleDateGroup) singleDateGroup.style.display = 'none';
    if (dateRangeGroup) dateRangeGroup.style.display = 'none';
    if (monthRangeGroup) monthRangeGroup.style.display = 'block';
    if (dateSectionLabel) dateSectionLabel.textContent = 'Month Range';
  }
}

// Initialize the correct date control visibility on page load
selectMapType(TIME_SCALE);
// Also initialize hour-controls / range-controls visibility to match the current view
changeAggregation(TIME_SCALE);

// Handle click on map type buttons: update UI, then navigate to the matching view
function handleMapTypeClick(event, type) {
  // Update the local UI (active button highlight, date-control visibility, etc.)
  selectMapType(type);

  // Also update the V4 slider control radio buttons and trigger aggregation change
  changeAggregation(type);

  // Navigate to the corresponding map view (/hourly/, /daily/, /monthly/)
  const btn = event && event.currentTarget;
  if (btn && btn.dataset.url) {
    window.location.href = btn.dataset.url;
  }
}
window.handleMapTypeClick = handleMapTypeClick;

// ── CHANGE AGGREGATION (unified function for sidebar + in-map controls) ──
function changeAggregation(type) {
  TIME_SCALE = type;

  // Update the V4 slider radio buttons to match
  document.querySelectorAll('input[name="TIME_SCALE"]').forEach(radio => {
    radio.checked = radio.value === type;
  });

  // Reset date slider
  var dateSlider = document.getElementById("dateSlider");
  if (dateSlider) {
    if (TIME_SCALE === "range") {
        rangeDates = dates.filter(d =>
            d >= rangeStartDate && d <= rangeEndDate
        );
        dateSlider.min = 0;
        dateSlider.max = Math.max(0, rangeDates.length - 1);
        dateSlider.value = 0;
    } else {
        dateSlider.min = 0;
        dateSlider.max = dates.length - 1;
        dateSlider.value = 0;
    }
  }

  console.log("Aggregation:", TIME_SCALE);

  let hourControls = document.getElementById("hourControls");
  let rangeControls = document.getElementById("rangeControls");

  if (hourControls) {
    hourControls.style.display = TIME_SCALE === "hourly" ? "block" : "none";
  }
  if (rangeControls) {
    rangeControls.style.display = TIME_SCALE === "range" ? "block" : "none";
  }

  let currentDate = dates.length > 0 ? dates[0] : null;
  var dateLabel = document.getElementById("dateLabel");

  if (currentDate) {
    if (TIME_SCALE === "monthly") {
        if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(currentDate);
    } else {
        if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(currentDate);
    }
  }

  // Clear layers
  if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
  }
  if (communityLayer) {
      map.removeLayer(communityLayer);
      communityLayer = null;
  }

  refreshMap();
}

// ── COORDS BAR ─────────────────────────────────────────────────────────────
map.on('mousemove', e => {
  document.getElementById('coords-text').textContent =
    `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
});
map.on('zoomend', () => {
  document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;
});
document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;

// ── coords PANEL ───────────────────────────────────────────────────────────────
const coordsPanel = document.getElementById('coords-panel');
if (coordsPanel) {
  map.on('mousemove', e => {
    coordsPanel.innerHTML =
      `<strong>Lat:</strong> ${e.latlng.lat.toFixed(6)}<br>
        <strong>Lng:</strong> ${e.latlng.lng.toFixed(6)}<br>
        <strong>Zoom:</strong> ${map.getZoom()}`;
  });
}

// ── EXPLORE PANEL TOGGLE ────────────────────────────────────────────────────
const explorePanel = document.getElementById('explore-panel');
const explorePanelToggle = document.getElementById('explore-panel-toggle');
const explorePanelBody = document.getElementById('explore-panel-body');
if (explorePanelToggle && explorePanel) {
  explorePanel.classList.add('retracted'); // start retracted

  // Also prevent the toggle button & body from propagating to map
  if (explorePanelToggle) {
    L.DomEvent.disableClickPropagation(explorePanelToggle);
    L.DomEvent.disableScrollPropagation(explorePanelToggle);
  }
  if (explorePanelBody) {
    L.DomEvent.disableClickPropagation(explorePanelBody);
    L.DomEvent.disableScrollPropagation(explorePanelBody);
  }

  explorePanelToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    explorePanel.classList.toggle('retracted');
    explorePanel.classList.toggle('expanded');
  });
}

// ── DATA PRODUCT RADIO BUTTONS (sidebar: tempo / openaq / fusion) ──────────
document.querySelectorAll('input[name="dataProduct"]').forEach(radio => {
  radio.addEventListener('change', e => {
    const selected = e.target.value;

    // Remove all data layers first
    map.removeLayer(tempoLayerGroup);
    map.removeLayer(openaqLayerGroup);
    map.removeLayer(fusionLayerGroup);

    // Add only the selected layer
    const layerMap = {
      tempo: tempoLayerGroup,
      openaq: openaqLayerGroup,
      fusion: fusionLayerGroup
    };

    if (layerMap[selected]) {
        layerMap[selected].addTo(map);
        showToast(`${selected} data product selected`);
    }
  });
});

// ── LAYER TOGGLES (legacy: for any remaining .layer-toggle checkboxes) ─────
document.querySelectorAll('.layer-toggle').forEach(checkbox => {
  checkbox.addEventListener('change', e => {
    const layer = e.target.dataset.layer;
    const isChecked = e.target.checked;

    const layerMap = {
      tempo: tempoLayerGroup,
      openaq: openaqLayerGroup,
      fusion: fusionLayerGroup,
      wind: windLayerGroup
    };

    if (layerMap[layer]) {
        if (isChecked) {
            layerMap[layer].addTo(map);
        } else {
            map.removeLayer(layerMap[layer]);
        }
        showToast(`${layer} layer ${isChecked ? 'enabled' : 'disabled'}`);
    }
  });
});

// ── TIME SLIDER (original sidebar slider) ────────────────────────────────────
const origTimeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');
let playInterval = null;

if (origTimeSlider) {
    origTimeSlider.addEventListener('input', () => {
        const hour = parseInt(origTimeSlider.value);
        timeDisplay.textContent = `${String(hour).padStart(2, '0')}:00 UTC`;
        // Reload data for the selected hour
        const today = new Date().toISOString().split('T')[0];
        loadTempoData(today, hour);
    });

    document.getElementById('time-prev')?.addEventListener('click', () => {
        origTimeSlider.value = Math.max(0, parseInt(origTimeSlider.value) - 1);
        origTimeSlider.dispatchEvent(new Event('input'));
    });

    document.getElementById('time-next')?.addEventListener('click', () => {
        origTimeSlider.value = Math.min(23, parseInt(origTimeSlider.value) + 1);
        origTimeSlider.dispatchEvent(new Event('input'));
    });

    document.getElementById('time-play')?.addEventListener('click', function() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            this.textContent = '▶';
        } else {
            this.textContent = '⏸';
            playInterval = setInterval(() => {
                let val = parseInt(origTimeSlider.value) + 1;
                if (val > 23) val = 0;
                origTimeSlider.value = val;
                origTimeSlider.dispatchEvent(new Event('input'));
            }, 1500);
        }
    });
}

// ── REGION DROPDOWN: fly to selected region ─────────────────────────────
const regionDropdown = document.getElementById('region-dropdown');
if (regionDropdown) {
  regionDropdown.addEventListener('change', function() {
    if (this.value === 'cook_county') {
      map.flyTo(homeCoords, homeZoom, { duration: 1.5 });
    }
  });
}
