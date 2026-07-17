// ── TAB SWITCHING ──────────────────────────────────────────────────────────
function switchExportTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.export-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('.export-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById('tab-' + tab).classList.add('active');

  // Show/hide preview panels
  const mapContainer = document.getElementById('map-preview-container');
  const dataContainer = document.getElementById('data-preview-container');

  if (tab === 'pdf') {
    mapContainer.style.display = 'block';
    dataContainer.style.display = 'none';
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  } else {
    mapContainer.style.display = 'none';
    dataContainer.style.display = 'block';
    if (!gDataFilesLoaded) {
      loadDataFiles();
    }
  }
}

// ── DATA FILE EXPORT STATE ─────────────────────────────────────────────────
let currentDataSource = 'clarity';
let currentExportFormat = 'geojson';
let gDataFilesLoaded = false;
let availableFiles = [];

function selectDataSource(source) {
  currentDataSource = source;
  document.querySelectorAll('#tab-data .map-type-btn[data-source]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });
  gDataFilesLoaded = false;
  loadDataFiles();
}

function selectExportFormat(format) {
  currentExportFormat = format;
  document.querySelectorAll('#tab-data .map-type-btn[data-format]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === format);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function loadDataFiles() {
  const tbody = document.getElementById('file-list-body');
  tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Loading files...</td></tr>';
  gDataFilesLoaded = false;

  try {
    const fileType = document.getElementById('data-file-type').value;
    const dateFilter = document.getElementById('data-date-filter').value;

    let url = `/api/list-data-files/?source=${currentDataSource}`;
    if (fileType) url += `&type=${fileType}`;
    if (dateFilter) url += `&date=${dateFilter}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      showDataExportStatus(data.error, 'error');
      tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Error loading files</td></tr>';
      return;
    }

    availableFiles = data.files || [];
    gDataFilesLoaded = true;

    if (availableFiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">No files found for the selected filters</td></tr>';
      showDataExportStatus('No files available.', 'info');
    } else {
      renderFileList(availableFiles);
      showDataExportStatus(`${availableFiles.length} files available.`, 'success');
    }

    document.getElementById('file-count-badge').textContent = `${availableFiles.length} files`;

  } catch (error) {
    console.error('Error loading files:', error);
    showDataExportStatus('Failed to load files.', 'error');
    tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Failed to load files</td></tr>';
  }
}

function renderFileList(files) {
  const tbody = document.getElementById('file-list-body');
  tbody.innerHTML = '';

  files.forEach((file, index) => {
    const tr = document.createElement('tr');
    const extClass = file.ext === 'geojson' ? 'geojson' : 'json';

    tr.innerHTML = `
      <td><input type="checkbox" class="file-checkbox" data-index="${index}" data-filename="${file.filename}" onchange="updateSelectionCount()" /></td>
      <td class="file-name-cell">${file.filename}</td>
      <td><span class="file-type-badge ${extClass}">${file.ext}</span></td>
      <td class="file-size-cell">${formatFileSize(file.size)}</td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectionCount();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('select-all-files').checked;
  document.querySelectorAll('.file-checkbox').forEach(cb => {
    cb.checked = selectAll;
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  const checked = document.querySelectorAll('.file-checkbox:checked').length;
  const total = document.querySelectorAll('.file-checkbox').length;
  const selectAll = document.getElementById('select-all-files');
  selectAll.checked = checked === total && total > 0;
  selectAll.indeterminate = checked > 0 && checked < total;
}

function getSelectedFiles() {
  const selected = [];
  document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
    selected.push(cb.dataset.filename);
  });
  return selected;
}

async function exportSelectedFiles() {
  const selectedFiles = getSelectedFiles();
  const exportBtn = document.getElementById('data-export-btn');

  if (selectedFiles.length === 0) {
    showDataExportStatus('Please select at least one file to export.', 'error');
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  showDataExportStatus(`Preparing ${selectedFiles.length} file(s) for download...`, 'info');

  for (let i = 0; i < selectedFiles.length; i++) {
    const filename = selectedFiles[i];
    showDataExportStatus(`Downloading ${i + 1}/${selectedFiles.length}: ${filename}`, 'info');

    const downloadUrl = `/api/export-data-file/?source=${currentDataSource}&file=${encodeURIComponent(filename)}&format=${currentExportFormat}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (i < selectedFiles.length - 1) {
      await sleep(500);
    }
  }

  exportBtn.disabled = false;
  exportBtn.innerHTML = '&#10515; Download Selected';
  showDataExportStatus(`${selectedFiles.length} file(s) exported successfully!`, 'success');
}

function showDataExportStatus(message, type) {
  const el = document.getElementById('data-export-status');
  el.textContent = message;
  el.className = `export-status ${type}`;
}

// ── CONFIG (PDF Map Export) ────────────────────────────────────────────────
let currentMapType = 'hourly';
let currentDataProduct = 'clarity';  // 'tempo', 'clarity', 'fusion'
let currentAggregation = 'community'; // 'pixel', 'community', 'raw'

//

// ── MAP INIT ───────────────────────────────────────────────────────────────
const map = L.map('export-map', {
  center: [41.52, -87.37],
  zoom: 10,
  zoomControl: true,
  dragging: true
});

// ── CHICAGO BORDERS & COMMUNITIES LAYERS ───────────────────────────────────
let chicagoBorderLayer = null;
let chicagoCommunityLayer = null;

// Store layer toggle handlers so they work even if checkboxes change state
function setupLayerToggles() {
  const borderCheckbox = document.getElementById('include-border');
  const communityCheckbox = document.getElementById('include-communities');

  if (borderCheckbox) {
    borderCheckbox.addEventListener('change', function () {
      if (this.checked && chicagoBorderLayer) {
        chicagoBorderLayer.addTo(map);
      } else if (!this.checked && chicagoBorderLayer && map.hasLayer(chicagoBorderLayer)) {
        map.removeLayer(chicagoBorderLayer);
      }
    });
  }

  if (communityCheckbox) {
    communityCheckbox.addEventListener('change', function () {
      if (this.checked && chicagoCommunityLayer) {
        chicagoCommunityLayer.addTo(map);
      } else if (!this.checked && chicagoCommunityLayer && map.hasLayer(chicagoCommunityLayer)) {
        map.removeLayer(chicagoCommunityLayer);
      }
    });
  }
}

// Load Chicago boundary layer
fetch('/static/dashboard/layers/Chicago.geojson')
  .then(response => response.json())
  .then(data => {
    chicagoBorderLayer = L.geoJSON(data, {
      style: { color: "#000000", weight: 2 }
    });
    const borderCheckbox = document.getElementById('include-border');
    if (borderCheckbox && borderCheckbox.checked) {
      chicagoBorderLayer.addTo(map);
    }
  })
  .catch(err => console.error('Failed to load Chicago boundary:', err));

// Load Chicago community areas layer
fetch('/static/dashboard/layers/ChicagoCommunityAreas.geojson')
  .then(response => response.json())
  .then(data => {
    chicagoCommunityLayer = L.geoJSON(data, {
      style: { color: "#00000077", weight: 1 }
    });
    const communityCheckbox = document.getElementById('include-communities');
    if (communityCheckbox && communityCheckbox.checked) {
      chicagoCommunityLayer.addTo(map);
    }
  })
  .catch(err => console.error('Failed to load Chicago community areas:', err));

// ── MAP COORDS BAR ─────────────────────────────────────────────────────────
map.on('mousemove', e => {
  const coordsText = document.getElementById('coords-text');
  if (coordsText) {
    coordsText.textContent = `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
  }
});
map.on('zoomend', () => {
  const zoomText = document.getElementById('zoom-text');
  if (zoomText) {
    zoomText.textContent = `Zoom: ${map.getZoom()}`;
  }
});

// Initialize coords/zoom display
document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;

// ── BASEMAP ────────────────────────────────────────────────────────────────
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri',
  maxZoom: 19
}).addTo(map);

// ── LAYER GROUPS (one per data product) ────────────────────────────────────
const layerGroups = {
  tempo: L.layerGroup().addTo(map),
  clarity: L.layerGroup().addTo(map),
  fusion: L.layerGroup().addTo(map)
};

// ── NO2 COLOR SCALE ────────────────────────────────────────────────────────
function no2Color(value) {
  if (value == null || isNaN(value)) return '#cccccc';
  // Normalize: clamp 0-100 for color mapping
  const v = Math.max(0, Math.min(100, value));
  if (v < 25) return '#0000ff';     // blue
  if (v < 50) return '#00ff00';     // green
  if (v < 75) return '#ffff00';     // yellow
  return '#ff0000';                  // red
}

// ── BUILD FILE URL FOR GIVEN PRODUCT / SCALE / AGGREGATION ─────────────────
// File naming conventions (from backend _scan_data_files):
//   clarity:
//     daily community -> daily_community_{YYYY-MM-DD}.geojson
//     daily sensor    -> daily_sensor_{YYYY-MM-DD}.geojson
//     daily raw       -> {YYYY-MM-DD}.geojson
//     monthly community -> monthly_community_{YYYY-MM}.geojson
//     monthly sensor    -> monthly_sensor_{YYYY-MM}.geojson
//   tempo:
//     daily community -> day_community_{YYYY-MM-DD}.geojson
//     daily pixel     -> day_{YYYY-MM-DD}.geojson
//     monthly pixel   -> month_{YYYY-MM}.geojson
//   fusion:
//     daily community -> daily_community_{YYYY-MM-DD}.geojson
//     daily pixel     -> daily_pixel_{YYYY-MM-DD}.geojson
//     monthly community -> monthly_community_{YYYY-MM}.geojson
//     monthly pixel     -> monthly_pixel_{YYYY-MM}.geojson

function buildFileUrl(product, timeScale, aggregation, dateOrMonth) {
  // dateOrMonth is "YYYY-MM-DD" for daily/hourly or "YYYY-MM" for monthly
  const date = dateOrMonth;

  if (product === 'clarity') {
    if (timeScale === 'hourly') {
      // Hourly uses daily raw files (hourly data is embedded in the daily file)
      return `/data/clarity/${date}.geojson`;
    }
    if (timeScale === 'daily') {
      if (aggregation === 'community') return `/data/clarity/daily_community_${date}.geojson`;
      if (aggregation === 'pixel') return `/data/clarity/daily_sensor_${date}.geojson`;
      if (aggregation === 'raw') return `/data/clarity/${date}.geojson`;
    }
    if (timeScale === 'monthly') {
      if (aggregation === 'community') return `/data/clarity/monthly_community_${date}.geojson`;
      if (aggregation === 'pixel') return `/data/clarity/monthly_sensor_${date}.geojson`;
      if (aggregation === 'raw') return `/data/clarity/monthly_sensor_${date}.geojson`;
    }
  }

  if (product === 'tempo') {
    if (timeScale === 'hourly') {
      // TEMPO hourly: use daily pixel file
      return `/data/tempo/day_${date}.geojson`;
    }
    if (timeScale === 'daily') {
      if (aggregation === 'community') return `/data/tempo/day_community_${date}.geojson`;
      if (aggregation === 'pixel') return `/data/tempo/day_${date}.geojson`;
      if (aggregation === 'raw') return `/data/tempo/day_${date}.geojson`;
    }
    if (timeScale === 'monthly') {
      if (aggregation === 'community') return `/data/tempo/month_${date}_community.geojson`;
      if (aggregation === 'pixel') return `/data/tempo/month_${date}.geojson`;
      if (aggregation === 'raw') return `/data/tempo/month_${date}.geojson`;
    }
  }

  if (product === 'fusion') {
    if (timeScale === 'hourly') {
      // Fusion hourly: use daily pixel file
      return `/data/fused/daily_pixel_${date}.geojson`;
    }
    if (timeScale === 'daily') {
      if (aggregation === 'community') return `/data/fused/daily_community_${date}.geojson`;
      if (aggregation === 'pixel') return `/data/fused/daily_pixel_${date}.geojson`;
      if (aggregation === 'raw') return `/data/fused/daily_pixel_${date}.geojson`;
    }
    if (timeScale === 'monthly') {
      if (aggregation === 'community') return `/data/fused/monthly_community_${date}.geojson`;
      if (aggregation === 'pixel') return `/data/fused/monthly_pixel_${date}.geojson`;
      if (aggregation === 'raw') return `/data/fused/monthly_pixel_${date}.geojson`;
    }
  }

  return null;
}

// ── EXTRACT NO2 VALUE FROM FEATURE ─────────────────────────────────────────
// Different data products may store the NO2 value in different property keys
function extractNo2Value(feature) {
  const p = feature.properties;
  // Common property names across products
  return p.value ?? p.NO2 ?? p.no2 ?? p.concentration ?? p.mean ?? null;
}

// ── LOAD DATA FOR MAP PREVIEW ──────────────────────────────────────────────
async function loadDataForMap(dateOrMonth, hour) {
  const url = buildFileUrl(currentDataProduct, currentMapType, currentAggregation, dateOrMonth);
  if (!url) {
    showStatus('No file mapping for selected configuration.', 'error');
    return;
  }

  // Clear all layer groups
  Object.values(layerGroups).forEach(g => g.clearLayers());

  try {
    showStatus(`Loading ${currentDataProduct} data...`, 'info');
    const response = await fetch(url);

    if (!response.ok) {
      showStatus(`No data available: ${response.status} ${response.statusText}`, 'info');
      return;
    }

    const data = await response.json();
    const features = data.features || [];

    if (!features.length) {
      showStatus('Data file loaded but contains no features.', 'info');
      return;
    }

    // Render features onto the appropriate layer group
    const group = layerGroups[currentDataProduct];
    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        const val = extractNo2Value(feature);
        return L.circleMarker(latlng, {
          radius: currentAggregation === 'community' ? 8 : 4,
          fillColor: no2Color(val),
          color: '#333',
          weight: 0.5,
          fillOpacity: 0.7
        });
      },
      style: function (feature) {
        // For polygon/community area features
        const val = extractNo2Value(feature);
        return {
          fillColor: no2Color(val),
          fillOpacity: 0.6,
          color: '#333',
          weight: 1
        };
      },
      onEachFeature: function (feature, layer) {
        const val = extractNo2Value(feature);
        const p = feature.properties;
        let popup = `<b>NO₂: ${val != null ? val.toFixed(4) : 'N/A'}</b><br>`;
        if (p.community || p.name) popup += `Area: ${p.community || p.name}<br>`;
        if (p.date) popup += `Date: ${p.date}<br>`;
        layer.bindPopup(popup);
      }
    }).addTo(group);

    showStatus(`Loaded ${features.length} features from ${currentDataProduct}.`, 'success');
  } catch (error) {
    console.error('Error loading map data:', error);
    showStatus(`Failed to load map data: ${error.message}`, 'error');
  }
}

// ── MAP TYPE SELECTION ─────────────────────────────────────────────────────
function selectMapType(type) {
  currentMapType = type;

  // Only update data-type buttons within #tab-pdf
  document.querySelectorAll('#tab-pdf .map-type-btn[data-type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Show/hide date controls based on map type
  const singleDateGroup = document.getElementById('single-date-group');
  const hourGroup = document.getElementById('hour-group');
  const dateRangeGroup = document.getElementById('date-range-group');
  const monthRangeGroup = document.getElementById('month-range-group');
  const dateSectionLabel = document.getElementById('date-section-label');

  if (type === 'hourly') {
    singleDateGroup.style.display = 'block';
    hourGroup.style.display = 'block';
    dateRangeGroup.style.display = 'none';
    monthRangeGroup.style.display = 'none';
    dateSectionLabel.textContent = 'Date';
  } else if (type === 'daily') {
    singleDateGroup.style.display = 'none';
    hourGroup.style.display = 'none';
    dateRangeGroup.style.display = 'block';
    monthRangeGroup.style.display = 'none';
    dateSectionLabel.textContent = 'Date Range';
  } else if (type === 'monthly') {
    singleDateGroup.style.display = 'none';
    hourGroup.style.display = 'none';
    dateRangeGroup.style.display = 'none';
    monthRangeGroup.style.display = 'block';
    dateSectionLabel.textContent = 'Month Range';
  }

  reloadMapData();
}

// ── RELOAD MAP DATA ────────────────────────────────────────────────────────
function reloadMapData() {
  let dateOrMonth;

  if (currentMapType === 'hourly') {
    dateOrMonth = document.getElementById('export-date').value;
  } else if (currentMapType === 'daily') {
    // Use end date of range for preview
    dateOrMonth = document.getElementById('date-range-end').value;
  } else if (currentMapType === 'monthly') {
    // Use end month of range for preview
    dateOrMonth = document.getElementById('month-range-end').value;
  }

  if (!dateOrMonth) {
    showStatus('Please select a valid date/month.', 'error');
    return;
  }

  // Update map view
  const lat = parseFloat(document.getElementById('export-lat').value);
  const lng = parseFloat(document.getElementById('export-lng').value);
  const zoom = parseInt(document.getElementById('export-zoom').value);
  map.flyTo([lat, lng], zoom);

  // Load data
  loadDataForMap(dateOrMonth, null);
}

// ── HELPER: Generate metadata lines for a given date/month ─────────────────
function getMetadataLines(dateStr, label) {
  const productLabels = { tempo: 'TEMPO', clarity: 'OpenAir Chicago', fusion: 'Fusion' };
  const aggLabels = { pixel: 'Pixel/Sensor', community: 'Community Area', raw: 'Raw/Gridded' };
  const hourVal = currentMapType === 'hourly' ? document.getElementById('export-hour').value : 'N/A';
  return [
    `${label}: ${dateStr}`,
    `Scale: ${currentMapType.charAt(0).toUpperCase() + currentMapType.slice(1)}`,
    `Product: ${productLabels[currentDataProduct] || currentDataProduct}`,
    `Aggregation: ${aggLabels[currentAggregation] || currentAggregation}`,
    `Hour (UTC): ${hourVal}`,
    `Center: ${document.getElementById('export-lat').value}, ${document.getElementById('export-lng').value}`,
    `Zoom: ${document.getElementById('export-zoom').value}`,
    `Exported: ${new Date().toLocaleString()}`
  ];
}

// ── HELPER: Add one page to the PDF with a canvas image and metadata ───────
function addPdfPage(pdf, canvas, metadata, pageLabel, pageWidth, pageHeight, margin) {
  if (pageLabel > 1) {
    pdf.addPage();
  }

  const pdfTitle = document.getElementById('pdf-title').value;

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(pdfTitle, pageWidth / 2, 15, { align: 'center' });

  // Metadata
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  metadata.forEach((line, i) => {
    pdf.text(line, margin, 25 + i * 5);
  });

  // Map image
  const imageY = 25 + metadata.length * 5 + 5;
  const imageAvailableHeight = pageHeight - imageY - margin;
  const availableWidth = pageWidth - 2 * margin;
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const imageRatio = Math.min(availableWidth / imgWidth, imageAvailableHeight / imgHeight);
  const finalWidth = imgWidth * imageRatio;
  const finalHeight = imgHeight * imageRatio;
  const imageX = margin + (availableWidth - finalWidth) / 2;

  const imgData = canvas.toDataURL('image/png', 1.0);
  pdf.addImage(imgData, 'PNG', imageX, imageY, finalWidth, finalHeight);

  // Footer
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.text(
    'Generated by Regional Ozone Precursor Map Dashboard — NASA LaRC / EarthRISE Developers Academy',
    pageWidth / 2, pageHeight - 5, { align: 'center' }
  );
}

// ── HELPER: Hide UI elements before capture, restore after ─────────────────
function hideMapUI() {
  const zoomElements = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control');
  zoomElements.forEach(el => { el.style.visibility = 'hidden'; });
  const coordsBar = document.getElementById('coords-bar');
  if (coordsBar) coordsBar.style.display = 'none';
  const previewLabel = document.querySelector('.preview-label');
  if (previewLabel) previewLabel.style.display = 'none';
  const attribution = document.querySelector('.leaflet-control-attribution');
  if (attribution) attribution.style.display = 'none';
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
}

function showMapUI() {
  const zoomElements = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control');
  zoomElements.forEach(el => { el.style.visibility = ''; });
  const coordsBar = document.getElementById('coords-bar');
  if (coordsBar) coordsBar.style.display = '';
  const previewLabel = document.querySelector('.preview-label');
  if (previewLabel) previewLabel.style.display = '';
  const attribution = document.querySelector('.leaflet-control-attribution');
  if (attribution) attribution.style.display = '';
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.boxZoom.enable();
}

// ── HELPER: Capture current map as canvas ──────────────────────────────────
async function captureMapCanvas() {
  const mapElement = document.getElementById('export-map');
  hideMapUI();
  await sleep(200);

  const canvas = await html2canvas(mapElement, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    width: mapElement.scrollWidth,
    height: mapElement.scrollHeight
  });

  showMapUI();
  return canvas;
}

// ── EXPORT TO PDF ──────────────────────────────────────────────────────────
async function exportToPDF() {
  const exportBtn = document.getElementById('export-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';

  try {
    const { jsPDF } = window.jspdf;
    const orientation = document.getElementById('pdf-orientation').value;
    const pdf = new jsPDF({ orientation: orientation, unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    if (currentMapType === 'daily') {
      // ── DAILY: date range export ─────────────────────────────────────
      const mode = document.getElementById('date-range-pages').value;
      const dates = getDateRange(
        document.getElementById('date-range-start').value,
        document.getElementById('date-range-end').value
      );

      if (mode === 'single') {
        showStatus('Loading data for ' + dates[dates.length - 1] + '...', 'info');
        await loadDataForMap(dates[dates.length - 1], null);
        progressBar.style.width = '20%';

        const canvas = await captureMapCanvas();
        progressBar.style.width = '50%';
        showStatus('Generating PDF...', 'info');

        const metadata = getMetadataLines(dates[dates.length - 1], 'Date');
        addPdfPage(pdf, canvas, metadata, 1, pageWidth, pageHeight, margin);
      } else {
        const total = dates.length;
        for (let i = 0; i < total; i++) {
          const dateStr = dates[i];
          showStatus(`Processing ${i + 1}/${total}: ${dateStr}...`, 'info');
          progressBar.style.width = `${Math.round(((i + 1) / total) * 60)}%`;

          await loadDataForMap(dateStr, null);
          const canvas = await captureMapCanvas();

          const metadata = getMetadataLines(dateStr, 'Date');
          addPdfPage(pdf, canvas, metadata, i + 1, pageWidth, pageHeight, margin);
        }
        progressBar.style.width = '80%';
        showStatus('Generating PDF...', 'info');
      }

    } else if (currentMapType === 'monthly') {
    // ── MONTHLY: month range export ──────────────────────────────────
    const mode = document.getElementById('month-range-pages').value;
    const months = getMonthRange(
        document.getElementById('month-range-start').value,
        document.getElementById('month-range-end').value
    );

    if (mode === 'single') {
        // Single page with the last month
        const monthStr = months[months.length - 1];
        const dateStr = monthStr + '-01';
        showStatus('Loading data for ' + monthStr + '...', 'info');
        await loadDataForMap(dateStr, null);
        progressBar.style.width = '20%';

        const canvas = await captureMapCanvas();
        progressBar.style.width = '50%';
        showStatus('Generating PDF...', 'info');

        const metadata = getMetadataLines(monthStr, 'Month');
        addPdfPage(pdf, canvas, metadata, 1, pageWidth, pageHeight, margin);
    } else {
        // Multi-page: one page per month
        const total = months.length;
        for (let i = 0; i < total; i++) {
        const monthStr = months[i];
        const dateStr = monthStr + '-01';
        showStatus(`Processing ${i + 1}/${total}: ${monthStr}...`, 'info');
        progressBar.style.width = `${Math.round(((i + 1) / total) * 60)}%`;

        await loadDataForMap(dateStr, null);
        const canvas = await captureMapCanvas();

        const metadata = getMetadataLines(monthStr, 'Month');
        addPdfPage(pdf, canvas, metadata, i + 1, pageWidth, pageHeight, margin);
        }
        progressBar.style.width = '80%';
        showStatus('Generating PDF...', 'info');
    }

    } else {
    // ── HOURLY: single date export ───────────────────────────────────
    const dateStr = document.getElementById('export-date').value;
    const hour = document.getElementById('export-hour').value;

    showStatus('Capturing map screenshot...', 'info');
    progressBar.style.width = '20%';

    await loadDataForMap(dateStr, hour);
    const canvas = await captureMapCanvas();
    progressBar.style.width = '60%';
    showStatus('Generating PDF...', 'info');

    const metadata = getMetadataLines(dateStr, 'Date');
    addPdfPage(pdf, canvas, metadata, 1, pageWidth, pageHeight, margin);
    }

    progressBar.style.width = '95%';

    // Save
    const filename = document.getElementById('pdf-filename').value || 'no2_map_export';
    pdf.save(`${filename}.pdf`);

    progressBar.style.width = '100%';
    showStatus('PDF exported successfully!', 'success');

} catch (error) {
    console.error('Export failed:', error);
    showStatus(`Export failed: ${error.message}`, 'error');
} finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export as PDF';
    setTimeout(() => {
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    }, 2000);
}
}

// ── HELPER: Generate array of date strings (YYYY-MM-DD) in range ───────────
function getDateRange(startStr, endStr) {
const dates = [];
const start = new Date(startStr + 'T00:00:00');
const end = new Date(endStr + 'T00:00:00');
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
}
return dates;
}

// ── HELPER: Generate array of month strings (YYYY-MM) in range ─────────────
function getMonthRange(startStr, endStr) {
const months = [];
let [year, month] = startStr.split('-').map(Number);
const [endYear, endMonth] = endStr.split('-').map(Number);

while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
}
return months;
}

// ── STATUS HELPER ──────────────────────────────────────────────────────────
function showStatus(message, type) {
const el = document.getElementById('export-status');
el.textContent = message;
el.className = `export-status ${type}`;
}

// ── UTILITY ────────────────────────────────────────────────────────────────
function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
selectMapType('hourly');
});