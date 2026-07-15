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
    // Invalidate map size when tab becomes visible
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
} else {
    mapContainer.style.display = 'none';
    dataContainer.style.display = 'block';
    // Load files if not already loaded
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
const statusEl = document.getElementById('data-export-status');

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
    const typeLabel = file.type.replace(/_/g, ' ').toUpperCase();

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
const statusEl = document.getElementById('data-export-status');
const exportBtn = document.getElementById('data-export-btn');

if (selectedFiles.length === 0) {
    showDataExportStatus('Please select at least one file to export.', 'error');
    return;
}

exportBtn.disabled = true;
exportBtn.textContent = 'Exporting...';
showDataExportStatus(`Preparing ${selectedFiles.length} file(s) for download...`, 'info');

// Download each selected file
for (let i = 0; i < selectedFiles.length; i++) {
    const filename = selectedFiles[i];
    showDataExportStatus(`Downloading ${i + 1}/${selectedFiles.length}: ${filename}`, 'info');
    
    const downloadUrl = `/api/export-data-file/?source=${currentDataSource}&file=${encodeURIComponent(filename)}&format=${currentExportFormat}`;
    
    // Create a temporary link and trigger download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Small delay between downloads
    if (i < selectedFiles.length - 1) {
    await sleep(500);
    }
}

exportBtn.disabled = false;
exportBtn.innerHTML = '&#10515; Download Selected';
showDataExportStatus(`${selectedFiles.length} file(s) exported successfully!`, 'success');

// Log activity
logActivity('export_completed', `Exported ${selectedFiles.length} data file(s) from ${currentDataSource}`, 
            `Format: ${currentExportFormat}`);
}

function showDataExportStatus(message, type) {
const el = document.getElementById('data-export-status');
el.textContent = message;
el.className = `export-status ${type}`;
}

function logActivity(type, title, details) {
// Activity logging is handled server-side
}


// ── CONFIG (PDF Map Export) ────────────────────────────────────────────────
const TIME_SCALE = '{{ time_scale|default:"hourly" }}';

let currentMapType = 'hourly';
let heatLayer = null;
let tempoLayerGroup = null;

// ── MAP INIT ───────────────────────────────────────────────────────────────
const map = L.map('export-map', {
center: [41.52, -87.37],
zoom: 10,
zoomControl: true,
dragging: true
});

// Disable default zoom control (we add our own for easy hiding)
// No zoom control added initially — we control it manually

// ── CHICAGO BORDERS & COMMUNITIES LAYERS ───────────────────────────────────────────────────────────────
let chicagoBorderLayer = null;
let chicagoCommunityLayer = null;

fetch("{% static 'dashboard/layers/Chicago.geojson' %}")
.then(response => response.json())
.then(data => {
    chicagoBorderLayer = L.geoJSON(data, {
    style: {
        color: "#000000",
        weight: 2
    }
    });
    
    // Add to map if checkbox is checked (default)
    if (document.getElementById('include-border').checked) {
    chicagoBorderLayer.addTo(map);
    }
})

fetch("{% static 'dashboard/layers/ChicagoCommunityAreas.geojson' %}")
.then(response => response.json())
.then(data => {
    chicagoCommunityLayer = L.geoJSON(data, {
    style: {
        color: "#00000077",
        weight: 1
    }
    });
    
    // Add to map if checkbox is checked (default)
    if (document.getElementById('include-communities').checked) {
    chicagoCommunityLayer.addTo(map);
    }
})

// Toggle Chicago border & community areas layers based on checkbox
document.getElementById('include-border').addEventListener('change', function() {
if (this.checked) {
    if (chicagoBorderLayer) chicagoBorderLayer.addTo(map);
} else {
    if (chicagoBorderLayer) map.removeLayer(chicagoBorderLayer);
}
});

document.getElementById('include-communities').addEventListener('change', function() {
    if (this.checked) {
    if (chicagoCommunityLayer) chicagoCommunityLayer.addTo(map);
    } else {
    if (chicagoCommunityLayer) map.removeLayer(chicagoCommunityLayer);
    }
});

// ── MAP COORDS BAR ─────────────────────────────────────────────────────────────
map.on('mousemove', e => {
document.getElementById('coords-text').textContent =
`Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`;
});
map.on('zoomend', () => {
document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;
});
document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;

// ── MAP coords PANEL ───────────────────────────────────────────────────────────────
map.on('mousemove', e => {
document.getElementById('coords-panel').innerHTML =
`<strong>Lat:</strong> ${e.latlng.lat.toFixed(6)}<br>
    <strong>Lng:</strong> ${e.latlng.lng.toFixed(6)}<br>
    <strong>Zoom:</strong> ${map.getZoom()}`;
});

// Basemap
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
attribution: 'Tiles &copy; Esri',
maxZoom: 19
}).addTo(map);

// Layer groups
tempoLayerGroup = L.layerGroup().addTo(map);
openaqLayerGroup = L.layerGroup().addTo(map)
fusionLayerGroup = L.layerGroup().addTo(map)

// ── LOAD TEMPO DATA ────────────────────────────────────────────────────────
async function loadTempoData(dateStr, hour) {
try {
    const url = `${API_BASE}${dateStr}/?scale=${currentMapType}&hour=${hour || ''}`;
    const response = await fetch(url);
    const data = await response.json();

    tempoLayerGroup.clearLayers();

    if (data.features) {
    L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
            radius: 5,
            fillColor: no2Color(feature.properties.value || 0),
            color: 'transparent',
            fillOpacity: 0.6
        });
        }
    }).addTo(tempoLayerGroup);
    }

    // Update heatmap
    updateHeatmap(data);
    showStatus('Map data loaded.', 'info');
} catch (error) {
    console.error('Error loading data:', error);
    showStatus('Failed to load map data.', 'error');
}
}

// ── MAP TYPE SELECTION ─────────────────────────────────────────────────────
function selectMapType(type) {
currentMapType = type;
document.querySelectorAll('.map-type-btn[data-type]').forEach(btn => {
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
let dateStr, hour = null;
const lat = parseFloat(document.getElementById('export-lat').value);
const lng = parseFloat(document.getElementById('export-lng').value);
const zoom = parseInt(document.getElementById('export-zoom').value);

if (currentMapType === 'hourly') {
    dateStr = document.getElementById('export-date').value;
    hour = document.getElementById('export-hour').value;
} else if (currentMapType === 'daily') {
    // Use end date of range for preview
    dateStr = document.getElementById('date-range-end').value;
} else if (currentMapType === 'monthly') {
    // Use end month of range for preview
    dateStr = document.getElementById('month-range-end').value + '-01';
}

// Update map view
map.flyTo([lat, lng], zoom);

// Load data
loadTempoData(dateStr, hour);
}

// ── HELPER: Generate metadata lines for a given date/month ─────────────────
function getMetadataLines(dateStr, label) {
const hourVal = currentMapType === 'hourly' ? document.getElementById('export-hour').value : 'N/A';
return [
    `${label}: ${dateStr}`,
    `Scale: ${currentMapType.charAt(0).toUpperCase() + currentMapType.slice(1)}`,
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

const availableWidth = pageWidth - 2 * margin;
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
// Uses CSS hiding (no DOM removal) to prevent Leaflet from shifting tiles
function hideMapUI() {
// Hide zoom controls via CSS (leaflet default positions)
const zoomElements = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control');
zoomElements.forEach(el => {
    el.style.visibility = 'hidden';
});
// Hide coords bar
const coordsBar = document.getElementById('coords-bar');
if (coordsBar) coordsBar.style.display = 'none';
// Hide preview label
const previewLabel = document.querySelector('.preview-label');
if (previewLabel) previewLabel.style.display = 'none';
// Hide attribution
const attribution = document.querySelector('.leaflet-control-attribution');
if (attribution) attribution.style.display = 'none';
// Lock the map (disable all interactions)
map.dragging.disable();
map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
}

function showMapUI() {
// Restore all controls
const zoomElements = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control');
zoomElements.forEach(el => {
    el.style.visibility = '';
});
// Restore coords bar
const coordsBar = document.getElementById('coords-bar');
if (coordsBar) coordsBar.style.display = '';
// Restore preview label
const previewLabel = document.querySelector('.preview-label');
if (previewLabel) previewLabel.style.display = '';
// Restore attribution
const attribution = document.querySelector('.leaflet-control-attribution');
if (attribution) attribution.style.display = '';
// Unlock the map
map.dragging.enable();
map.touchZoom.enable();
map.doubleClickZoom.enable();
map.scrollWheelZoom.enable();
map.boxZoom.enable();
}

// ── HELPER: Capture current map as canvas ──────────────────────────────────
async function captureMapCanvas() {
const mapElement = document.getElementById('export-map');

// Hide UI elements and lock map before capture
hideMapUI();
await sleep(200);  // Brief pause for UI to hide

const canvas = await html2canvas(mapElement, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    width: mapElement.scrollWidth,
    height: mapElement.scrollHeight
});

// Restore UI elements and unlock map
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
        // Single page with the last date
        showStatus('Loading data for ' + dates[dates.length - 1] + '...', 'info');
        await loadTempoData(dates[dates.length - 1], null);
        progressBar.style.width = '20%';

        const canvas = await captureMapCanvas();
        progressBar.style.width = '50%';
        showStatus('Generating PDF...', 'info');

        const metadata = getMetadataLines(dates[dates.length - 1], 'Date');
        addPdfPage(pdf, canvas, metadata, 1, pageWidth, pageHeight, margin);
    } else {
        // Multi-page: one page per date
        const total = dates.length;
        for (let i = 0; i < total; i++) {
        const dateStr = dates[i];
        showStatus(`Processing ${i + 1}/${total}: ${dateStr}...`, 'info');
        progressBar.style.width = `${Math.round(((i + 1) / total) * 60)}%`;

        await loadTempoData(dateStr, null);
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
        await loadTempoData(dateStr, null);
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

        await loadTempoData(dateStr, null);
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

    await loadTempoData(dateStr, hour);
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