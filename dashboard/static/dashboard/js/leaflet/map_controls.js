// ── DRAW CONTROL ─────────────────────────────────────────────────────────────
const drawnItems = new L.FeatureGroup().addTo(map);
const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems },
  draw: {
    polygon: { shapeOptions: { color: '#63b3ed', weight: 2 } },
    polyline: { shapeOptions: { color: '#68d391', weight: 3 } },
    rectangle: { shapeOptions: { color: '#f6ad55', weight: 2 } },
    circle: { shapeOptions: { color: '#fc8181', weight: 2 } },
    marker: false,   // we handle markers ourselves
    circlemarker: false,
  }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, e => {
  drawnItems.addLayer(e.layer);
  showToast('Shape added to map');
});


// ── CLICK → ADD MARKER ───────────────────────────────────────────────────────
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
      fill="#3182ce" stroke="#1a5276" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -38],
});

map.on('click', e => {
  const { lat, lng } = e.latlng;
  const id = ++markerIdSeq;
  const label = `Pin #${id}`;

  const marker = L.marker([lat, lng], { icon: pinIcon })
    .bindPopup(`
      <div class="popup-title">${label}</div>
      <div class="popup-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    `)
    .addTo(markerGroup);

  savedMarkers.push({ id, label, lat, lng, marker });
  renderMarkerList();
  showToast(`${label} added`);
});

// ── MARKER LIST ──────────────────────────────────────────────────────────────
function renderMarkerList() {
  const ul = document.getElementById('marker-list');
  const mc = document.getElementById('marker-count');
  mc.textContent = savedMarkers.length ? `(${savedMarkers.length})` : '';

  if (!savedMarkers.length) {
    ul.innerHTML = '<li class="empty-note">Click map to add markers</li>';
    return;
  }
  ul.innerHTML = savedMarkers.map(m =>
    `<li>
       <span class="loc-name" onclick="flyTo(${m.id})">📍 ${m.label}</span>
       <button onclick="removeMarker(${m.id})" title="Remove">✕</button>
     </li>`
  ).join('');
}

function flyTo(id) {
  const m = savedMarkers.find(x => x.id === id);
  if (m) { map.flyTo([m.lat, m.lng], 14); m.marker.openPopup(); }
}

function removeMarker(id) {
  const idx = savedMarkers.findIndex(x => x.id === id);
  if (idx === -1) return;
  markerGroup.removeLayer(savedMarkers[idx].marker);
  savedMarkers.splice(idx, 1);
  renderMarkerList();
}

// expose to inline onclick
window.flyTo = flyTo;
window.removeMarker = removeMarker;

// ── BASEMAP SWITCHER ─────────────────────────────────────────────────────────
let activeBasemap = 'osm';
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.layer;
    if (key === activeBasemap) return;
    map.removeLayer(tileLayers[activeBasemap]);
    tileLayers[key].addTo(map);
    tileLayers[key].bringToBack();
    activeBasemap = key;
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === key));
  });
});

// ── OVERLAY TOGGLES ──────────────────────────────────────────────────────────
document.getElementById('toggle-markers').addEventListener('change', e => {
  e.target.checked ? markerGroup.addTo(map) : map.removeLayer(markerGroup);
});

document.getElementById('toggle-grid').addEventListener('change', e => {
  if (e.target.checked) {
    gridLayer = buildDegreeGrid();
    gridLayer.addTo(map);
  } else if (gridLayer) {
    map.removeLayer(gridLayer);
    gridLayer = null;
  }
});

function buildDegreeGrid() {
  const lines = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    lines.push(L.polyline([[-90, lat], [90, lat]], { // oops swap later
      weight: .4, color: '#4a5568', dashArray: '4 6', opacity: .7
    }));
  }
  // lat lines
  for (let lat = -80; lat <= 80; lat += 10) {
    lines.push(L.polyline([[lat, -180], [lat, 180]], {
      weight: .4, color: '#4a5568', dashArray: '4 6', opacity: .7
    }));
  }
  // lng lines
  for (let lng = -180; lng <= 180; lng += 10) {
    lines.push(L.polyline([[-80, lng], [80, lng]], {
      weight: .4, color: '#4a5568', dashArray: '4 6', opacity: .7
    }));
  }
  return L.layerGroup(lines);
}

// ── GEOCODE SEARCH (Nominatim) ───────────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`)
    .then(r => r.json())
    .then(results => {
      const div = document.getElementById('search-results');
      if (!results.length) { div.innerHTML = '<p style="color:#fc8181;font-size:.8rem;">No results.</p>'; return; }
      div.innerHTML = results.map((r, i) =>
        `<div class="search-result-item"
              style="padding:.3rem .4rem;border-radius:5px;cursor:pointer;font-size:.8rem;color:#a0aec0;margin-top:.25rem;"
              onmouseover="this.style.background='#1e2a3a'" onmouseout="this.style.background=''"
              onclick="goToResult(${r.lat},${r.lon},'${r.display_name.replace(/'/g,"\\'")}')">
          📍 ${r.display_name.length > 50 ? r.display_name.slice(0,50)+'…' : r.display_name}
        </div>`
      ).join('');
    })
    .catch(() => showToast('Search failed'));
}

function goToResult(lat, lng, name) {
  map.flyTo([lat, lng], 13);
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
  showToast(`Flying to ${name.slice(0,40)}…`);
}
window.goToResult = goToResult;

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}