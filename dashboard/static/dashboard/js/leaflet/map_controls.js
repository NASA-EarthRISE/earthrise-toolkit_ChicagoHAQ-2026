// EDIT for TEMPO & Clarity Data Sources── CONFIGURATION ──────────────────────────────────────────────────────────
let TIME_SCALE = '{{ time_scale|default:"hourly" }}';  // hourly, daily, monthly

// ── BASEMAP LAYERS ────────────────────────────────────────────────────
const tileLayers = {
osm: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
}),
};


// ── MAP INIT ───────────────────────────────────────────────────────────────
var map = L.map('map', {
center: [41.52, -87.37],  // Chicago, IL default
zoom: 10,
layers: [tileLayers.osm],
zoomControl: true,
preferCanvas: true
});

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

// ── GLOBAL VARIABLES (from V4) ──────────────────────────────────────────────────────────
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
let displayMode = "sensor";       // "sensor" (Clarity) or "grid" (TEMPO) or "community"
let currentDataProduct = "tempo"; // default matches sidebar radio "checked" value; "clarity" or "tempo" or "fusion"
let rangeStartDate = null;
let rangeEndDate = null;
let rangeCurrentEndDate = null;

let dates = [];
let allDates = [];       // unfiltered copy — kept in sync by each date loader
let rangeDates = [];

// TEMPO-specific date arrays (hourly and daily can differ)
let tempoHourlyDates = [];
let tempoDailyDates = [];
let communityHourLookup = null;   // TEMPO community hourly lookup

let communityLayer = null;      // colored data layer
let loadingControl = null;

let cachedDate = null;
let cachedFeatures = null;
let cachedHourBuckets = null;

let nextCachedDate = null;
let nextCachedHourBuckets = null;

let timeInterval = null;

const chicagoDateFormatter =
  new Intl.DateTimeFormat(
      "en-US",
      {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "numeric",
          day: "numeric"
      }
  );

const chicagoHourFormatter =
  new Intl.DateTimeFormat(
      "en-US",
      {
          timeZone: "America/Chicago",
          hour: "numeric",
          hour12: false
      }
  );


// ── CHICAGO BORDERS & COMMUNITIES LAYERS ───────────────────────────────────────────────────────────────
function loadChicagoBorder(){
    fetch("{% static 'dashboard/layers/Chicago.geojson' %}")
    .then(response => response.json())
    .then(data => {
        var ChicagoBounds = L.geoJSON(data, {
            style:{
            color: "#636363", // Outline color
            weight: 1.5,
            fillColor: "#00000000" //make fill transparent
            }
        }).addTo(map);
        map.fitBounds(ChicagoBounds.getBounds())
    })
}

function loadCommunityAreas() {
fetch("{% static 'dashboard/layers/ChicagoCommunityAreas.geojson' %}")
    .then(response => response.json())
    .then(data => {
        communityData = data;
        ChicagoCommunityAreas = L.geoJSON(data, {

            style: function(feature) {
            return {
                color: "#636363", 
                weight: 1, 
                fillOpacity: 0,
                opacity: 0.8
            };
        },
            onEachFeature: function(feature, layer) {

                // Display whatever property exists
                let props = feature.properties;

                let label =
                    props.community ||
                    props.COMMUNITY ||
                    props.community_name ||
                    props.name ||
                    "Community Area";

                layer.bindTooltip(label);
            }

        });

        ChicagoCommunityAreas.addTo(map);
        
        // Prevents map from involuntarily panning away from the Chicago area
        if (window.ChicagoBounds) {
            map.fitBounds(ChicagoBounds.getBounds())
        }

        // Keep boundaries behind sensor markers
        ChicagoCommunityAreas.bringToBack();
    })
    .catch(err => {
        console.error("Could not load community boundaries:", err);
    });
}

// ── LAYER GROUPS ───────────────────────────────────────────────────────────
const markerGroup = L.layerGroup().addTo(map);
const tempoLayerGroup = L.layerGroup().addTo(map);
const openaqLayerGroup = L.layerGroup();
const fusionLayerGroup = L.layerGroup();
const windLayerGroup = L.layerGroup();
let heatLayer = null;
let savedMarkers = [];
let markerIdSeq = 0;


// ── COLOR SCALES ──────────────────────────────────────────────────────────────────────────────
// Clarity color scale – linear, ppb (0–50)
function getColorClarity(no2) {
if (no2 === null || no2 === undefined || isNaN(no2)) return "gray";
if (CLARITY_GLOBAL_MAX === CLARITY_GLOBAL_MIN) return "blue";
let t = (no2 - CLARITY_GLOBAL_MIN) / (CLARITY_GLOBAL_MAX - CLARITY_GLOBAL_MIN);
t = Math.max(0, Math.min(1, t));
let r = Math.floor(255 * t);
let g = Math.floor(255 * (1 - Math.abs(t - 0.5) * 2));
let b = Math.floor(255 * (1 - t));
return `rgb(${r}, ${g}, ${b})`;
}

// TEMPO color scale – sqrt-based, molecules/cm² (1e9 – 5e16)
function getColorTempo(no2) {
if (no2 === null || no2 === undefined || isNaN(no2)) return "gray";
if (TEMPO_GLOBAL_MAX === TEMPO_GLOBAL_MIN) return "blue";
let Min = Math.sqrt(TEMPO_GLOBAL_MIN);
let Max = Math.sqrt(TEMPO_GLOBAL_MAX);
let Value = Math.sqrt(no2);
let t = (Value - Min) / (Max - Min);
t = Math.max(0, Math.min(1, t));
let r = Math.floor(255 * t);
let g = Math.floor(255 * (1 - Math.abs(t - 0.5) * 2));
let b = Math.floor(255 * (1 - t));

return `rgb(${r}, ${g}, ${b})`;
}

// Unified getColor – delegates to the correct scale based on current data product
function getColor(no2) {
if (currentDataProduct === "tempo") {
    return getColorTempo(no2);
}
return getColorClarity(no2);
}


// ── V4 HELPER FUNCTIONS ─────────────────────────────────────────────────────────────────────────────

function buildHourBuckets(features) {
  let buckets = {};
  for (let h = 0; h < 24; h++) {
      buckets[h] = [];
  }
  features.forEach(f => {
      buckets[f._chicagoHour].push(f);
  });
  return buckets;
}

function prefetchNextDay(date) {
  let currentIndex = dates.indexOf(date);
  if (currentIndex < 0 || currentIndex >= dates.length - 1) {
      return;
  }

  let nextDate = dates[currentIndex + 1];
  if (nextCachedDate === nextDate) {
      return;
  }

  let prevDate = currentIndex >= 0 ? dates[currentIndex] : null;
  let afterNextDate = currentIndex < dates.length - 2 ? dates[currentIndex + 2] : null;

  let requests = [];

    if (prevDate)

  Promise.all(requests)
  .then(files => {
      let combinedFeatures = [];
      files.forEach(data => {
          if (data) {
              combinedFeatures.push(...data.features);
          }
      });

      let filteredFeatures = combinedFeatures.filter(f => {
          let utcDate = new Date(f.properties.time + "Z");
          let chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
          let y = chicagoParts.find(p => p.type === "year").value;
          let m = chicagoParts.find(p => p.type === "month").value.padStart(2,"0");
          let d = chicagoParts.find(p => p.type === "day").value.padStart(2,"0");
          let chicagoDateStr = `${y}-${m}-${d}`;

          f._chicagoHour = Number(
              chicagoHourFormatter.formatToParts(utcDate)
                  .find(x => x.type === "hour").value
          );

          return chicagoDateStr === nextDate;
      });

      nextCachedDate = nextDate;
      nextCachedHourBuckets = buildHourBuckets(filteredFeatures);
      console.log("Prefetched:", nextDate);
  });
}

function formatCentralTime(utcString) {
  let d = new Date(utcString + "Z");
  return d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
  });
}

function formatHourForDisplay(dateStr, selectedHour) {
  let baseUTC = new Date(`${dateStr}T12:00:00Z`);
  let chicagoBase = new Date(
      baseUTC.toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  let offset = chicagoBase.getHours() - 12;
  let correctUTCHour = selectedHour - offset;
  let adjusted = new Date(`${dateStr}T00:00:00Z`);
  adjusted.setUTCHours(correctUTCHour);

  return adjusted.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: true,
      timeZoneName: "short"
  });
}

function formatMonthForDisplay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
      console.warn("formatMonthForDisplay received invalid date:", dateStr);
      return "Unknown Month";
  }
  const [year, month] = dateStr.split("-");
  return new Date(
      Number(year),
      Number(month) - 1,
      1
  ).toLocaleDateString(
      "en-US",
      {
          month: "long",
          year: "numeric"
      }
  );
}

function utcDateToCentralPretty(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(
      "en-US",
      {
          year: "numeric",
          month: "long",
          day: "numeric"
      }
  );
}

function getPreviousDate(dateStr) {
  let d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

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

// ── V4 COMMUNITY AREA RENDERING ──────────────────────────────────────────────────────

function drawCommunityAreas(filteredFeatures) {
  if (!communityData) {
      console.warn("Community data not loaded");
      return;
  }

  let stats = {};
  communityData.features.forEach(poly => {
      let props = poly.properties;
      let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
      stats[name] = { sum: 0, count: 0 };
  });

  filteredFeatures.forEach(f => {
      let p = f.properties;
      let no2 = parseFloat(p.no2concindividual_value);
      if (isNaN(no2)) return;
      let hour = f._chicagoHour;

      if (TIME_SCALE === "hourly" && hour !== selectedHour) return;

      let point = turf.point([
          parseFloat(p.longitude),
          parseFloat(p.latitude)
      ]);

      communityData.features.forEach(poly => {
          if (turf.booleanPointInPolygon(point, poly)) {
              let props = poly.properties;
              let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
              stats[name].sum += no2;
              stats[name].count += 1;
          }
      });
  });

  if (communityLayer) {
      map.removeLayer(communityLayer);
  }

  communityLayer = L.geoJSON(communityData, {
      style: function(feature) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
          let avg = null;
          if (stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          return {
              color: "#222",
              weight: 1,
              fillColor: getColor(avg),
              fillOpacity: avg === null ? 0 : 0.65
          };
      },
      onEachFeature: function(feature, layer) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
          let avg = null;
          if (stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          layer.bindTooltip(`
              <b>${name}</b><br>
              Avg NO₂: ${avg === null ? "No Data" : avg.toFixed(1) + " ppb"}<br>
              Measurements: ${stats[name].count}
          `);
      }
  });

  communityLayer.addTo(map);
  hideLoading();
}

function loadDailyCommunities(date) {
  fetch(`/data/clarity/daily_community_${date}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (communityLayer) {
          map.removeLayer(communityLayer);
      }
      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.avg_no2;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
                  fillColor: avg === null ? "transparent" : getColor(avg),
                  fillOpacity: avg === null ? 0 : 0.65
              };
          },
          onEachFeature: function(feature, layer) {
              let p = feature.properties;
              layer.bindTooltip(`
                  <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                  Avg NO₂: ${p.avg_no2 == null ? "No Data" : Number(p.avg_no2).toFixed(1)} ppb<br>
                  Measurements: ${p.count || 0}
              `);
          }
      });
      communityLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load daily community file:", err);
  });
}

function loadMonthlyCommunities(month) {
  fetch(`/data/clarity/monthly_community_${month}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (communityLayer) {
          map.removeLayer(communityLayer);
      }
      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.avg_no2;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
                  fillColor: avg === null ? "transparent" : getColor(avg),
                  fillOpacity: avg === null ? 0 : 0.65
              };
          },
          onEachFeature: function(feature, layer) {
              let p = feature.properties;
              layer.bindTooltip(`
                  <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                  Avg NO₂: ${p.avg_no2 == null ? "No Data" : Number(p.avg_no2).toFixed(1)} ppb<br>
                  Measurements: ${p.count || 0}
              `);
          }
      });
      communityLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load monthly community file:", err);
  });
}

function loadDailySensors(date) {
  fetch(`/data/clarity/daily_sensor_${date}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let avg = parseFloat(p.avg_no2);
          let marker = L.circleMarker([
              f.geometry.coordinates[1],
              f.geometry.coordinates[0]
          ], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
          });
          marker.bindTooltip(`
              <b>${p.sensor_name}</b><br>
              Daily Average<br>
              Avg NO₂: ${avg.toFixed(1)} ppb<br>
              Measurements: ${p.count}
          `);
          currentLayer.addLayer(marker);
      });
      currentLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load daily sensor file:", err);
  });
}

function loadMonthlySensors(month) {
  fetch(`/data/clarity/monthly_sensor_${month}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let avg = parseFloat(p.avg_no2);
          let marker = L.circleMarker([
              f.geometry.coordinates[1],
              f.geometry.coordinates[0]
          ], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
          });
          marker.bindTooltip(`
              <b>${p.sensor_name}</b><br>
              Monthly Average<br>
              Avg NO₂: ${avg.toFixed(1)} ppb<br>
              Measurements: ${p.count}
          `);
          currentLayer.addLayer(marker);
      });
      currentLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load monthly sensor file:", err);
  });
}

// ── TEMPO DATA LOADING FUNCTIONS ──────────────────────────────────────────────────

function formatCentralTimePretty(utcString) {
  let d = new Date(utcString + "Z");
  return d.toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: true,
      timeZoneName: "short"
  });
}

// TEMPO Daily – renders grid cells as colored GeoJSON polygons
function loadDailyTempo(date) {
  if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
  }

  fetch(`/data/tempo/day_${date}.geojson`)
  .then(r => {
      if (!r.ok) return null;
      return r.json();
  })
  .then(data => {
      if (!data || !data.features || data.features.length === 0) {
          hideLoading();
          showLoading(`No Data Available<br>${utcDateToCentralPretty(date)}`);
          return;
      }

      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let value = parseFloat(p.vertical_column_troposphere);
          if (isNaN(value)) return;

          let geoJsonLayer = L.geoJSON(f, {
              style: {
                  color: getColorTempo(value),
                  fillColor: getColorTempo(value),
                  weight: 0,
                  fillOpacity: 0.77,
                  opacity: 0.78
              },
              onEachFeature: function(feature, layer) {
                  layer.bindTooltip(`
                      <b>${p.sensor_name || "TEMPO Cell"}</b><br>
                      Daily Avg NO₂: ${value.toExponential(2)} (molecules/cm<sup>2</sup>)
                  `);
              }
          });
          currentLayer.addLayer(geoJsonLayer);
      });

      currentLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load TEMPO daily file:", err);
  });
}

// TEMPO Monthly – renders grid cells as colored GeoJSON polygons
function loadMonthlyTempo(month) {
  if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
  }

  fetch(`/data/tempo/month_${month}.geojson`)
  .then(r => r.json())
  .then(data => {
      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let value = parseFloat(p.vertical_column_troposphere);
          if (isNaN(value)) return;

          let geoJsonLayer = L.geoJSON(f, {
              style: {
                  color: getColorTempo(value),
                  fillColor: getColorTempo(value),
                  weight: 0,
                  fillOpacity: 0.77,
                  opacity: 0.78
              },
              onEachFeature: function(feature, layer) {
                  layer.bindTooltip(`
                      <b>${p.sensor_name || "TEMPO Cell"}</b><br>
                      Monthly Avg NO₂: ${value.toExponential(2)} (molecules/cm<sup>2</sup>)
                  `);
              }
          });
          currentLayer.addLayer(geoJsonLayer);
      });

      currentLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load TEMPO monthly file:", err);
  });
}

// TEMPO Daily Communities
function loadTempoDailyCommunities(date) {
  if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
  }

  fetch(`/data/tempo/day_community_${date}.geojson`)
  .then(r => {
      if (!r.ok) return null;
      return r.json();
  })
  .then(data => {
      if (!data || !data.features || data.features.length === 0) {
          if (communityLayer) {
              map.removeLayer(communityLayer);
              communityLayer = null;
          }
          hideLoading();
          showLoading(`No Data Available<br>${utcDateToCentralPretty(date)}`);
          return;
      }

      if (communityLayer) {
          map.removeLayer(communityLayer);
      }

      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.vertical_column_troposphere;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
                  fillColor: avg === null ? "transparent" : getColorTempo(avg),
                  fillOpacity: avg === null ? 0 : 0.65
              };
          },
          onEachFeature: function(feature, layer) {
              let p = feature.properties;
              layer.bindTooltip(`
                  <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                  Avg NO₂: ${
                      p.vertical_column_troposphere == null
                          ? "No Data"
                          : Number(p.vertical_column_troposphere).toExponential(2)
                  }
              `);
          }
      });

      communityLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.warn("No TEMPO community data for", date);
  });
}

// TEMPO Monthly Communities
function loadTempoMonthlyCommunities(month) {
  if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
  }

  fetch(`/data/tempo/monthly_community_${month}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (communityLayer) {
          map.removeLayer(communityLayer);
      }

      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.vertical_column_troposphere;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
                  fillColor: avg === null ? "transparent" : getColorTempo(avg),
                  fillOpacity: avg === null ? 0 : 0.65
              };
          },
          onEachFeature: function(feature, layer) {
              let p = feature.properties;
              layer.bindTooltip(`
                  <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                  Avg NO₂: ${
                      p.vertical_column_troposphere == null
                          ? "No Data"
                          : Number(p.vertical_column_troposphere).toExponential(2)
                  }
              `);
          }
      });

      communityLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("Could not load TEMPO monthly community file:", err);
  });
}

// TEMPO Date Range – average grid cells across selected dates
function loadTempoDateRange() {
  if (!timeInterval) {
      showLoading(`Loading ${rangeStartDate} to ${rangeCurrentEndDate}`);
  }

  let selectedDates = rangeDates.length > 0
      ? rangeDates
      : dates.filter(d => d >= rangeStartDate && d <= rangeCurrentEndDate);

  Promise.all(
      selectedDates.map(date =>
          fetch(`/data/tempo/day_${date}.geojson`)
          .then(r => {
              if (!r.ok) {
                  console.warn("Missing TEMPO daily file:", date);
                  return null;
              }
              return r.json();
          })
      )
  )
  .then(files => {
      files = files.filter(f => f !== null);
      if (files.length === 0) {
          console.warn("No TEMPO daily files found in range.");
          hideLoading();
          return;
      }

      let cellStats = {};
      files.forEach(data => {
          data.features.forEach(f => {
              let value = Number(f.properties.vertical_column_troposphere);
              if (isNaN(value)) return;
              let key = JSON.stringify(f.geometry);
              if (!cellStats[key]) {
                  cellStats[key] = {
                      feature: structuredClone(f),
                      sum: 0,
                      count: 0
                  };
              }
              cellStats[key].sum += value;
              cellStats[key].count++;
          });
      });

      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();

      Object.values(cellStats).forEach(cell => {
          let avg = cell.sum / cell.count;
          cell.feature.properties.vertical_column_troposphere = avg;
          let geoJsonLayer = L.geoJSON(cell.feature, {
              style: {
                  color: getColorTempo(avg),
                  fillColor: getColorTempo(avg),
                  weight: 0,
                  fillOpacity: 0.77,
                  opacity: 0.78
              },
              onEachFeature: function(feature, layer) {
                  layer.bindTooltip(`
                      <b>TEMPO Cell</b><br>
                      ${utcDateToCentralPretty(rangeStartDate)} to ${utcDateToCentralPretty(rangeCurrentEndDate)}<br>
                      Average NO₂: ${avg.toExponential(2)} molecules/cm²<br>
                      Days: ${cell.count}
                  `);
              }
          });
          currentLayer.addLayer(geoJsonLayer);
      });

      currentLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("TEMPO date range load failed:", err);
  });
}

// TEMPO Community Date Range
function loadTempoCommunityDateRange() {
  if (!timeInterval) {
      showLoading(`Loading ${rangeStartDate} to ${rangeCurrentEndDate}`);
  }

  let selectedDates = rangeDates.length > 0
      ? rangeDates
      : dates.filter(d => d >= rangeStartDate && d <= rangeCurrentEndDate);

  Promise.all(
      selectedDates.map(date =>
          fetch(`/data/tempo/day_community_${date}.geojson`)
          .then(r => {
              if (!r.ok) return null;
              return r.json();
          })
      )
  )
  .then(files => {
      files = files.filter(f => f !== null);
      if (files.length === 0) {
          hideLoading();
          return;
      }

      let stats = {};
      files.forEach(data => {
          data.features.forEach(f => {
              let community = f.properties.community;
              let value = Number(f.properties.vertical_column_troposphere);
              if (isNaN(value)) return;
              if (!stats[community]) {
                  stats[community] = { sum: 0, count: 0 };
              }
              stats[community].sum += value;
              stats[community].count++;
          });
      });

      if (communityLayer) {
          map.removeLayer(communityLayer);
      }

      communityLayer = L.geoJSON(communityData, {
          style: function(feature) {
              let community = feature.properties.community;
              let avg = null;
              if (stats[community]) {
                  avg = stats[community].sum / stats[community].count;
              }
              return {
                  color: "#222",
                  weight: 1,
                  fillColor: avg == null ? "transparent" : getColorTempo(avg),
                  fillOpacity: avg == null ? 0 : 0.65
              };
          },
          onEachFeature: function(feature, layer) {
              let community = feature.properties.community;
              let avg = null;
              let count = 0;
              if (stats[community]) {
                  avg = stats[community].sum / stats[community].count;
                  count = stats[community].count;
              }
              layer.bindTooltip(`
                  <b>${community}</b><br>
                  Average NO₂:<br>
                  ${avg == null ? "No Data" : avg.toExponential(2)}<br>
                  Days: ${count}
              `);
          }
      });

      communityLayer.addTo(map);
      hideLoading();
  })
  .catch(err => {
      console.error("TEMPO community range load failed:", err);
  });
}

// TEMPO renderFeatures – renders hourly grid cells as GeoJSON polygons
function renderTempoFeatures(filteredFeatures, date) {
  if (currentLayer) {
      map.removeLayer(currentLayer);
  }
  currentLayer = L.layerGroup();

  filteredFeatures.forEach(f => {
      let p = f.properties;
      let value = parseFloat(p.vertical_column_troposphere);
      if (isNaN(value)) return;

      let geoJsonLayer = L.geoJSON(f, {
          style: {
              color: getColorTempo(value),
              fillColor: getColorTempo(value),
              weight: 0,
              fillOpacity: 0.77,
              opacity: 0.78
          },
          onEachFeature: function(feature, layer) {
              layer.bindTooltip(`
                  <b>${p.sensor_name || "TEMPO Cell"}</b><br>
                  NO₂: ${value.toExponential(2)} (molecules/cm²)<br>
                  Time: ${formatCentralTimePretty(p.time)}
              `);
          }
      });
      currentLayer.addLayer(geoJsonLayer);
  });

  currentLayer.addTo(map);
  hideLoading();
}

// TEMPO prefetch next day
function prefetchTempoNextDay(date) {
  let currentIndex = dates.indexOf(date);
  if (currentIndex < 0 || currentIndex >= dates.length - 1) return;

  let nextDate = dates[currentIndex + 1];
  if (nextCachedDate === nextDate) return;

  let prevDate = currentIndex >= 0 ? dates[currentIndex] : null;
  let afterNextDate = currentIndex < dates.length - 2 ? dates[currentIndex + 2] : null;

  let requests = [];
  if (prevDate) {
      requests.push(
          fetch(`/data/tempo/${prevDate}.geojson`)
          .then(r => r.ok ? r.json() : null)
      );
  }
  requests.push(
      fetch(`/data/tempo/${nextDate}.geojson`)
      .then(r => r.ok ? r.json() : null)
  );
  if (afterNextDate) {
      requests.push(
          fetch(`/data/tempo/${afterNextDate}.geojson`)
          .then(r => r.ok ? r.json() : null)
      );
  }

  Promise.all(requests).then(files => {
      let combinedFeatures = [];
      files.forEach(data => {
          if (data) combinedFeatures.push(...data.features);
      });

      let filteredFeatures = combinedFeatures.filter(f => {
          let utcDate = new Date(f.properties.time + "Z");
          let chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
          let y = chicagoParts.find(p => p.type === "year").value;
          let m = chicagoParts.find(p => p.type === "month").value.padStart(2, "0");
          let d = chicagoParts.find(p => p.type === "day").value.padStart(2, "0");
          let chicagoDateStr = `${y}-${m}-${d}`;

          f._chicagoHour = Number(
              chicagoHourFormatter.formatToParts(utcDate)
                  .find(x => x.type === "hour").value
          );
          return chicagoDateStr === nextDate;
      });

      nextCachedDate = nextDate;
      nextCachedHourBuckets = buildHourBuckets(filteredFeatures);
      console.log("TEMPO Prefetched:", nextDate);
  });
}

function loadDateRange() {
  if (!timeInterval) {
      showLoading(`Loading ${rangeStartDate} to ${rangeCurrentEndDate}`);
  }

  let selectedDates = dates.filter(d =>
      d >= rangeStartDate && d <= rangeCurrentEndDate
  );

  let filePrefix = displayMode === "community" ? "daily_community" : "daily_sensor";

  Promise.all(
      selectedDates.map(date =>
          fetch(`/data/clarity/${filePrefix}_${date}.geojson`)
          .then(r => r.json())
      )
  )
  .then(files => {
      if (displayMode === "community") {
          renderCommunityRange(files);
          return;
      }

      let grouped = {};
      files.forEach(data => {
          data.features.forEach(f => {
              let p = f.properties;
              let sensor = p.sensor_name;
              let avg = Number(p.avg_no2);
              if (!grouped[sensor]) {
                  grouped[sensor] = {
                      lat: f.geometry.coordinates[1],
                      lon: f.geometry.coordinates[0],
                      sum: 0,
                      count: 0
                  };
              }
              if (!isNaN(avg)) {
                  grouped[sensor].sum += avg;
                  grouped[sensor].count++;
              }
          });
      });

      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();

      Object.keys(grouped).forEach(sensor => {
          let g = grouped[sensor];
          if (g.count === 0) return;
          let avg = g.sum / g.count;
          let marker = L.circleMarker([g.lat, g.lon], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
          });
          marker.bindTooltip(`
              <b>${sensor}</b><br>
              ${rangeStartDate} to ${rangeCurrentEndDate}<br>
              Avg NO₂: ${avg.toFixed(1)} ppb<br>
              Days: ${g.count}
          `);
          currentLayer.addLayer(marker);
      });

      currentLayer.addTo(map);
      hideLoading();
  });
}

function renderCommunityRange(files) {
  let stats = {};
  files.forEach(data => {
      data.features.forEach(f => {
          let p = f.properties;
          let name = p.community || p.COMMUNITY || p.community_name || p.name;
          let avg = Number(p.avg_no2);
          let measurements = Number(p.count || 0);

          if (!stats[name]) {
              stats[name] = { sum: 0, count: 0 };
          }
          if (!isNaN(avg)) {
              stats[name].sum += avg * measurements;
              stats[name].count += measurements;
          }
      });
  });

  if (communityLayer) {
      map.removeLayer(communityLayer);
  }

  communityLayer = L.geoJSON(communityData, {
      style: function(feature) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name;
          let avg = null;
          if (stats[name] && stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          return {
              color: "#222",
              weight: 1,
              fillColor: avg === null ? "transparent" : getColor(avg),
              fillOpacity: avg === null ? 0 : 0.65
          };
      },
      onEachFeature: function(feature, layer) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name;
          let avg = null;
          let totalCount = 0;
          if (stats[name]) {
              totalCount = stats[name].count;
              if (totalCount > 0) {
                  avg = stats[name].sum / totalCount;
              }
          }
          layer.bindTooltip(`
              <b>${name}</b><br>
              Average Through ${utcDateToCentralPretty(rangeCurrentEndDate)}<br>
              Avg NO₂: ${avg === null ? "No Data" : avg.toFixed(1)} ppb
          `);
      }
  });

  communityLayer.addTo(map);
  hideLoading();
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

// ── V4 RENDER FEATURES ──────────────────────────────────────────────────────

function renderFeatures(filteredFeatures, date){
  let grouped = {};

  filteredFeatures.forEach(f => {
      let p = f.properties;
      let sensor = p.sensor_name;
      let no2 = parseFloat(p.no2concindividual_value);
      if (isNaN(no2)) return;

      if (!grouped[sensor]) {
          grouped[sensor] = {
              lat: parseFloat(p.latitude),
              lon: parseFloat(p.longitude),
              values: [],
              times: []
          };
      }

      grouped[sensor].values.push(no2);
      grouped[sensor].times.push({
          time: p.time,
          value: no2
      });
  });

  if (currentLayer) {
      map.removeLayer(currentLayer);
  }
  currentLayer = L.layerGroup();

  if (displayMode === "community") {
      drawCommunityAreas(filteredFeatures);
      return;
  }

  let displayTime;
  if (TIME_SCALE === "hourly") {
      displayTime = formatHourForDisplay(date, selectedHour);
  }
  else if (TIME_SCALE === "daily") {
      displayTime = "Daily Average";
  }
  else {
      displayTime = "Monthly Average";
  }

  Object.keys(grouped).forEach(sensor => {
      let g = grouped[sensor];
      if (g.values.length === 0) return;

      let avg = g.values.reduce((a, b) => a + b, 0) / g.values.length;

      let listHTML = "";
      if (!timeInterval) {
          listHTML = g.times.map(d => {
              return `${formatCentralTime(d.time)} — ${d.value.toFixed(1)} ppb`;
          }).join("<br>");
      }

      let marker = L.circleMarker([g.lat, g.lon], {
          radius: 6,
          fillColor: getColor(avg),
          color: "#222",
          weight: 1,
          fillOpacity: 0.9
      });

      marker.bindTooltip(`
          <b>${sensor}</b><br>
          Time: ${displayTime}<br>
          Avg NO₂: ${avg.toFixed(1)} ppb<br>
          Measurements: ${g.values.length}
      `);

      if (!timeInterval) {
          marker.bindPopup(`
              <div style="max-height:250px; overflow-y:auto;">
                  <b>${sensor}</b><br>
                  <b>Average NO₂:</b> ${avg.toFixed(1)} ppb<br>
                  <b>Measurements:</b> ${g.values.length}
                  <hr>
                  ${listHTML}
              </div>
          `);
      }

      currentLayer.addLayer(marker);
  });

  currentLayer.addTo(map);
  hideLoading();
}

// ── UNIFIED LOAD DATE (routes to Clarity or TEMPO based on currentDataProduct) ──

function loadDate(date) {
  console.log("Loading:", date, "Product:", currentDataProduct, "Display:", displayMode, "Aggregation:", TIME_SCALE);

  let loadingText;
  if (TIME_SCALE === "monthly") {
      loadingText = `Loading ${date.substring(0, 7)}`;
  } else if (TIME_SCALE === "daily") {
      loadingText = `Loading ${utcDateToCentralPretty(date)}`;
  } else {
      loadingText = `Loading ${utcDateToCentralPretty(date)} • ${formatHourForDisplay(date, selectedHour)}`;
  }

  if (!(TIME_SCALE === "hourly" && cachedDate === date) && !timeInterval) {
      showLoading(loadingText);
  }

  let currentIndex = dates.indexOf(date);
  let prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
  let nextDate = currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;
  let selectedMonth = date.substring(0, 7);

  // ── TEMPO ROUTING ──
  if (currentDataProduct === "tempo") {
      // Range mode
      if (TIME_SCALE === "range") {
          if (displayMode === "community") {
              loadTempoCommunityDateRange();
          } else {
              loadTempoDateRange();
          }
          return;
      }

      // Daily mode
      if (TIME_SCALE === "daily") {
          if (displayMode === "community") {
              loadTempoDailyCommunities(date);
          } else {
              loadDailyTempo(date);
          }
          return;
      }

      // Monthly mode
      if (TIME_SCALE === "monthly") {
          if (displayMode === "community") {
              loadTempoMonthlyCommunities(selectedMonth);
          } else {
              loadMonthlyTempo(selectedMonth);
          }
          return;
      }

      // Hourly mode – use cached or fetch
      if (TIME_SCALE === "hourly" && cachedDate === date && cachedHourBuckets) {
          if (displayMode === "community") {
              drawTempoCommunityAreas(cachedFeatures);
          } else {
              renderTempoFeatures(cachedHourBuckets[selectedHour], date);
          }
          return;
      }

      // Fetch TEMPO hourly data
      let tRequests = [];
      if (prevDate) {
          tRequests.push(
              fetch(`/data/tempo/${prevDate}.geojson`)
                  .then(r => r.ok ? r.json() : null)
          );
      }
      tRequests.push(
          fetch(`/data/tempo/${date}.geojson`)
              .then(r => r.ok ? r.json() : null)
      );
      if (nextDate) {
          tRequests.push(
              fetch(`/data/tempo/${nextDate}.geojson`)
                  .then(r => r.ok ? r.json() : null)
          );
      }

      Promise.all(tRequests).then(files => {
          let combinedFeatures = [];
          files.forEach(data => {
              if (data) combinedFeatures.push(...data.features);
          });

          let filteredFeatures = combinedFeatures.filter(f => {
              let utcDate = new Date(f.properties.time + "Z");
              let chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
              let y = chicagoParts.find(p => p.type === "year").value;
              let m = chicagoParts.find(p => p.type === "month").value.padStart(2, '0');
              let d = chicagoParts.find(p => p.type === "day").value.padStart(2, '0');
              let chicagoDateStr = `${y}-${m}-${d}`;

              f._chicagoHour = Number(
                  chicagoHourFormatter.formatToParts(utcDate)
                      .find(x => x.type === "hour").value
              );
              return chicagoDateStr === date;
          });

          cachedDate = date;
          cachedFeatures = filteredFeatures;
          cachedHourBuckets = buildHourBuckets(filteredFeatures);
          prefetchTempoNextDay(date);

          let hasValidData = filteredFeatures.some(f => {
              let val = parseFloat(f.properties.vertical_column_troposphere);
              return !isNaN(val);
          });

          if (!hasValidData) {
              console.warn("No valid TEMPO data for", date);
              hideLoading();
              return;
          }

          if (displayMode === "community") {
              drawTempoCommunityAreas(filteredFeatures);
          } else if (TIME_SCALE === "hourly") {
              renderTempoFeatures(cachedHourBuckets[selectedHour], date);
          } else {
              renderTempoFeatures(filteredFeatures, date);
          }
      });

      return;
  }

  // ── CLARITY (Open Air) ROUTING (existing behavior) ──
  if (TIME_SCALE === "range") {
      loadDateRange();
      return;
  }

  if (TIME_SCALE === "daily") {
      if (displayMode === "sensor") {
          loadDailySensors(date);
          return;
      }
      if (displayMode === "community") {
          loadDailyCommunities(date);
          return;
      }
  }

  if (TIME_SCALE === "monthly") {
      if (displayMode === "sensor") {
          loadMonthlySensors(selectedMonth);
          return;
      }
      if (displayMode === "community") {
          loadMonthlyCommunities(selectedMonth);
          return;
      }
  }

  if (TIME_SCALE === "hourly" && cachedDate === date && cachedHourBuckets) {
      renderFeatures(cachedHourBuckets[selectedHour], date);
      return;
  }

  let requests = [];
  if (prevDate) {
      requests.push(
          fetch(`/data/clarity/${prevDate}.geojson`)
              .then(r => r.ok ? r.json() : null)
      );
  }

  requests.push(
      fetch(`/data/clarity/${date}.geojson`)
          .then(r => r.ok ? r.json() : null)
  );

  if (nextDate) {
      requests.push(
          fetch(`/data/clarity/${nextDate}.geojson`)
              .then(r => r.ok ? r.json() : null)
      );
  }

  let loadPromise = Promise.all(requests);

  loadPromise.then(files => {
      let combinedFeatures = [];
      files.forEach(data => {
          if (data) {
              combinedFeatures.push(...data.features);
          }
      });

      let filteredFeatures = combinedFeatures.filter(f => {
          let utcDate = new Date(f.properties.time + "Z");
          let chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
          let y = chicagoParts.find(p => p.type === "year").value;
          let m = chicagoParts.find(p => p.type === "month").value.padStart(2, '0');
          let d = chicagoParts.find(p => p.type === "day").value.padStart(2, '0');
          let chicagoDateStr = `${y}-${m}-${d}`;

          f._chicagoHour = Number(
              chicagoHourFormatter.formatToParts(utcDate)
                  .find(x => x.type === "hour").value
          );

          return chicagoDateStr === date;
      });

      cachedDate = date;
      cachedFeatures = filteredFeatures;
      cachedHourBuckets = buildHourBuckets(filteredFeatures);
      prefetchNextDay(date);

      let hasValidData = filteredFeatures.some(f => {
          let val = parseFloat(f.properties.no2concindividual_value);
          return !isNaN(val);
      });

      if (!hasValidData) {
          console.warn("No valid data for", date);
          return;
      }

      if (TIME_SCALE === "hourly") {
          renderFeatures(cachedHourBuckets[selectedHour], date);
      } else {
          renderFeatures(filteredFeatures, date);
      }
  });
}

// ── TEMPO COMMUNITY AREAS (hourly) ──────────────────────────────────────────────
// Aggregates TEMPO grid cell values into Chicago community areas
function drawTempoCommunityAreas(filteredFeatures) {
  if (!communityData) {
      console.warn("Community data not loaded");
      return;
  }

  let stats = {};
  communityData.features.forEach(poly => {
      let props = poly.properties;
      let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
      stats[name] = { sum: 0, count: 0 };
  });

  filteredFeatures.forEach(f => {
      let p = f.properties;
      let value = parseFloat(p.vertical_column_troposphere);
      if (isNaN(value)) return;
      let hour = f._chicagoHour;

      if (TIME_SCALE === "hourly" && hour !== selectedHour) return;

      // TEMPO grid cells use geometry coordinates
      let coords = f.geometry.coordinates;
      let lon, lat;
      if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
          // Use centroid – take first ring first coordinate as approximation
          let rings = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates[0] : f.geometry.coordinates;
          let ring = rings[0];
          lon = ring[0][0];
          lat = ring[0][1];
      } else {
          lon = coords[0];
          lat = coords[1];
      }

      let point = turf.point([lon, lat]);

      communityData.features.forEach(poly => {
          if (turf.booleanPointInPolygon(point, poly)) {
              let props = poly.properties;
              let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
              stats[name].sum += value;
              stats[name].count += 1;
          }
      });
  });

  if (communityLayer) {
      map.removeLayer(communityLayer);
  }

  communityLayer = L.geoJSON(communityData, {
      style: function(feature) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
          let avg = null;
          if (stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          return {
              color: "#222",
              weight: 1,
              fillColor: getColorTempo(avg),
              fillOpacity: avg === null ? 0 : 0.65
          };
      },
      onEachFeature: function(feature, layer) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name || "Unknown";
          let avg = null;
          if (stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          layer.bindTooltip(`
              <b>${name}</b><br>
              Avg NO₂: ${avg === null ? "No Data" : avg.toExponential(2)}<br>
              Measurements: ${stats[name].count}
          `);
      }
  });

  communityLayer.addTo(map);
  hideLoading();
}

// ── SLIDER EVENT HOOKS (from V4) ──────────────────────────────────────────────────

setTimeout(() => {
  var dateSlider = document.getElementById("dateSlider");
  var dateLabel = document.getElementById("dateLabel");

  var timeSlider = document.getElementById("timeSlider");
  var timeLabel = document.getElementById("timeLabel");

  var playBtn = document.getElementById("playBtn");
  var pauseBtn = document.getElementById("pauseBtn");

  var startDateInput = document.getElementById("startDate");
  var endDateInput = document.getElementById("endDate");

  // Display mode radio buttons
  document.querySelectorAll('input[name="displayMode"]').forEach(el => {
      el.addEventListener("change", function() {
          displayMode = this.value;
          console.log("Display Mode:", displayMode);

          if (currentLayer) {
              map.removeLayer(currentLayer);
              currentLayer = null;
          }
          if (communityLayer) {
              map.removeLayer(communityLayer);
              communityLayer = null;
          }
          refreshMap();
      });
  });

  // Aggregation (TIME_SCALE) radio buttons
  document.querySelectorAll('input[name="TIME_SCALE"]').forEach(el => {
      el.addEventListener("change", function() {
          const newType = this.value;

          // Update sidebar buttons to stay in sync
          selectMapType(newType);

          changeAggregation(newType);
      });
  });

  // Date slider
  dateSlider.addEventListener("input", function () {
      let index = Number(this.value);

      if (TIME_SCALE === "range") {
          rangeCurrentEndDate = rangeDates[index];
          dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`;
          loadDateRange();
          return;
      }

      let date = dates[index];
      if (!date) {
          console.warn("Date slider: no date at index", index);
          return;
      }
      if (TIME_SCALE === "monthly") {
          dateLabel.innerHTML = formatMonthForDisplay(date);
      } else {
          dateLabel.innerHTML = utcDateToCentralPretty(date);
      }
      loadDate(date);
  });

  // Time slider
  timeSlider.addEventListener("input", function () {
      selectedHour = Number(this.value);
      let baseDate = dates[Number(dateSlider.value)];
      let formattedTime = formatHourForDisplay(baseDate, selectedHour);
      timeLabel.innerHTML = `Time: ${formattedTime}`;
      loadDate(baseDate);
  });

  // Start date input
  startDateInput.addEventListener("change", function() {
      rangeStartDate = this.value;
      rangeCurrentEndDate = rangeEndDate;
      rangeDates = dates.filter(d => d >= rangeStartDate && d <= rangeEndDate);
      dateSlider.min = 0;
      dateSlider.max = Math.max(0, rangeDates.length - 1);
      dateSlider.value = 0;
      if (TIME_SCALE === "range") {
          loadDateRange();
      }
  });

  // End date input
  endDateInput.addEventListener("change", function() {
      rangeEndDate = this.value;
      rangeCurrentEndDate = rangeEndDate;
      rangeDates = dates.filter(d => d >= rangeStartDate && d <= rangeEndDate);
      dateSlider.min = 0;
      dateSlider.max = Math.max(0, rangeDates.length - 1);
      dateSlider.value = 0;
      if (TIME_SCALE === "range") {
          loadDateRange();
      }
  });

  // Play button
  playBtn.addEventListener("click", () => {
      if (timeInterval) return;

      if (TIME_SCALE === "range") {
          rangeCurrentEndDate = rangeStartDate;
          dateSlider.value = 0;
          dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`;
          loadDateRange();
      }

      timeInterval = setInterval(() => {
          if (TIME_SCALE === "hourly") {
              selectedHour++;
              if (selectedHour > 23) {
                  let currentIndex = Number(dateSlider.value);
                  if (currentIndex === dates.length - 1) {
                      clearInterval(timeInterval);
                      timeInterval = null;
                      return;
                  }
                  selectedHour = 0;
                  currentIndex++;
                  dateSlider.value = currentIndex;
                  let date = dates[currentIndex];

                  if (nextCachedDate === date) {
                      cachedDate = nextCachedDate;
                      cachedHourBuckets = nextCachedHourBuckets;
                      console.log("Using precache:", date);
                      dateLabel.innerHTML = utcDateToCentralPretty(date);
                      timeSlider.value = 0;
                      timeLabel.innerHTML = `Time: ${formatHourForDisplay(date, 0)}`;
                      renderFeatures(cachedHourBuckets[0], date);
                      return;
                  }

                  dateLabel.innerHTML = utcDateToCentralPretty(date);
              }
              timeSlider.value = selectedHour;
              let baseDate = dates[Number(dateSlider.value)];
              timeLabel.innerHTML = `Time: ${formatHourForDisplay(baseDate, selectedHour)}`;
              loadDate(baseDate);
          }
          else if (TIME_SCALE === "range") {
              let endIndex = dates.indexOf(rangeCurrentEndDate);
              let finalIndex = dates.indexOf(rangeEndDate);
              if (rangeCurrentEndDate === null) {
                  rangeCurrentEndDate = rangeStartDate;
                  loadDateRange();
                  return;
              }
              endIndex++;
              if (endIndex > finalIndex) {
                  clearInterval(timeInterval);
                  timeInterval = null;
                  return;
              }
              rangeCurrentEndDate = dates[endIndex];
              let rangePosition = rangeDates.indexOf(rangeCurrentEndDate);
              dateSlider.value = rangePosition;
              endDateInput.value = rangeCurrentEndDate;
              dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`;
              loadDateRange();
          }
          else if (TIME_SCALE === "daily") {
              let currentIndex = Number(dateSlider.value);
              currentIndex++;
              if (currentIndex >= dates.length) {
                  clearInterval(timeInterval);
                  timeInterval = null;
                  return;
              }
              dateSlider.value = currentIndex;
              let date = dates[currentIndex];
              dateLabel.innerHTML = utcDateToCentralPretty(date);
              loadDate(date);
          }
          else if (TIME_SCALE === "monthly") {
              let currentMonth = dates[Number(dateSlider.value)].substring(0, 7);
              let nextIndex = Number(dateSlider.value);
              do {
                  nextIndex++;
                  if (nextIndex >= dates.length) {
                      clearInterval(timeInterval);
                      timeInterval = null;
                      return;
                  }
              } while (dates[nextIndex].substring(0, 7) === currentMonth && nextIndex !== Number(dateSlider.value));
              dateSlider.value = nextIndex;
              let date = dates[nextIndex];
              dateLabel.innerHTML = formatMonthForDisplay(date);
              loadDate(date);
          }
      }, 750);
  });

  // Pause button
  pauseBtn.addEventListener("click", () => {
      clearInterval(timeInterval);
      timeInterval = null;
  });

  // ── PAGE LOAD: Sync displayMode with sidebar radio defaults ──
  // The sidebar's "Spatial Scale" section has displayMode radios (sensor/community).
  // The sidebar's "Data Products" section has dataProduct radios (tempo/openaq/fusion).
  // On page load we must read the checked radio for dataProduct and set displayMode accordingly
  // so that the JS state matches what the user sees in the sidebar.
  const checkedDataProduct = document.querySelector('input[name="dataProduct"]:checked');
  if (checkedDataProduct) {
      const product = checkedDataProduct.value;
      if (product === "tempo") {
          currentDataProduct = "tempo";
          displayMode = "grid";  // TEMPO uses grid cells
      } else if (product === "openaq" || product === "clarity") {
          currentDataProduct = "clarity";
          displayMode = "sensor";
      } else if (product === "fusion") {
          currentDataProduct = "fusion";
          displayMode = "sensor";
      }
  }

  // Sync the displayMode radio buttons to match the current displayMode
  document.querySelectorAll('input[name="displayMode"]').forEach(radio => {
      radio.checked = (radio.value === displayMode);
  });

  // Update the legend to match the default data product
  updateLegend();

  // Load community areas using map.html's static path
  loadCommunityAreas();
  loadChicagoBorder();

  // ── SIDEBAR LOAD BUTTONS: filter date slider based on user date input ─────

  // allDates is a global, already kept in sync by loadTempoDates / loadClarityDates / loadFusionDates

  // Single-date Load (hourly view)
  const loadSingleDateBtn = document.getElementById('load-single-date');
  if (loadSingleDateBtn) {
      loadSingleDateBtn.addEventListener('click', function() {
          const selectedDate = document.getElementById('map-date').value;
          if (!selectedDate) {
              showToast('Please select a date first.', 'warning');
              return;
          }
          // Check if the selected date exists in the available dates
          const index = dates.indexOf(selectedDate);
          if (index === -1) {
              showToast(`No data available for ${selectedDate}.`, 'warning');
              return;
          }
          // Move the date slider to that date and load it
          dateSlider.value = index;
          dateLabel.innerHTML = utcDateToCentralPretty(selectedDate);
          loadDate(selectedDate);
          showToast(`Loaded ${selectedDate}`);
      });
  }

  // Date-range Load (daily view)
  const loadDateRangeBtn = document.getElementById('load-date-range');
  if (loadDateRangeBtn) {
      loadDateRangeBtn.addEventListener('click', function() {
          const startDate = document.getElementById('date-range-start').value;
          const endDate = document.getElementById('date-range-end').value;
          if (!startDate || !endDate) {
              showToast('Please select both a start and end date.', 'warning');
              return;
          }
          if (startDate > endDate) {
              showToast('Start date must be before end date.', 'warning');
              return;
          }
          // Filter the full dates array to the selected range
          const filteredDates = allDates.filter(d => d >= startDate && d <= endDate);
          if (filteredDates.length === 0) {
              showToast(`No data available between ${startDate} and ${endDate}.`, 'warning');
              return;
          }
          // Replace dates with filtered subset so slider & play button use it
          dates = filteredDates;
          rangeDates = filteredDates;
          rangeStartDate = startDate;
          rangeEndDate = endDate;
          rangeCurrentEndDate = rangeEndDate;
          dateSlider.min = 0;
          dateSlider.max = filteredDates.length - 1;
          dateSlider.value = 0;
          dateLabel.innerHTML = utcDateToCentralPretty(filteredDates[0]);
          loadDate(filteredDates[0]);
          showToast(`Loaded ${filteredDates.length} days from ${startDate} to ${endDate}`);
      });
  }

  // Month-range Load (monthly view)
  const loadMonthRangeBtn = document.getElementById('load-month-range');
  if (loadMonthRangeBtn) {
      loadMonthRangeBtn.addEventListener('click', function() {
          const startMonth = document.getElementById('month-range-start').value;
          const endMonth = document.getElementById('month-range-end').value;
          if (!startMonth || !endMonth) {
              showToast('Please select both a start and end month.', 'warning');
              return;
          }
          if (startMonth > endMonth) {
              showToast('Start month must be before end month.', 'warning');
              return;
          }
          // Filter the full dates array to the selected month range
          const endMonthInclusive = endMonth + '-31'; // include all days in end month
          const filteredDates = allDates.filter(d => d >= startMonth && d <= endMonthInclusive);
          if (filteredDates.length === 0) {
              showToast(`No data available between ${startMonth} and ${endMonth}.`, 'warning');
              return;
          }
          // Replace dates with filtered subset so slider & play button use it
          dates = filteredDates;
          rangeDates = filteredDates;
          rangeStartDate = startMonth;
          rangeEndDate = endMonth;
          dateSlider.min = 0;
          dateSlider.max = filteredDates.length - 1;
          dateSlider.value = 0;
          dateLabel.innerHTML = formatMonthForDisplay(filteredDates[0]);
          loadDate(filteredDates[0]);
          showToast(`Loaded ${filteredDates.length} days from ${startMonth} to ${endMonth}`);
      });
  }

  // Load dates — use proper date loader based on current product
  if (currentDataProduct === "tempo") {
      loadTempoDates();
  } else if (currentDataProduct === "fusion") {
      loadFusionDates();
  } else {
      loadClarityDates();
  }

}, 100);

// ── TOAST NOTIFICATION (used by data-product switch) ────────────────────────
function showToast(message, level) {
    level = level || "info"; // "info", "warning", "error"
    console.log("[Toast]", message);

    // Create a visible toast notification on the map
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) return;

    // Remove existing toasts
    document.querySelectorAll('.map-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'map-toast';
    toast.style.position = 'absolute';
    toast.style.top = '10px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '6px';
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '13px';
    toast.style.zIndex = '2000';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
    toast.style.maxWidth = '90%';
    toast.style.textAlign = 'center';
    toast.style.pointerEvents = 'none';

    if (level === "warning") {
        toast.style.background = '#fff3cd';
        toast.style.color = '#856404';
        toast.style.border = '1px solid #ffc107';
    } else if (level === "error") {
        toast.style.background = '#f8d7da';
        toast.style.color = '#721c24';
        toast.style.border = '1px solid #f5c6cb';
    } else {
        toast.style.background = '#d1ecf1';
        toast.style.color = '#0c5460';
        toast.style.border = '1px solid #bee5eb';
    }

    toast.textContent = message;
    mapContainer.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}
window.showToast = showToast;

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
      console.log("Data Product Changed to:", selected);

      // Remove all data layers first
      map.removeLayer(tempoLayerGroup);
      map.removeLayer(openaqLayerGroup);
      map.removeLayer(fusionLayerGroup);


      // Switch currentDataProduct and reload data
      if (selected === "tempo") {
          currentDataProduct = "tempo";
          displayMode = "grid";  // TEMPO uses grid cells, not point sensors

          // Sync Spatial Scale radio buttons: uncheck both since TEMPO uses "grid" internally
          // The "Individual Sensors" option is closest to grid view, so check it visually
          document.querySelectorAll('input[name="displayMode"]').forEach(r => {
              r.checked = (r.value === "sensor");
          });

          // Update legend for TEMPO scale
          updateLegend();

          // Load TEMPO dates
          loadTempoDates();

          showToast("TEMPO data product selected");

      } else if (selected === "openaq" || selected === "clarity") {
          currentDataProduct = "clarity";
          displayMode = "sensor";

          // Sync Spatial Scale radio buttons
          document.querySelectorAll('input[name="displayMode"]').forEach(r => {
              r.checked = (r.value === "sensor");
          });

          // Update legend for Clarity scale
          updateLegend();

          // Reload Clarity dates and data
          loadClarityDates();

          showToast("Open Air Chicago (Clarity) data product selected");

      } else if (selected === "fusion") {
          // Fusion is a separate dataset with its own files and rendering
          currentDataProduct = "fusion";
          displayMode = "sensor";

          // Sync Spatial Scale radio buttons
          document.querySelectorAll('input[name="displayMode"]').forEach(r => {
              r.checked = (r.value === "sensor");
          });

          // Update legend for Fusion scale
          updateLegend();

          // Load Fusion dates and data
          loadFusionDates();

          showToast("Fusion data product selected");
      }

      // Clear ALL existing layers and reload current view
      if (currentLayer) {
          map.removeLayer(currentLayer);
          currentLayer = null;
      }
      if (communityLayer) {
          map.removeLayer(communityLayer);
          communityLayer = null;
      }

      // Clear caches when switching data products
      cachedDate = null;
      cachedFeatures = null;
      cachedHourBuckets = null;
      nextCachedDate = null;
      nextCachedHourBuckets = null;
  });
  });

  // ── UPDATE LEGEND based on current data product ──────────────────────────────
  function updateLegend() {
      const legendOverlay = document.getElementById('map-legend-overlay');
      if (!legendOverlay) return;

      const legendTitle = legendOverlay.querySelector('.legend-title');
      const legendNumbers = legendOverlay.querySelectorAll('.legend-numbers span');

      if (currentDataProduct === "tempo") {
          legendTitle.textContent = "NO₂ Column (molecules/cm²)";
          legendNumbers[0].textContent = TEMPO_GLOBAL_MIN.toExponential(0);
          legendNumbers[1].textContent = (((TEMPO_GLOBAL_MIN + TEMPO_GLOBAL_MAX) / 2)).toExponential(0);
          legendNumbers[2].textContent = TEMPO_GLOBAL_MAX.toExponential(0);
      } else if (currentDataProduct === "fusion") {
          legendTitle.textContent = "NO₂ (ppb)";
          legendNumbers[0].textContent = FUSION_GLOBAL_MIN;
          legendNumbers[1].textContent = Math.round((FUSION_GLOBAL_MIN + FUSION_GLOBAL_MAX) / 2);
          legendNumbers[2].textContent = FUSION_GLOBAL_MAX;
      } else {
          legendTitle.textContent = "NO₂ (ppb)";
          legendNumbers[0].textContent = CLARITY_GLOBAL_MIN;
          legendNumbers[1].textContent = Math.round((CLARITY_GLOBAL_MIN + CLARITY_GLOBAL_MAX) / 2);
          legendNumbers[2].textContent = CLARITY_GLOBAL_MAX;
      }
  }

  // ── LOAD TEMPO DATES ──────────────────────────────────────────────────────
  function loadTempoDates() {
      // Try loading TEMPO hourly dates first, fall back to daily dates
      // Use absolute URLs (leading /) so they work from any map view (hourly/daily/monthly)
      fetch("/data/tempo/TEMPOdates.json")
          .then(r => {
              if (!r.ok) return fetch("/data/tempo/TEMPOdaily_dates.json");
              return r.json();
          })
          .then(loadedDates => {
              if (!loadedDates || !Array.isArray(loadedDates) || loadedDates.length === 0) {
                  console.warn("TEMPO dates file empty or invalid, generating from clarity dates.");
                  loadClarityDates();
                  return;
              }
              dates = loadedDates;
              allDates = loadedDates;
              rangeStartDate = dates[0];
              rangeEndDate = dates[dates.length - 1];
              rangeCurrentEndDate = rangeEndDate;

              var dateSlider = document.getElementById("dateSlider");
              var dateLabel = document.getElementById("dateLabel");
              var startDateInput = document.getElementById("startDate");
              var endDateInput = document.getElementById("endDate");

              if (startDateInput) startDateInput.value = rangeStartDate;
              if (endDateInput) endDateInput.value = rangeEndDate;

              dateSlider.max = dates.length - 1;
              dateSlider.value = 0;

              if (TIME_SCALE === "monthly" && dateLabel) {
                  dateLabel.innerHTML = formatMonthForDisplay(dates[0]);
              } else if (dateLabel) {
                  dateLabel.innerHTML = utcDateToCentralPretty(dates[0]);
              }

              if (TIME_SCALE === "hourly") {
                  var timeLabel = document.getElementById("timeLabel");
                  if (timeLabel) timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;
              }

              loadDate(dates[0]);
          })
          .catch(err => {
              console.error("Could not load TEMPO dates:", err);
          });
  }

  // ── LOAD CLARITY DATES ────────────────────────────────────────────────────
  function loadClarityDates() {
      // Use absolute URL so it works from /map/hourly/, /map/daily/, /map/monthly/
      fetch("/api/clarity-dates/")
          .then(r => r.json())
          .then(response => {
              // Handle both array and {dates: [...]} formats
              let loadedDates = Array.isArray(response) ? response : (response.dates || []);
              if (!loadedDates || loadedDates.length === 0) {
                  console.warn("No Clarity dates found in API response, generating from clarity files.");
                  // Fallback: scan clarity directory for available dates
                  loadedDates = generateClarityDatesFromFiles();
              }
              dates = loadedDates;
              allDates = loadedDates;
              rangeStartDate = dates[0];
              rangeEndDate = dates[dates.length - 1];
              rangeCurrentEndDate = rangeEndDate;

              var dateSlider = document.getElementById("dateSlider");
              var dateLabel = document.getElementById("dateLabel");
              var startDateInput = document.getElementById("startDate");
              var endDateInput = document.getElementById("endDate");

              if (startDateInput) startDateInput.value = rangeStartDate;
              if (endDateInput) endDateInput.value = rangeEndDate;

              dateSlider.max = dates.length - 1;
              dateSlider.value = 0;

              if (TIME_SCALE === "monthly") {
                  if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(dates[0]);
              } else {
                  if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(dates[0]);
              }

              var timeLabel = document.getElementById("timeLabel");
              if (timeLabel) timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;

              loadDate(dates[0]);
          })
          .catch(err => {
              console.error("Could not load Clarity dates.json:", err);
              // Fallback: generate dates from available clarity files
              dates = generateClarityDatesFromFiles();
              allDates = dates;
              if (dates.length > 0) {
                  rangeStartDate = dates[0];
                  rangeEndDate = dates[dates.length - 1];
                  rangeCurrentEndDate = rangeEndDate;
                  var dateSlider = document.getElementById("dateSlider");
                  dateSlider.max = dates.length - 1;
                  dateSlider.value = 0;
                  loadDate(dates[0]);
              }
          });
  }

  // ── GENERATE CLARITY DATES FROM AVAILABLE FILES (fallback) ─────────────
  function generateClarityDatesFromFiles() {
      // Build dates from the clarity geojson files we know exist (2025-09 through 2026-03)
      // This is a fallback when dates.json API is not available
      const fallbackDates = [];
      const start = new Date(2025, 8, 1); // Sept 2025
      const end = new Date(2026, 3, 31);  // April 2026
      const current = new Date(start);
      while (current <= end) {
          fallbackDates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
      }
      console.log("Using fallback date range:", fallbackDates[0], "to", fallbackDates[fallbackDates.length - 1]);
      return fallbackDates;
  }

  // ── LOAD FUSION DATES ────────────────────────────────────────────────────
  function loadFusionDates() {
      // Use absolute URL so it works from any map view
      fetch("/data/fused/dates.json")
          .then(r => {
              if (!r.ok) {
                  console.warn("Fusion dates.json not found.");
                  // Show notification that Fusion has no data
                  showToast(
                      "Fusion data product is not yet available. No dates or data points exist for this product.",
                      "warning"
                  );
                  // Clear the map – do NOT silently fall back to Clarity
                  dates = [];
                  rangeStartDate = null;
                  rangeEndDate = null;
                  rangeCurrentEndDate = null;

                  var dateSlider = document.getElementById("dateSlider");
                  var dateLabel = document.getElementById("dateLabel");
                  if (dateSlider) {
                      dateSlider.max = 0;
                      dateSlider.value = 0;
                  }
                  if (dateLabel) dateLabel.innerHTML = "No Fusion Data Available";

                  // Clear any existing layers
                  if (currentLayer) {
                      map.removeLayer(currentLayer);
                      currentLayer = null;
                  }
                  if (communityLayer) {
                      map.removeLayer(communityLayer);
                      communityLayer = null;
                  }
                  hideLoading();
                  return null;
              }
              return r.json();
          })
          .then(loadedDates => {
              if (!loadedDates) return; // Already handled the "no file" case above
              // Handle both array and {dates: [...]} formats
              allDates = Array.isArray(loadedDates) ? loadedDates : (loadedDates.dates || loadedDates);
              dates = allDates;
              if (!dates || dates.length === 0) {
                  console.warn("No Fusion dates found in dates.json.");
                  showToast(
                      "Fusion data product has no dates or data points available yet.",
                      "warning"
                  );
                  // Clear slider and layers
                  var dateSlider = document.getElementById("dateSlider");
                  var dateLabel = document.getElementById("dateLabel");
                  if (dateSlider) {
                      dateSlider.max = 0;
                      dateSlider.value = 0;
                  }
                  if (dateLabel) dateLabel.innerHTML = "No Fusion Data Available";
                  if (currentLayer) {
                      map.removeLayer(currentLayer);
                      currentLayer = null;
                  }
                  if (communityLayer) {
                      map.removeLayer(communityLayer);
                      communityLayer = null;
                  }
                  hideLoading();
                  return;
              }
              rangeStartDate = dates[0];
              rangeEndDate = dates[dates.length - 1];
              rangeCurrentEndDate = rangeEndDate;

              var dateSlider = document.getElementById("dateSlider");
              var dateLabel = document.getElementById("dateLabel");
              var startDateInput = document.getElementById("startDate");
              var endDateInput = document.getElementById("endDate");

              if (startDateInput) startDateInput.value = rangeStartDate;
              if (endDateInput) endDateInput.value = rangeEndDate;

              dateSlider.max = dates.length - 1;
              dateSlider.value = 0;

              if (TIME_SCALE === "monthly") {
                  if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(dates[0]);
              } else {
                  if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(dates[0]);
              }

              var timeLabel = document.getElementById("timeLabel");
              if (timeLabel) timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;

              loadDate(dates[0]);
          })
          .catch(err => {
              console.error("Could not load Fusion dates:", err);
              showToast(
                  "Fusion data product is not yet available. No dates or data points exist for this product.",
                  "warning"
              );
              dates = [];
              var dateSlider = document.getElementById("dateSlider");
              var dateLabel = document.getElementById("dateLabel");
              if (dateSlider) {
                  dateSlider.max = 0;
                  dateSlider.value = 0;
              }
              if (dateLabel) dateLabel.innerHTML = "No Fusion Data Available";
              if (currentLayer) {
                  map.removeLayer(currentLayer);
                  currentLayer = null;
              }
              hideLoading();
          });
  }

  // Helper: load Clarity dates and return a promise with the dates array
  function loadClarityDatesAndReturn() {
      return fetch("/api/clarity-dates/")
          .then(r => r.json())
          .then(response => {
              let loadedDates = Array.isArray(response) ? response : (response.dates || []);
              dates = loadedDates;
              rangeStartDate = dates[0];
              rangeEndDate = dates[dates.length - 1];
              rangeCurrentEndDate = rangeEndDate;

              var dateSlider = document.getElementById("dateSlider");
              var dateLabel = document.getElementById("dateLabel");
              var startDateInput = document.getElementById("startDate");
              var endDateInput = document.getElementById("endDate");

              if (startDateInput) startDateInput.value = rangeStartDate;
              if (endDateInput) endDateInput.value = rangeEndDate;

              dateSlider.max = dates.length - 1;
              dateSlider.value = 0;

              if (TIME_SCALE === "monthly") {
                  if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(dates[0]);
              } else {
                  if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(dates[0]);
              }

              var timeLabel = document.getElementById("timeLabel");
              if (timeLabel) timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;

              loadDate(dates[0]);
              return dates;
          })
          .catch(err => {
              console.error("Fallback Clarity dates also failed:", err);
              return [];
          });
  }

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

// ── OVERLAYS: prevent map from stealing pointer events ──────────────────────
// These overlays sit on top of the Leaflet map. Without disabling propagation,
// clicks / drags on them are also sent to the map, causing buttons to "freeze"
// or toggles to get stuck.
setTimeout(() => {
const bottomBar = document.getElementById('bottom-slider-bar');
if (bottomBar) {
  L.DomEvent.disableClickPropagation(bottomBar);
  L.DomEvent.disableScrollPropagation(bottomBar);
}

const explore = document.getElementById('explore-panel');
if (explore) {
  L.DomEvent.disableClickPropagation(explore);
  L.DomEvent.disableScrollPropagation(explore);
}
}, 0);