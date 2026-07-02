// ── LAYER GROUPS ─────────────────────────────────────────────────────────────
const markerGroup = L.layerGroup().addTo(map);
let gridLayer = null;
let savedMarkers = [];
let markerIdSeq = 0;
