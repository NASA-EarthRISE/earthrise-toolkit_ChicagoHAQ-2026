// ── MAP INIT ─────────────────────────────────────────────────────────────────
const map = L.map('map', {
  center: [41.52, -87.37],   // Chicago, IL default
  zoom: 10,
  layers: [tileLayers.osm],
  zoomControl: true,
});
