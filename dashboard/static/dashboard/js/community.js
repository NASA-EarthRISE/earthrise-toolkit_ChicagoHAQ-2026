// Make 'communnity-left' sticky
function initManualStickyCommunityPanel() {
  const panel = document.querySelector(".community-left");
  const layout = document.querySelector(".community-layout");

  if (!panel || !layout) {
    return;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "community-left-placeholder";
  panel.parentNode.insertBefore(placeholder, panel);

  function getHeaderBottom() {
    const header =
      document.querySelector("header") ||
      document.querySelector(".navbar") ||
      document.querySelector(".site-header") ||
      document.querySelector(".topbar") ||
      document.querySelector(".app-header");

    if (!header) {
      return 0;
    }

    return Math.ceil(header.getBoundingClientRect().bottom);
  }

  function resetPanel() {
    panel.classList.remove("is-fixed", "is-anchored");

    panel.style.top = "";
    panel.style.left = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxHeight = "";

    placeholder.style.display = "none";
    placeholder.style.width = "";
    placeholder.style.height = "";
    placeholder.style.flex = "";
  }

  function updatePanel() {
  if (window.innerWidth <= 900) {
    resetPanel();
    return;
  }

  const gap = 16;
  const searchBarOffset = 0; // dropdown height + gap between dropdown and Go button
  const headerBottom = getHeaderBottom();

  const layoutRect = layout.getBoundingClientRect();
  const layoutTopDoc = layoutRect.top + window.scrollY;
  const layoutBottomDoc = layoutTopDoc + layout.offsetHeight;

  // If placeholder is visible, it is the source of truth for the original column slot.
  // If not, use the panel's natural position.
  const slotRect =
    placeholder.style.display === "block"
      ? placeholder.getBoundingClientRect()
      : panel.getBoundingClientRect();

  const slotWidth = Math.round(slotRect.width);
  const slotLeft = Math.round(slotRect.left);

  const panelHeight = panel.offsetHeight;
  const fixedTopViewport = headerBottom + gap + searchBarOffset;
  const fixedTopDoc = window.scrollY + fixedTopViewport;
  const naturalPanelTopDoc = layoutTopDoc;
  const stopTopDoc = layoutBottomDoc - panelHeight;

  if (fixedTopDoc < naturalPanelTopDoc) {
    resetPanel();
    return;
  }

  // Lock the placeholder to the exact column width.
  placeholder.style.display = "block";
  placeholder.style.width = `${slotWidth}px`;
  placeholder.style.height = `${panelHeight}px`;
  placeholder.style.flex = `0 0 ${slotWidth}px`;

  if (fixedTopDoc >= stopTopDoc) {
    panel.classList.remove("is-fixed");
    panel.classList.add("is-anchored");

    panel.style.top = `${layout.offsetHeight - panelHeight}px`;
    panel.style.left = `${slotLeft - Math.round(layoutRect.left)}px`;
    panel.style.width = `${slotWidth}px`;
    panel.style.maxHeight = `calc(100vh - ${headerBottom + gap * 2 + searchBarOffset}px)`;

    return;
  }

  panel.classList.remove("is-anchored");
  panel.classList.add("is-fixed");

  panel.style.top = `${fixedTopViewport}px`;
  panel.style.left = `${slotLeft}px`;
  panel.style.width = `${slotWidth}px`;
  panel.style.maxHeight = `calc(100vh - ${headerBottom + gap * 2 + searchBarOffset}px)`;
  panel.style.boxSizing = "border-box";
}

  let ticking = false;

  function requestUpdate() {
    if (ticking) {
      return;
    }

    ticking = true;

    window.requestAnimationFrame(() => {
      updatePanel();
      ticking = false;
    });
  }

  updatePanel();

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
}
initManualStickyCommunityPanel();

// Community Map Initialization
const map = L.map('community-map', {
  center: [41.83772083187901, -87.68664593458594], //chicago boundary centroid
  zoom: 10,
  zoomControl: true,
  scrollWheelZoom:false //disable zoom when scrolling down the page
});

// Enable zoom when clicking map
map.on('click', function() { 
  if (!map.scrollWheelZoom.enabled()) {
      map.scrollWheelZoom.enabled();
    }
});

// Disable zooming in after mouse leaves map
map.on('mouseout', function() {
  map.scrollWheelZoom.disable();
});

// Home Button (reset view to Chicago) 
const homeCoords = [41.83772083187901, -87.68664593458594];
const homeZoom = 10;

var HomeButton = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function (map) {
    var btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
          btn.style.backgroundColor = 'white';
          btn.style.width = '30px';
          btn.style.height = '30px';
          btn.style.cursor = 'pointer';
          btn.title = 'Zoom to Home';

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
      map.flyTo(homeCoords, homeZoom, { duration: 0.5 });
    });

    return btn;
  }
});

map.addControl(new HomeButton());

// Legend Toggle Button
let legendVisible = true; // track legend state
var LegendToggleControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function (map) {
    var btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    btn.style.backgroundColor = 'white';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.cursor = 'pointer';
    btn.innerHTML = '<span style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 16px; font-family: \'Material Icons\', sans-serif; color: #333;">&#xe53b;</span>';
    btn.title = 'Toggle Legend';

    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.disableScrollPropagation(btn);

    L.DomEvent.on(btn, 'click', L.DomEvent.preventDefault);
    L.DomEvent.on(btn, 'click', function () {
      if (legendVisible) {
        map.removeControl(legendControl);
        legendVisible = false;
      } else {
        map.addControl(legendControl);
        legendVisible = true;
      }
    });

    return btn;
  }
});
map.addControl(new LegendToggleControl());

// Map Legend
var LegendControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd: function (map) {
    var btn = L.DomUtil.create('div', 'map-legend');
    btn.innerHTML =
      '<div class="legend-title">Legend</div>' +
      '<div class="legend-item">' +
        '<span class="legend-symbol">&#9673;</span>' +
        '<span class="legend-label">Open Air Chicago Sensor</span>' +
      '</div>';
    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.disableScrollPropagation(btn);
    return btn;
  }
});
var legendControl = new LegendControl();
map.addControl(legendControl);

// Basemap
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri',
  maxZoom: 15
}).addTo(map);


// Sensors, Chicago Borders & Communities Layers

// Load Sensors
fetch("/static/dashboard/layers/oacd.geojson") 
.then(response => response.json())
.then(data => {
  var sensorMarker = L.divIcon({
    className: 'custom-point-marker', 
    html: '<div style="font-size: 15px; color: #624786;">◉</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

      var Sensors = L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
          return L.marker(latlng, {icon: sensorMarker, interactive: false});
        }
        }).addTo(map);
})

let ChicagoBounds = null;

// Load Chicago Borders
fetch("/static/dashboard/layers/Chicago.geojson")
.then(response => {
  if (!response.ok) {
    throw new Error("Could not load Chicago.geojson");
  }
  return response.json();
})
.then(data => {
  ChicagoBounds = L.geoJSON(data, {
    style: {
      color: "#636363",
      weight: 1.75,
      fillColor: "#00000000"
    }
  }).addTo(map);

})
.catch(err => {
  console.error("Chicago boundary load failed:", err);
});

//Highlight and Border Style
const defaultStyle = {color: "#636363", weight: 1, fillColor: "#00000066"}
const highlightStyle = {color: "#000000", weight: 2.5, fillColor: "#fbf719"}

var selectedCommunity = null //keep track of clicked community
let CommunityAreasLayer = null    //keep reference to community layer for dropdown zoom and go button

let selectedLayer = null;
let hoveredLayer = null;


// Load Dropdown
var dropdownCommunity = document.getElementById('community-dropdown');

function selectCommunityArea(selectedArea, options = {}) {
if (!selectedArea || !CommunityAreasLayer) {
  return;
}

// Reset all community styles
CommunityAreasLayer.eachLayer(function(layer) {
  layer.setStyle(defaultStyle);
});

// Close any community popup that might still be open
map.closePopup();

selectedLayer = null;

const shouldZoom = options.zoom !== false;
const shouldOpenPopup = options.popup !== false;
const shouldRenderGraphs = options.renderGraphs === true;
selectedCommunity = selectedArea;
dropdownCommunity.value = selectedArea;

CommunityAreasLayer.eachLayer(function(layer) {
  const communityName = layer.feature.properties.community;

  if (communityName === selectedArea) {
    selectedLayer = layer;
    layer.setStyle(highlightStyle);

    if (shouldZoom) {
      map.flyToBounds(layer.getBounds(), {
        padding: [20, 20],
        duration: 0.6,
        maxZoom: 12
      });
    }

    if (shouldOpenPopup) {
      const center = layer.getBounds().getCenter();
      layer.bindPopup("<b>" + communityName + "</b>");
      layer.openPopup(center);
    }
  } else {
    layer.setStyle(defaultStyle);
  }
});

if (shouldRenderGraphs) {
  renderGraphs(selectedArea);
}
}

// Load Community Areas
fetch("/static/dashboard/layers/ChicagoCommunityAreas.geojson")
.then(response => response.json())
.then(data => {
    CommunityAreasLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: function(feature, layer) {
          //create dropdown option for each feature
          var option = document.createElement('option');
          option.value = feature.properties.community;
          option.textContent = feature.properties.community;
          option.idNumber = feature.properties.area_num_1;
          dropdownCommunity.appendChild(option);
          
          // add pop-up with name for community in bold
          layer.bindPopup("<b>" + feature.properties.community + "</b>")
          
          layer.on('click', function(e) {
            selectCommunityArea(feature.properties.community, {
              zoom: true,
              popup: true,
              renderGraphs: true
            });
          });

            
          
        //highlight on hover
          layer.on({
            mouseover: function(e) {
              const layer = e.target;

              hoveredLayer = layer;

              if (layer !== selectedLayer) {
                layer.setStyle(highlightStyle);
              }
            },

            mouseout: function(e) {
              const layer = e.target;

              if (layer !== selectedLayer) {
                layer.setStyle(defaultStyle);
              }

              if (hoveredLayer === layer) {
                hoveredLayer = null;
              }
            }
          });
  }}).addTo(map)
    
  // Sort dropdown alphabetically
  const options = Array.from(dropdownCommunity.options).slice(1); // skip placeholder

  options.sort((a, b) =>
    a.text.localeCompare(b.text)
  );

  // Remove existing community options
  dropdownCommunity.length = 1;

  // Re-add in sorted order
  options.forEach(option => dropdownCommunity.add(option));
  //choose name from dropdown and zoom in on map
  dropdownCommunity.addEventListener('change', function(e) {
    selectCommunityArea(e.target.value, {
      zoom: true,
      popup: true,
      renderGraphs: true
    });
  });
})


// Graph Rendering

let rankingsData = null; // cached rankings data

function getActivePercentileMetric() {
  return document.querySelector('input[name="percentile-metric"]:checked').value;
}

// Fetch ranking data from "/api/community-rankings"
fetch('/api/community-rankings/')
.then(response => response.json())
.then(data => {
  rankingsData = data.rankings;
})
.catch(err => console.error('Failed to load community rankings:', err));

// Listen for toggle changes to re-render all graphs based on selected source
document.querySelectorAll('input[name="percentile-metric"]').forEach(radio => {
  radio.addEventListener('change', function() {
    var selectedArea = dropdownCommunity.value;
    selectedCommunity = selectedArea;
    updateGraphTitles();
    if (selectedArea) {
      if (rankingsData) {
        drawGraphs(selectedArea);
      }
    }
  });
});

// Update Graph Titles based on percentile metric
function updateGraphTitles() {
  const source = getActivePercentileMetric();

  const groundTitle =
    document.getElementById('graph-ground-title');

  const tempoTitle =
    document.getElementById('graph-tempo-title');

  const distributionAxis =
    document.getElementById('graph-distribution-axis-label');

  const units =
    source === 'tempo'
      ? 'molecules/cm²'
      : 'ppb';

  if (source === 'ground') {
    groundTitle.textContent =
      'Open Air Chicago NO₂ by Day of Week (ppb)';
    tempoTitle.textContent =
      'Open Air Chicago NO₂ Distribution (ppb)';
  }

  else if (source === 'tempo') {
    groundTitle.textContent =
      'TEMPO NO₂ by Day of Week (molecules/cm²)';
    tempoTitle.textContent =
      'TEMPO NO₂ Distribution (molecules/cm²)';
  }

  else {
    groundTitle.textContent =
      'Fused NO₂ by Day of Week (ppb)';
    tempoTitle.textContent =
      'Fused NO₂ Distribution (ppb)';
  }

  distributionAxis.innerHTML =
    `NO₂ (${units})`;
}

function renderGraphs(communityName) {
  if (!rankingsData) {
    // Try fetching again if not yet loaded
    fetch('/api/community-rankings/')
      .then(response => response.json())
      .then(data => {
        rankingsData = data.rankings;
        drawGraphs(communityName);
      })
      .catch(err => console.error('Failed to load community rankings:', err));
  } else {
    drawGraphs(communityName);
  }
}

// Draw Graphs
function drawGraphs(communityName) {
  const source = getActivePercentileMetric(); // "ground" or "tempo"
  updateGraphTitles();
  renderPercentileGraph(communityName);
  renderWeekdayBoxPlot(communityName, source);
  renderDistributionPlot(communityName, source);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Percentile Graph with TEMPO, Open Air, and Fused Selection
function renderPercentileGraph(communityName) {
  const container = document.getElementById('graph-percentile');
  // Remove old chart div if exists
  const oldChart = container.querySelector('.plotly-chart');
  if (oldChart) oldChart.remove();

  // Hide placeholder
  const placeholder = container.querySelector('.graph-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  const chartDiv = document.createElement('div');
    chartDiv.className = 'plotly-chart';

    const axisLabel =
      container.querySelector('.plot-axis-label');

    container.insertBefore(
      chartDiv,
      axisLabel
    );

      const caption =
        document.getElementById(
          'graph-percentile-caption'
        );

  // Calculate available height from container (minus title + padding)
  const availableHeight =
  Math.max(260, container.clientHeight - 50);

  // Find the selected community data
  const comm = rankingsData.find(r => r.community === communityName);
  if (!comm) {
    container.innerHTML = '<div class="graph-placeholder">Community data not found in rankings.</div>';
    return;
  }

  const metric = getActivePercentileMetric(); // "ground" or "tempo"

  const percentileCol =
  metric === 'ground'
    ? 'ground_percentile'
    : metric === 'tempo'
      ? 'tempo_percentile'
      : 'fused_percentile_y';

   const communityPercentile = comm[percentileCol];

   const percentileRounded =
      Math.round(communityPercentile);

    const sourceDescription =
      metric === 'ground'
        ? 'Open Air Chicago ground sensor observations'
        : metric === 'tempo'
          ? 'TEMPO satellite observations'
          : 'the fused NO₂ dataset';

    caption.innerHTML = `
      This community ranks in the
      <strong>${ordinal(percentileRounded)} percentile</strong>
      based on ${sourceDescription},
      meaning its average NO₂ concentration is higher than
      approximately ${percentileRounded}% of Chicago community areas.
    `;

   // Check if percentile data is available for this community
   if (communityPercentile === null || communityPercentile === undefined) {
    const noDataMsg =
      metric === 'ground'
        ? 'No Open Air Chicago sensors available for this community. Percentile ranking cannot be calculated.'
        : metric === 'tempo'
          ? 'No TEMPO data available for this community. Percentile ranking cannot be calculated.'
          : 'No Fused data available for this community. Percentile ranking cannot be calculated.';

    const oldChart = container.querySelector('.plotly-chart');
    if (oldChart) oldChart.remove();

    caption.innerHTML =
  'Percentile ranking is unavailable for the selected community.';

    let placeholder = container.querySelector('.graph-placeholder');

    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'graph-placeholder';
      container.appendChild(placeholder);
    }

    placeholder.innerHTML = `
      <strong>Percentile data unavailable</strong><br>
      ${noDataMsg}
    `;
    placeholder.style.display = 'block';

    return;
  }

   // Build normal distribution (bell curve) for percentiles 0-100
   const allPercentiles = rankingsData
    .filter(r => r[percentileCol] !== null && r[percentileCol] !== undefined)
    .map(r => r[percentileCol]);

  // Calculate mean and std of percentiles across all communities
  const n = allPercentiles.length;
  const mean = allPercentiles.reduce((a, b) => a + b, 0) / n;
  const variance = allPercentiles.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Generate smooth bell curve
  const xValues = [];
  const yValues = [];
  for (let x = 0; x <= 100; x += 0.5) {
    xValues.push(x);
    // Normal PDF
    const coeff = 1 / (std * Math.sqrt(2 * Math.PI));
    const exponent = -0.5 * ((x - mean) / std) ** 2;
    yValues.push(coeff * Math.exp(exponent));
  }

  const traceBell = {
    x: xValues,
    y: yValues,
    fill: 'tozeroy',
    fillcolor: 'rgba(38, 55, 102, 0.25)',
    line: { color: 'rgba(38, 55, 102, 0.8)', width: 2 },
    name: 'Distribution',
    showlegend: false,
    hoverinfo: 'skip',
  };

  const traceMarker = {
    x: [communityPercentile],
    y: [yValues.find(y => Math.abs(y - (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((communityPercentile - mean) / std) ** 2)) || 0)],
    mode: 'markers',
    marker: {
      size: 14,
      color: '#263766',
      symbol: 'circle-open',
      line: { width: 3, color: '#263766' },
    },
    name: communityName,
    text: `${communityName}<br>Percentile: ${communityPercentile.toFixed(1)}`,
    hoverinfo: 'text',
  };

  // Calculate the exact y position for the marker
  const markerCoeff = 1 / (std * Math.sqrt(2 * Math.PI));
  const markerExponent = -0.5 * ((communityPercentile - mean) / std) ** 2;
  traceMarker.y = [markerCoeff * Math.exp(markerExponent)];

  const layout = {
    margin: { t: 25, r: 20, b: 30, l: 65 },
    xaxis: {
      range: [0, 100],
      gridcolor: 'rgba(0,0,0,0.05)',
    },
    yaxis: {
      title: { text: 'Density', standoff: 10 },
      gridcolor: 'rgba(0,0,0,0.05)',
    },
    hovermode: 'closest',
    height: availableHeight,
    showlegend: false,
    autosize: true,
  };

  const config = { displayModeBar: false, responsive: true };

  Plotly.newPlot(chartDiv, [traceBell, traceMarker], layout, config);
  setupZoomNotification(chartDiv, 'zoom-notify-percentile');
}

// Weekday Boxplot with TEMPO, Open Air, and Fused Selection
function renderWeekdayBoxPlot(communityName, source) {
   const container = document.getElementById('graph-ground');
   const oldChart = container.querySelector('.plotly-chart');
   if (oldChart) oldChart.remove();

   const placeholder = container.querySelector('.graph-placeholder');
   if (placeholder) placeholder.style.display = 'none';

   // Show loading spinner
   const loadingEl = container.querySelector('.graph-loading');
   if (loadingEl) loadingEl.classList.add('visible');

   const chartDiv = document.createElement('div');
    chartDiv.className = 'plotly-chart';

    const axisLabel =
      container.querySelector('.plot-axis-label');

    container.insertBefore(
      chartDiv,
      axisLabel
    );

  const availableHeight =
  Math.max(340, container.clientHeight - 50);

  const sourceKey =
  source === 'ground'
    ? 'Ground'
    : source === 'tempo'
      ? 'TEMPO'
      : 'Fused';

const yLabel =
  source === 'tempo'
    ? 'NO₂ (molecules/cm²)'
    : 'NO₂ (ppb)';

const sourceLabel =
  source === 'ground'
    ? 'Ground'
    : source === 'tempo'
      ? 'TEMPO'
      : 'Fused';

  // Fetch data from "/api/community-no2-data"
  fetch(`/api/community-no2-data/?community=${encodeURIComponent(communityName)}`)
    .then(response => response.json())
    .then(result => {
      if (!result.data || result.data.length === 0) {
        if (loadingEl) loadingEl.classList.remove('visible');
        container.innerHTML = '<div class="graph-placeholder">No data available for this community.</div>';
        return;
      }

      const filteredData = result.data.filter(d => d.source === sourceKey && d.NO2 !== null && d.weekday !== null);

      if (filteredData.length === 0) {
        if (loadingEl) loadingEl.classList.remove('visible');
        showNoData(
          container,
          `${sourceLabel} NO₂ data not available.`
        );
        return;
      }

      const caption =
        document.getElementById(
          'graph-boxplot-caption'
        );

      const sourceDescription =
        source === 'ground'
          ? 'Open Air Chicago ground sensor observations'
          : source === 'tempo'
            ? 'TEMPO satellite observations'
            : 'the fused NO₂ dataset';

      const weekdayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Group NO2 values by weekday
      const byDay = {};
      for (const day of weekdayOrder) byDay[day] = [];
      for (const row of filteredData) {
        if (byDay.hasOwnProperty(row.weekday)) {
          byDay[row.weekday].push(row.NO2);
        }
      }

      const weekdayMeans = Object.entries(byDay)
        .filter(([day, values]) => values.length)
        .map(([day, values]) => ({
          day,
          mean:
            values.reduce((a, b) => a + b, 0) /
            values.length
        }));

      const highestDay =
        weekdayMeans.reduce(
          (a, b) => a.mean > b.mean ? a : b
        );

      const lowestDay =
        weekdayMeans.reduce(
          (a, b) => a.mean < b.mean ? a : b
        );

      caption.innerHTML = `
        Based on ${sourceDescription},
        average NO₂ concentrations are highest on
        <strong>${highestDay.day}</strong>
        and lowest on
        <strong>${lowestDay.day}</strong>
        within this community.
      `;

      // Build box traces for each weekday
      const traces = weekdayOrder.map(day => ({
        type: 'box',
        y: byDay[day],
        name: day,
        width: 0.65,

        boxmean: false,
        boxpoints: 'outliers',

        marker: {
          color: '#263766',
          size: 4,
          outliercolor: '#e74c3c'
        },

        fillcolor: 'rgba(159, 177, 222, 0.65)',
        line: {
          color: '#263766',
          width: 1.8
        },

        whiskerwidth: 0.8,
      }));

      const leftMargin =
        source === 'tempo'
          ? 110
          : 65;

      const layout = {
        margin: {
          t: 10,
          r: 20,
          b: 70,
          l: leftMargin
        },
        xaxis: {
          tickangle: -45
        },
        yaxis: {
          title: { text: yLabel, standoff: 15 },
          gridcolor: 'rgba(0,0,0,0.05)',
        },
        height: availableHeight,
        showlegend: false,
        autosize: true,
        boxmode: 'group'
      };

      const config = { displayModeBar: false, responsive: true };
      Plotly.newPlot(chartDiv, traces, layout, config);
      setupZoomNotification(chartDiv, 'zoom-notify-ground');
      // Hide loading spinner after plot renders
      if (loadingEl) loadingEl.classList.remove('visible');
    })
    .catch(err => {
      console.error('Failed to load NO2 data for box plot:', err);
      if (loadingEl) loadingEl.classList.remove('visible');
      container.innerHTML = '<div class="graph-placeholder">Failed to load data.</div>';
    });
}

// Distribution (KDE) plot with TEMPO, Open Air, and Fused Selection
function renderDistributionPlot(communityName, source) {
   const container = document.getElementById('graph-tempo');
   const oldChart = container.querySelector('.plotly-chart');
   if (oldChart) oldChart.remove();

   const placeholder = container.querySelector('.graph-placeholder');
   if (placeholder) placeholder.style.display = 'none';

   // Show loading spinner
   const loadingEl = container.querySelector('.graph-loading');
   if (loadingEl) loadingEl.classList.add('visible');

   const chartDiv = document.createElement('div');
    chartDiv.className = 'plotly-chart';

    const axisLabel =
      container.querySelector('.plot-axis-label');

    container.insertBefore(
      chartDiv,
      axisLabel
    );

  const availableHeight =
  Math.max(260, container.clientHeight -50);

  const sourceKey =
  source === 'ground'
    ? 'Ground'
    : source === 'tempo'
      ? 'TEMPO'
      : 'Fused';

const useScientific = source === 'tempo';

const yLabel =
  source === 'tempo'
    ? 'NO₂ (molecules/cm²)'
    : 'NO₂ (ppb)';

const sourceLabel =
  source === 'ground'
    ? 'Ground'
    : source === 'tempo'
      ? 'TEMPO'
      : 'Fused';

  // Fetch data from "/api/community-no2-data"
  fetch(`/api/community-no2-data/?community=${encodeURIComponent(communityName)}`)
    .then(response => response.json())
    .then(result => {
      if (!result.data || result.data.length === 0) {
        if (loadingEl) loadingEl.classList.remove('visible');
        container.innerHTML = '<div class="graph-placeholder">No data available for this community.</div>';
        return;
      }

      const filteredData = result.data.filter(d => d.source === sourceKey && d.NO2 !== null);

      if (filteredData.length === 0) {
        if (loadingEl) loadingEl.classList.remove('visible');
        showNoData(
          container,
          `${sourceLabel} NO₂ data not available.`
        );
        return;
      }

      const values = filteredData.map(d => d.NO2).sort((a, b) => a - b);
      const n = values.length;
      const mean = values.reduce((s, v) => s + v, 0) / n;
      const median = n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)];
      const q1 = values[Math.floor(n * 0.25)];
      const q3 = values[Math.floor(n * 0.75)];
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
      const bandwidth = 1.06 * std * Math.pow(n, -0.2);

      const caption =
        document.getElementById(
          'graph-distribution-caption'
        );

      const sourceDescription =
        source === 'ground'
          ? 'Open Air Chicago ground sensor observations'
          : source === 'tempo'
            ? 'TEMPO satellite observations'
            : 'the fused NO₂ dataset';

      const fmtValue =
        source === 'tempo'
          ? v => Number(v).toExponential(2)
          : v => Number(v).toFixed(2);

      caption.innerHTML = `
        Based on ${sourceDescription},
        the median NO₂ concentration in this community is
        <strong>${fmtValue(median)}</strong>,
        while the middle 50% of observations fall between
        <strong>${fmtValue(q1)}</strong> and
        <strong>${fmtValue(q3)}</strong>.
      `;

      const minVal = values[0];
      const maxVal = values[n - 1];
      const range = maxVal - minVal || 1;
      const xPoints = 200;
      const xValues = [];
      const yValues = [];
      for (let i = 0; i < xPoints; i++) {
        xValues.push(minVal - range * 0.1 + (range * 1.2) * i / (xPoints - 1));
      }

      for (const x of xValues) {
        let density = 0;
        for (const v of values) {
          const z = (x - v) / bandwidth;
          density += Math.exp(-0.5 * z * z);
        }
        density /= n * bandwidth * Math.sqrt(2 * Math.PI);
        yValues.push(density);
      }

      const maxDensity = Math.max(...yValues);
      const fmt = useScientific ? (v => v.toExponential(2)) : (v => v.toFixed(2));

      const traceKDE = {
        type: 'scatter', mode: 'lines',
        x: xValues, y: yValues, fill: 'tozeroy',
        fillcolor: 'rgba(38, 55, 102, 0.35)',
        line: { color: '#263766', width: 2 },
        hoverinfo: 'x',
      };

      const traceIQR = {
        type: 'scatter', mode: 'none',
        x: [q1, q3, q3, q1],
        y: [0, 0, maxDensity, maxDensity],
        fill: 'toself', fillcolor: 'rgba(0, 128, 0, 0.15)',
        name: `IQR (${fmt(q1)} - ${fmt(q3)})`,
        hoverinfo: 'name', showlegend: true,
      };

      const traceMedian = {
        type: 'scatter', mode: 'lines',
        x: [median, median], y: [0, maxDensity],
        line: { color: 'black', width: 2 },
        name: `Median = ${fmt(median)}`,
        hoverinfo: 'name', showlegend: true,
      };

      const traceMean = {
        type: 'scatter', mode: 'lines',
        x: [mean, mean], y: [0, maxDensity],
        line: { color: 'navy', width: 2, dash: 'dash' },
        name: `Mean = ${fmt(mean)}`,
        hoverinfo: 'name', showlegend: true,
      };

      const leftMargin =
        source === 'tempo'
          ? 110
          : 65;

      const layout = {
        margin: {
          t: 25,
          r: 20,
          b: 30,
          l: leftMargin
        },
        xaxis: {
          tickformat: useScientific ? '.1e' : undefined,
          gridcolor: 'rgba(0,0,0,0.05)',
        },
        yaxis: {
          title: { text: 'Density', standoff: 15 },
          gridcolor: 'rgba(0,0,0,0.05)',
        },
        height: availableHeight,
        showlegend: true,
        legend: { x: 1, y: 1, xanchor: 'right', yanchor: 'top', font: { size: 10 }, bgcolor: 'rgba(255,255,255,0.8)' },
        autosize: true,
        hovermode: 'x unified',
        hoverlabel: {
          namelength: -1
        }
      };

       const config = { displayModeBar: false, responsive: true };
       Plotly.newPlot(chartDiv, [traceKDE, traceIQR, traceMedian, traceMean], layout, config);
       setupZoomNotification(chartDiv, 'zoom-notify-tempo');
       // Hide loading spinner after plot renders
       if (loadingEl) loadingEl.classList.remove('visible');
     })
     .catch(err => {
       console.error('Failed to load NO2 data for distribution plot:', err);
       if (loadingEl) loadingEl.classList.remove('visible');
       container.innerHTML = '<div class="graph-placeholder">Failed to load data.</div>';
     });
}

// Show Placeholders when no Data Product has been Selected
function showNoData(container, message) {
  const oldChart = container.querySelector('.plotly-chart');
  if (oldChart) oldChart.remove();

  let placeholder = container.querySelector('.graph-placeholder');

  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'graph-placeholder';
    container.appendChild(placeholder);
  }

  placeholder.innerHTML = message;
  placeholder.style.display = 'block';
}

// Listen for Plotly relayout events (zoom, pan, reset) and show/hide notification
function setupZoomNotification(chartDiv, notificationId) {
  const notification = document.getElementById(notificationId);
  if (!notification) return;

  chartDiv.on('plotly_relayout', function(eventData) {
    // Check if zoom or reset occurred
    if (eventData['xaxis.range[0]'] !== undefined || eventData['yaxis.range[0]'] !== undefined) {
      // User zoomed or panned — show notification
      notification.classList.add('visible');
    }
    if (eventData['xaxis.autorange'] === true || eventData['yaxis.autorange'] === true) {
      // User reset (double-click) — hide notification
      notification.classList.remove('visible');
    }
  });
}

// Export Page as PDF
// Captures the entire community page content (hero + layout) as a PDF using html2canvas + jsPDF
function exportCommunityAsPDF() {
  const btn = document.getElementById('export-pdf-btn');
  btn.disabled = true;
  btn.textContent = 'Generating PDF...';
  // The element to capture: everything under the navbar
  const element = document.querySelector('.hero');
  // We need to capture hero + community-layout together
  const tempWrapper = document.createElement('div');
  // Insert temp wrapper before hero
  element.parentNode.insertBefore(tempWrapper, element);
  // Move hero and community-layout into the wrapper
  tempWrapper.appendChild(element);
  tempWrapper.appendChild(document.querySelector('.community-layout'));
  const captureEl = tempWrapper;
  // Temporarily hide the export header from the screenshot
  const exportHeaders = document.querySelectorAll('.community-export-header');
  exportHeaders.forEach(h => h.style.visibility = 'hidden');
  // Wait for Plotly charts to be ready
  setTimeout(() => {
    html2canvas(captureEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollY: -window.scrollY,
      windowHeight: captureEl.scrollHeight,
    }).then(canvas => {
      // Restore visibility
      exportHeaders.forEach(h => h.style.visibility = '');
      // Restore DOM structure
      tempWrapper.parentNode.insertBefore(element, tempWrapper);
      tempWrapper.parentNode.insertBefore(document.querySelector('.community-layout'), tempWrapper);
      tempWrapper.remove();
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageHeight = 297; // A4 height in mm
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const community = dropdownCommunity.value || 'Community';
      pdf.save(`${community}_Statistical_Analysis.pdf`);
      btn.disabled = false;
      btn.textContent = 'Export as PDF';
    }).catch(err => {
      console.error('PDF export failed:', err);
      exportHeaders.forEach(h => h.style.visibility = '');
      // Restore DOM even on error
      if (tempWrapper.parentNode) {
        tempWrapper.parentNode.insertBefore(element, tempWrapper);
        const layout = document.querySelector('.community-layout');
        if (layout && layout.parentNode !== tempWrapper) {
          tempWrapper.parentNode.insertBefore(layout, tempWrapper);
        }
        tempWrapper.remove();
      }
      btn.disabled = false;
      btn.textContent = 'Export as PDF';
      alert('Failed to generate PDF. Please try again.');
    });
  }, 300);
}

// Scalebar: Update on Zoom
function updateScaleBar() {
    const ruler = document.getElementById('scalebar-ruler');
    const ticksContainer = document.getElementById('scalebar-ticks');
    const labelsContainer = document.getElementById('scalebar-labels');
    if (!ruler || !ticksContainer || !labelsContainer) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    // miles per pixel at this zoom / latitude (Web Mercator)
    // corrected: divide by tile size (256) to get proper miles-per-pixel
    const milesPerPixel = (2 * Math.PI * 6378137) /
        (Math.pow(2, zoom) * 256 * Math.cos(center.lat * Math.PI / 180));

    const totalPixels = 100;  // fixed ruler width (matches CSS .scalebar-ruler width)
    const distanceMiles = milesPerPixel * totalPixels;

      // Pick a nice round total distance
      let value, units;
      if (distanceMiles >= 1609.344) {
          const distMiles = distanceMiles / 1609.344;
          const mag = Math.pow(10, Math.floor(Math.log10(distMiles)));
          const norm = distMiles / mag;
          value = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag;
          units = 'mi';
      } else {
          const mag = Math.pow(10, Math.floor(Math.log10(distanceMiles || 1)));
          const norm = distanceMiles / mag;
          value = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag;
          units = 'ft';
      }

      const totalMeters = (units === 'mi' ? value * 1609.344 : value * 0.3048);
    const majorSegments = 4;   // 5 major ticks: 0, 1/4, 2/4, 3/4, 1
    const minorPerMajor = 4;   // 4 minor ticks between each major → 5 sub-segments
    const minorSegmentMeters = totalMeters / (majorSegments * minorPerMajor);
    const minorSegmentPixels = totalPixels / (majorSegments * minorPerMajor);

    // Build ticks
    ticksContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    labelsContainer.style.width = totalPixels + 'px';

    const totalMinorTicks = majorSegments * minorPerMajor + 1;
    for (let i = 0; i < totalMinorTicks; i++) {
        const isMajor = (i % minorPerMajor === 0);
        const tick = document.createElement('div');
        tick.className = 'scalebar-tick ' + (isMajor ? 'major' : 'minor');
        tick.style.left = (i * minorSegmentPixels) + 'px';
        ticksContainer.appendChild(tick);

          if (isMajor) {
              const label = document.createElement('span');
              label.className = 'scalebar-label';
              const valMeters = minorSegmentMeters * i;
              if (units === 'mi') {
                  const valMiles = valMeters / 1609.344;
                  label.textContent = valMiles.toFixed(valMiles < 10 ? 1 : 0) + ' mi';
              } else {
                  const valFt = valMeters / 0.3048;
                  label.textContent = Math.round(valFt) + ' ft';
              }
              label.style.left = (i * minorSegmentPixels) + 'px';
              label.style.transform = 'translateX(-50%)';
              labelsContainer.appendChild(label);
          }
    }
}

// Attach scalebar update to map zoom/pan events
map.on('zoomend moveend', updateScaleBar);
setTimeout(updateScaleBar, 500);