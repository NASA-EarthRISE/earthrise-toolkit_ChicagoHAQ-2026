// ──────────────────────────────────────────────────────────────────────────────
// map_controls.js — UI controls, events, notices, and initialization
// Load order: time_utils.js → map_init.js → map_layers.js → data_loader.js → map_controls.js
// ──────────────────────────────────────────────────────────────────────────────

// UI Helpers
function showLoading(message) {
    hideNoDataNotice();
    const overlay = document.getElementById("map-loading-overlay");
    const textEl = document.getElementById("map-loading-text");
    if (overlay) {
        if (textEl && message) textEl.textContent = message;
        overlay.classList.add("visible");
    }
}

function hideLoading() {
    const overlay = document.getElementById("map-loading-overlay");
    if (overlay) overlay.classList.remove("visible");
}

// 'No Data' Buttons and Warnings
function showNoDataNotice(title, detailText) {
    const notice = document.getElementById("map-no-data-notice");
    const textEl = document.getElementById("map-no-data-text");
    if (!notice) return;
    const strongEl = notice.querySelector("strong");
    if (strongEl) strongEl.textContent = title || "No data available";
    if (textEl) textEl.textContent = detailText || "";
    notice.classList.add("visible");
}

function hideNoDataNotice() {
    const notice = document.getElementById("map-no-data-notice");
    if (notice) notice.classList.remove("visible");
}

function showMapWarningNotice(title, detailText, autoHideMs = 6500) {
    const notice = document.getElementById("map-warning-notice");
    const textEl = document.getElementById("map-warning-text");
    if (!notice) return;
    const strongEl = notice.querySelector("strong");
    if (strongEl) strongEl.textContent = title || "Notice";
    if (textEl) textEl.textContent = detailText || "";
    notice.classList.add("visible");
    if (autoHideMs && autoHideMs > 0) {
        window.clearTimeout(notice._autoHideTimer);
        notice._autoHideTimer = window.setTimeout(() => { notice.classList.remove("visible"); }, autoHideMs);
    }
}

function hideMapWarningNotice() {
    const notice = document.getElementById("map-warning-notice");
    if (notice) { window.clearTimeout(notice._autoHideTimer); notice.classList.remove("visible"); }
}

function showToast(message, level) {
    level = level || "info";
    console.log("[Toast]", message);
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) return;
    document.querySelectorAll('.map-toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'map-toast';
    Object.assign(toast.style, {
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px',
        zIndex: '2000', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', maxWidth: '90%',
        textAlign: 'center', pointerEvents: 'none'
    });
    if (level === "warning") { toast.style.background = '#fff3cd'; toast.style.color = '#856404'; toast.style.border = '1px solid #ffc107'; }
    else if (level === "error") { toast.style.background = '#f8d7da'; toast.style.color = '#721c24'; toast.style.border = '1px solid #f5c6cb'; }
    else { toast.style.background = '#d1ecf1'; toast.style.color = '#0c5460'; toast.style.border = '1px solid #bee5eb'; }
    toast.textContent = message;
    mapContainer.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}
window.showToast = showToast;

// Export Map as PNG Button
async function exportMapAsPNG() {
    const btn = document.getElementById('export-png-btn');
    btn.disabled = true; btn.textContent = 'Capturing...';
    const els = ['coords-bar', 'bottom-slider-bar', 'help-panel', 'map-loading-overlay'];
    const hidden = [];
    els.forEach(id => { const el = document.getElementById(id); if (el) { hidden.push({ el, display: el.style.display }); el.style.display = 'none'; }});
    const shareHeader = document.querySelector('.map-export-header');
    if (shareHeader) { hidden.push({ el: shareHeader, display: shareHeader.style.display }); shareHeader.style.display = 'none'; }
    const leafletControls = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control');
    const homeControl = document.querySelector('.leaflet-control-home');
    leafletControls.forEach(el => { hidden.push({ el, display: el.style.display }); el.style.display = 'none'; });
    if (homeControl) { hidden.push({ el: homeControl, display: homeControl.style.display }); homeControl.style.display = 'none'; }

    map.dragging.disable(); map.touchZoom.disable(); map.doubleClickZoom.disable(); map.scrollWheelZoom.disable(); map.boxZoom.disable();
    await new Promise(r => setTimeout(r, 300));

    try {
        const mapContainer = document.querySelector('.map-container');
        const canvas = await html2canvas(mapContainer, { useCORS: true, allowTaint: false, scale: 2, backgroundColor: '#ffffff', logging: false, width: mapContainer.scrollWidth, height: mapContainer.scrollHeight });
        const link = document.createElement('a');
        const now = new Date();
        const ts = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
        link.download = `no2_map_${ts}.png`; link.href = canvas.toDataURL('image/png', 1.0); link.click();
    } catch (err) { console.error('PNG export failed:', err); alert('Failed to export map as PNG. Please try again.'); }
    finally {
        hidden.forEach(h => { h.el.style.display = h.display; });
        map.dragging.enable(); map.touchZoom.enable(); map.doubleClickZoom.enable(); map.scrollWheelZoom.enable(); map.boxZoom.enable();
        btn.disabled = false; btn.textContent = 'Export as PNG';
    }
}

// Dynamic Scalebar Functions
function updateScaleBar() {
    const ruler = document.getElementById('scalebar-ruler');
    const ticksContainer = document.getElementById('scalebar-ticks');
    const labelsContainer = document.getElementById('scalebar-labels');
    if (!ruler || !ticksContainer || !labelsContainer) return;
    const center = map.getCenter(); const zoom = map.getZoom();
    const milesPerPixel = (2 * Math.PI * 6378137) / (Math.pow(2, zoom) * 256 * Math.cos(center.lat * Math.PI / 180));
    const totalPixels = 200; const distanceMiles = milesPerPixel * totalPixels;
    let value, units;
    if (distanceMiles >= 1609.344) {
        const distMiles = distanceMiles / 1609.344; const mag = Math.pow(10, Math.floor(Math.log10(distMiles))); const norm = distMiles / mag;
        value = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag; units = 'mi';
    } else {
        const mag = Math.pow(10, Math.floor(Math.log10(distanceMiles || 1))); const norm = distanceMiles / mag;
        value = (norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10) * mag; units = 'ft';
    }
    const totalMeters = (units === 'mi' ? value * 1609.344 : value * 0.3048);
    const majorSegments = 4; const minorPerMajor = 4;
    const minorSegmentMeters = totalMeters / (majorSegments * minorPerMajor);
    const minorSegmentPixels = totalPixels / (majorSegments * minorPerMajor);
    ticksContainer.innerHTML = ''; labelsContainer.innerHTML = ''; labelsContainer.style.width = totalPixels + 'px';
    for (let i = 0; i < majorSegments * minorPerMajor + 1; i++) {
        const isMajor = (i % minorPerMajor === 0);
        const tick = document.createElement('div'); tick.className = 'scalebar-tick ' + (isMajor ? 'major' : 'minor'); tick.style.left = (i * minorSegmentPixels) + 'px'; ticksContainer.appendChild(tick);
        if (isMajor) {
            const label = document.createElement('span'); label.className = 'scalebar-label';
            const valMeters = minorSegmentMeters * i;
            if (units === 'mi') { const valMiles = valMeters / 1609.344; label.textContent = valMiles.toFixed(valMiles < 10 ? 1 : 0) + ' mi'; }
            else { label.textContent = Math.round(valMeters / 0.3048) + ' ft'; }
            label.style.left = (i * minorSegmentPixels) + 'px'; labelsContainer.appendChild(label);
        }
    }
}

// Play and Pause Buttons are not Active at the Same Time
function resetPlaybackUI() {
    const playBtn = document.getElementById("playBtn"); const pauseBtn = document.getElementById("pauseBtn");
    const dateSlider = document.getElementById("dateSlider"); const timeSlider = document.getElementById("timeSlider");
    if (playBtn) { playBtn.classList.remove('playing'); playBtn.disabled = false; }
    if (pauseBtn) pauseBtn.disabled = true;
    if (dateSlider) dateSlider.disabled = false;
    if (timeSlider) timeSlider.disabled = false;
}

// Refresh Map after New Product is Selected
function refreshMap() {
    if (dates.length === 0) return;
    loadDate(dates[Number(document.getElementById("dateSlider").value)]);
}

// 'Select Date' and 'Load' Functions
function updateDateAndTimeLabels(date) {
    const dateLabel = document.getElementById("dateLabel"); const timeLabel = document.getElementById("timeLabel");
    if (!date) return;
    if (TIME_SCALE === "monthly") { if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(date); }
    else { if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(date); }
    if (timeLabel && TIME_SCALE === "hourly") timeLabel.innerHTML = `Time: ${formatHourForDisplay(date, selectedHour)}`;
}

//'Hourly', 'Daily', or 'Monthly' Map Type Buttons
let currentMapType = TIME_SCALE;

function selectMapType(type) {
    currentMapType = type;
    document.querySelectorAll('.map-type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
    document.querySelectorAll('.map-type-link').forEach(link => link.classList.toggle('active', link.dataset.type === type));
    const single = document.getElementById('single-date-group'); const daily = document.getElementById('date-range-group');
    const monthly = document.getElementById('month-range-group'); const label = document.getElementById('date-section-label');
    if (type === 'hourly') { if (single) single.style.display = 'block'; if (daily) daily.style.display = 'none'; if (monthly) monthly.style.display = 'none'; if (label) label.textContent = 'Date'; }
    else if (type === 'daily') { if (single) single.style.display = 'none'; if (daily) daily.style.display = 'block'; if (monthly) monthly.style.display = 'none'; if (label) label.textContent = 'Date Range'; }
    else if (type === 'monthly') { if (single) single.style.display = 'none'; if (daily) daily.style.display = 'none'; if (monthly) monthly.style.display = 'block'; if (label) label.textContent = 'Month Range'; }
}

function handleMapTypeClick(event, type) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const checkedProduct = document.querySelector('input[name="dataProduct"]:checked')?.value || localStorage.getItem("selectedDataProduct") || "openaq";
    localStorage.setItem("selectedDataProduct", checkedProduct);
    let url = `/map/${type}/`; const sep = url.includes("?") ? "&" : "?";
    window.location.assign(`${url}${sep}product=${encodeURIComponent(checkedProduct)}`);
}
window.handleMapTypeClick = handleMapTypeClick;

// 'Individual' or 'Community' Aggregation Radio Buttons
function changeAggregation(type) {
    if (type !== TIME_SCALE && ["hourly","daily","monthly"].includes(type)) return;
    TIME_SCALE = type;
    document.querySelectorAll('input[name="TIME_SCALE"]').forEach(r => r.checked = r.value === type);
    var ds = document.getElementById("dateSlider");
    if (ds) { if (TIME_SCALE === "range") { rangeDates = dates.filter(d => d >= rangeStartDate && d <= rangeEndDate); ds.min = 0; ds.max = Math.max(0, rangeDates.length - 1); ds.value = 0; } else { ds.min = 0; ds.max = dates.length - 1; ds.value = 0; } }
    updateBottomControlVisibility();
    let rc = document.getElementById("rangeControls"); if (rc) rc.style.display = TIME_SCALE === "range" ? "block" : "none";
    let cd = dates.length > 0 ? dates[0] : null; var dl = document.getElementById("dateLabel");
    if (cd) { if (TIME_SCALE === "monthly") { if (dl) dl.innerHTML = formatMonthForDisplay(cd); } else { if (dl) dl.innerHTML = utcDateToCentralPretty(cd); } }
    if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
    if (communityLayer) { map.removeLayer(communityLayer); communityLayer = null; }
    if (!appInitialized) return;
    clearDataLayers(); cachedDate = null; cachedFeatures = null; cachedHourBuckets = null; nextCachedDate = null; nextCachedHourBuckets = null;
    if (currentDataProduct === "tempo") { loadTempoDates(); return; }
    if (currentDataProduct === "fusion") { loadFusionDates(); return; }
    loadClarityDates();
}

// Date Selection from 'Load' and Time Slider
function getCurrentSelectedDateFromSlider() {
    const ds = document.getElementById("dateSlider"); if (!ds || !dates || dates.length === 0) return null; return dates[Number(ds.value)] || null;
}

function captureCurrentDateHourPreference() {
    pendingPreferredDate = getCurrentSelectedDateFromSlider();
    const ts = document.getElementById("timeSlider");
    pendingPreferredHour = ts ? Number(ts.value || selectedHour || 0) : (selectedHour || 0);
}

function findBestDateIndex(loadedDates, preferredDate) {
    if (!loadedDates || loadedDates.length === 0) return { index: 0, adjusted: false, requestedDate: preferredDate, selectedDate: null };
    if (!preferredDate) return { index: 0, adjusted: false, requestedDate: preferredDate, selectedDate: loadedDates[0] };
    const exactIndex = loadedDates.indexOf(preferredDate);
    if (exactIndex !== -1) return { index: exactIndex, adjusted: false, requestedDate: preferredDate, selectedDate: loadedDates[exactIndex] };
    if (TIME_SCALE === "monthly") {
        const pm = preferredDate.substring(0, 7); const mi = loadedDates.indexOf(pm);
        if (mi !== -1) return { index: mi, adjusted: pm !== preferredDate, requestedDate: preferredDate, selectedDate: loadedDates[mi] };
    }
    let bestIndex = 0, bestDist = Infinity;
    loadedDates.forEach((v, i) => {
        let a, p;
        if (TIME_SCALE === "monthly") { a = new Date(v + "-01T00:00:00Z").getTime(); p = new Date(preferredDate.substring(0,7) + "-01T00:00:00Z").getTime(); }
        else { a = new Date(v + "T00:00:00Z").getTime(); p = new Date(preferredDate + "T00:00:00Z").getTime(); }
        const d = Math.abs(a - p); if (!isNaN(d) && d < bestDist) { bestDist = d; bestIndex = i; }
    });
    return { index: bestIndex, adjusted: true, requestedDate: preferredDate, selectedDate: loadedDates[bestIndex] };
}

function applyPreferredDateAndHourAfterDateLoad(load) {
    if (!dates || dates.length === 0) return;
    const ds = document.getElementById("dateSlider"); const ts = document.getElementById("timeSlider");
    const match = findBestDateIndex(dates, pendingPreferredDate);
    const selDate = dates[match.index];
    if (ds) { ds.min = 0; ds.max = dates.length - 1; ds.value = match.index; }
    if (TIME_SCALE === "hourly") { selectedHour = Math.max(0, Math.min(23, pendingPreferredHour !== null ? Number(pendingPreferredHour) : selectedHour)); if (ts) ts.value = selectedHour; }
    updateDateAndTimeLabels(selDate);
    if (match.adjusted && match.requestedDate && match.selectedDate) {
        const rl = TIME_SCALE === "monthly" ? formatMonthForDisplay(match.requestedDate.substring(0,7)) : utcDateToCentralPretty(match.requestedDate);
        const sl = TIME_SCALE === "monthly" ? formatMonthForDisplay(match.selectedDate) : utcDateToCentralPretty(match.selectedDate);
        const ht = TIME_SCALE === "hourly" ? ` Hour preserved: ${formatHourForDisplay(match.selectedDate, selectedHour)}.` : "";
        showMapWarningNotice("Selected date unavailable", `This data product does not include ${rl}. Showing nearest available date: ${sl}.${ht}`);
    }
    pendingPreferredDate = null; pendingPreferredHour = null;
    loadDate(selDate, load);
}

// Page Init (inside setTimeout) for All Widgets

setTimeout(() => {
    var dateSlider = document.getElementById("dateSlider"); var dateLabel = document.getElementById("dateLabel");
    var timeSlider = document.getElementById("timeSlider"); var timeLabel = document.getElementById("timeLabel");
    var playBtn = document.getElementById("playBtn"); var pauseBtn = document.getElementById("pauseBtn");
    updateBottomControlVisibility();
    var startDateInput = document.getElementById("startDate"); var endDateInput = document.getElementById("endDate");

    document.querySelectorAll('input[name="displayMode"]').forEach(el => el.addEventListener("change", function() {
        displayMode = this.value; cachedDate = null; cachedFeatures = null; cachedHourBuckets = null; nextCachedDate = null; nextCachedHourBuckets = null;
        if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
        if (communityLayer) { map.removeLayer(communityLayer); communityLayer = null; }
        refreshMap();
    }));

    document.querySelectorAll('input[name="TIME_SCALE"]').forEach(el => el.addEventListener("change", function() {
        selectMapType(this.value); changeAggregation(this.value);
    }));

    dateSlider.addEventListener("input", function() {
        let index = Number(this.value);
        if (TIME_SCALE === "range") { rangeCurrentEndDate = rangeDates[index]; dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`; loadDateRange(); return; }
        let date = dates[index]; if (!date) return; updateDateAndTimeLabels(date); loadDate(date);
    });

    if (timeSlider) timeSlider.addEventListener("input", function() {
        if (TIME_SCALE !== "hourly") return;
        selectedHour = Number(this.value); let baseDate = dates[Number(dateSlider.value)];
        if (!baseDate) return;
        if (timeLabel) timeLabel.textContent = `Time: ${formatHourForDisplay(baseDate, selectedHour)}`;
        loadDate(baseDate);
    });

    startDateInput.addEventListener("change", function() {
        rangeStartDate = this.value; rangeCurrentEndDate = rangeEndDate;
        rangeDates = dates.filter(d => d >= rangeStartDate && d <= rangeEndDate);
        dateSlider.min = 0; dateSlider.max = Math.max(0, rangeDates.length - 1); dateSlider.value = 0;
        if (TIME_SCALE === "range") loadDateRange();
    });

    endDateInput.addEventListener("change", function() {
        rangeEndDate = this.value; rangeCurrentEndDate = rangeEndDate;
        rangeDates = dates.filter(d => d >= rangeStartDate && d <= rangeEndDate);
        dateSlider.min = 0; dateSlider.max = Math.max(0, rangeDates.length - 1); dateSlider.value = 0;
        if (TIME_SCALE === "range") loadDateRange();
    });

    playBtn.addEventListener("click", () => {
        if (timeInterval) return;
        playBtn.disabled = true; playBtn.classList.add('playing'); pauseBtn.disabled = false; dateSlider.disabled = true; timeSlider.disabled = true;
        if (TIME_SCALE === "range") { rangeCurrentEndDate = rangeStartDate; dateSlider.value = 0; dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`; loadDateRange(); }
        timeInterval = setInterval(() => {
            if (TIME_SCALE === "hourly") {
                selectedHour++;
                if (selectedHour > 23) {
                    let ci = Number(dateSlider.value);
                    if (ci === dates.length - 1) { clearInterval(timeInterval); timeInterval = null; resetPlaybackUI(); return; }
                    selectedHour = 0; ci++; dateSlider.value = ci; let date = dates[ci];
                    if (nextCachedDate === date) {
                        cachedDate = nextCachedDate; cachedHourBuckets = nextCachedHourBuckets;
                        updateDateAndTimeLabels(date); timeSlider.value = 0;
                        if (timeLabel) timeLabel.innerHTML = `Time: ${formatHourForDisplay(date, 0)}`;
                        if (currentDataProduct === "tempo") renderTempoFeatures(cachedHourBuckets[0], date);
                        else if (currentDataProduct === "fusion") loadDate(date);
                        else renderFeatures(cachedHourBuckets[0], date);
                        return;
                    }
                    updateDateAndTimeLabels(date);
                }
                timeSlider.value = selectedHour; let baseDate = dates[Number(dateSlider.value)];
                if (timeLabel && TIME_SCALE === "hourly") timeLabel.innerHTML = `Time: ${formatHourForDisplay(baseDate, selectedHour)}`;
                loadDate(baseDate);
            } else if (TIME_SCALE === "range") {
                let ei = dates.indexOf(rangeCurrentEndDate); let fi = dates.indexOf(rangeEndDate);
                if (rangeCurrentEndDate === null) { rangeCurrentEndDate = rangeStartDate; loadDateRange(); return; }
                ei++; if (ei > fi) { clearInterval(timeInterval); timeInterval = null; resetPlaybackUI(); return; }
                rangeCurrentEndDate = dates[ei]; dateSlider.value = rangeDates.indexOf(rangeCurrentEndDate); endDateInput.value = rangeCurrentEndDate;
                dateLabel.innerHTML = `Average Through<br>${utcDateToCentralPretty(rangeCurrentEndDate)}`; loadDateRange();
            } else if (TIME_SCALE === "daily") {
                let ci = Number(dateSlider.value); ci++;
                if (ci >= dates.length) { clearInterval(timeInterval); timeInterval = null; resetPlaybackUI(); return; }
                dateSlider.value = ci; let date = dates[ci]; dateLabel.innerHTML = utcDateToCentralPretty(date); loadDate(date);
            } else if (TIME_SCALE === "monthly") {
                let ni = Number(dateSlider.value) + 1;
                if (ni >= dates.length) { clearInterval(timeInterval); timeInterval = null; resetPlaybackUI(); return; }
                dateSlider.value = ni; let date = dates[ni]; dateLabel.innerHTML = formatMonthForDisplay(date); loadDate(date);
            }
        }, 750);
    });

    pauseBtn.addEventListener("click", () => { clearInterval(timeInterval); timeInterval = null; playBtn.disabled = false; playBtn.classList.remove('playing'); pauseBtn.disabled = true; dateSlider.disabled = false; timeSlider.disabled = false; });

    const savedDataProduct = urlProduct || localStorage.getItem("selectedDataProduct") || "openaq";
    const savedRadio = document.querySelector(`input[name="dataProduct"][value="${savedDataProduct}"]`);
    if (savedRadio) savedRadio.checked = true;
    currentDataProduct = normalizeDataProduct(savedDataProduct); localStorage.setItem("selectedDataProduct", savedDataProduct);
    appInitialized = true;

    document.querySelectorAll('input[name="displayMode"]').forEach(r => r.checked = (r.value === displayMode));
    updateLegend(); loadCommunityAreas(); loadChicagoBorder();

    // Load buttons
    const ls = document.getElementById('load-single-date');
    if (ls) ls.addEventListener('click', function() {
        const d = document.getElementById('map-date').value; if (!d) { showToast('Please select a date first.', 'warning'); return; }
        const i = dates.indexOf(d); if (i === -1) { showToast(`No data available for ${d}.`, 'warning'); return; }
        dateSlider.value = i; updateDateAndTimeLabels(d); loadDate(d); showToast(`Loaded ${d}`);
    });

    const ld = document.getElementById('load-date-range');
    if (ld) ld.addEventListener('click', function() {
        const s = document.getElementById('date-range-start').value; const e = document.getElementById('date-range-end').value;
        if (!s || !e) { showToast('Please select both a start and end date.', 'warning'); return; }
        if (s > e) { showToast('Start date must be before end date.', 'warning'); return; }
        const fd = allDates.filter(d => d >= s && d <= e);
        if (fd.length === 0) { showToast(`No data available between ${s} and ${e}.`, 'warning'); return; }
        dates = fd; rangeDates = fd; rangeStartDate = s; rangeEndDate = e; rangeCurrentEndDate = e;
        dateSlider.min = 0; dateSlider.max = fd.length - 1; dateSlider.value = 0; dateLabel.innerHTML = utcDateToCentralPretty(fd[0]);
        loadDate(fd[0]); showToast(`Loaded ${fd.length} days from ${s} to ${e}`);
    });

    const lm = document.getElementById('load-month-range');
    if (lm) lm.addEventListener('click', function() {
        const s = document.getElementById('month-range-start').value; const e = document.getElementById('month-range-end').value;
        if (!s || !e) { showToast('Please select both a start and end month.', 'warning'); return; }
        if (s > e) { showToast('Start month must be before end month.', 'warning'); return; }
        const fd = allDates.filter(m => m >= s && m <= e);
        if (fd.length === 0) { showToast(`No data available between ${s} and ${e}.`, 'warning'); return; }
        dates = fd; rangeDates = fd; rangeStartDate = s; rangeEndDate = e;
        dateSlider.min = 0; dateSlider.max = fd.length - 1; dateSlider.value = 0; dateLabel.innerHTML = formatMonthForDisplay(fd[0]);
        loadDate(fd[0]); showToast(`Loaded ${fd.length} days from ${s} to ${e}`);
    });

    if (currentDataProduct === "tempo") loadTempoDates();
    else if (currentDataProduct === "fusion") loadFusionDates();
    else loadClarityDates();

    // Data product radio buttons
    document.querySelectorAll('input[name="dataProduct"]').forEach(radio => radio.addEventListener('change', e => {
        captureCurrentDateHourPreference();
        const selected = e.target.value; const normalizedSelected = normalizeDataProduct(selected);
        localStorage.setItem("selectedDataProduct", selected); currentDataProduct = normalizedSelected;
        startNewLoad(currentDataProduct);
        if (timeInterval) { clearInterval(timeInterval); timeInterval = null; }
        clearDataLayers(); cachedDate = null; cachedFeatures = null; cachedHourBuckets = null; nextCachedDate = null; nextCachedHourBuckets = null;
        map.removeLayer(tempoLayerGroup); map.removeLayer(openaqLayerGroup); map.removeLayer(fusionLayerGroup);

        if (currentDataProduct === "tempo") {
            displayMode = document.querySelector('input[name="displayMode"]:checked')?.value || displayMode || "sensor";
            document.querySelectorAll('input[name="displayMode"]').forEach(r => r.checked = (r.value === displayMode));
            updateLegend(); loadTempoDates(); showToast("TEMPO data product selected");
        } else if (currentDataProduct === "clarity") {
            displayMode = document.querySelector('input[name="displayMode"]:checked')?.value || displayMode || "sensor";
            document.querySelectorAll('input[name="displayMode"]').forEach(r => r.checked = (r.value === displayMode));
            updateLegend(); loadClarityDates(); showToast("Open Air Chicago (Clarity) data product selected");
        } else if (currentDataProduct === "fusion") {
            displayMode = document.querySelector('input[name="displayMode"]:checked')?.value || displayMode || "sensor";
            updateIndividualModeLabel(); updateLegend(); loadFusionDates(); showToast("Fusion data product selected");
        }
        cachedDate = null; cachedFeatures = null; cachedHourBuckets = null; nextCachedDate = null; nextCachedHourBuckets = null;
    }));

    // Coordinates bar
    map.on('mousemove', e => { document.getElementById('coords-text').textContent = `Lat: ${e.latlng.lat.toFixed(5)}  Lng: ${e.latlng.lng.toFixed(5)}`; });
    map.on('zoomend', () => { document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`; });
    document.getElementById('zoom-text').textContent = `Zoom: ${map.getZoom()}`;

    // Help panel toggle
    const helpPanel = document.getElementById('help-panel'); const helpToggle = document.getElementById('help-panel-toggle'); const helpBody = document.getElementById('help-panel-body');
    if (helpToggle && helpPanel) {
        helpPanel.classList.add('retracted');
        if (helpToggle) { L.DomEvent.disableClickPropagation(helpToggle); L.DomEvent.disableScrollPropagation(helpToggle); }
        if (helpBody) { L.DomEvent.disableClickPropagation(helpBody); L.DomEvent.disableScrollPropagation(helpBody); }
        helpToggle.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); helpPanel.classList.toggle('retracted'); helpPanel.classList.toggle('expanded'); });
    }

    // Scalebar update on zoom/pan
    map.on('zoomend moveend', updateScaleBar); setTimeout(updateScaleBar, 500);

    // Region dropdown
    const regionDropdown = document.getElementById('region-dropdown');
    if (regionDropdown) regionDropdown.addEventListener('change', function() { if (this.value === 'cook_county') map.flyTo(homeCoords, homeZoom, { duration: 1.5 }); });

    // Sidebar toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn'); const mapControls = document.getElementById('map-controls');
    if (sidebarToggleBtn && mapControls) {
        sidebarToggleBtn.addEventListener('click', function(e) { e.stopPropagation(); e.preventDefault(); mapControls.classList.toggle('retracted'); setTimeout(() => map.invalidateSize(), 350); });
        L.DomEvent.disableClickPropagation(sidebarToggleBtn); L.DomEvent.disableScrollPropagation(sidebarToggleBtn);
    }

    // Overlays prevent map event propagation
    setTimeout(() => {
        const bb = document.getElementById('bottom-slider-bar'); if (bb) { L.DomEvent.disableClickPropagation(bb); L.DomEvent.disableScrollPropagation(bb); }
        const hp = document.getElementById('help-panel'); if (hp) { L.DomEvent.disableClickPropagation(hp); L.DomEvent.disableScrollPropagation(hp); }
    }, 0);

    // Initialize map type UI
    selectMapType(TIME_SCALE);

}, 100);