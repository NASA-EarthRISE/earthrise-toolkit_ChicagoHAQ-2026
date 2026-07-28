// ── BASEMAP LAYERS ────────────────────────────────────────────────────
const tileLayers = {
osm: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
}),
};

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