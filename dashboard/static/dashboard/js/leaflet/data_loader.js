function loadLayer(mode){
    fetch (`/api/map-data/${mode}/`)
    .then(response => response.json())
    .then (data => {currentLayer.clearLayers();
        L.geoJSON(data).addTo(currentLayer);
    });
}

// GeoTiff Layer
// NOTE: This file calls the tiff file from Caitlyn's local computer. Currently working on calling it from the dashboard folder instead!
const geotiff_path = ("C:/Users/ccmcclan/.vscode/tempo_dashboard/dashboard/vertical_column_troposphere_CopyRaster2.tif");

async function loadGeoTiff(url){
  try {
    const arrayBuffer = await response.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);
    const layer = new GeoRasterLayer({georaster, resolution:256});

    layer.addTo(map)
    map.fitBounds(layer.getBounds());

    if (typeof url !== "string" || !url.toLowerCase().endsWith(".tif") && !url.toLowerCase().endsWith(".tiff")) { 
      throw new Error("Invalid TIFF URL. Must end with .tif or .tiff");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch TIFF: " + response.statusText);
    }

  }
  catch (error) { 
    document.getElementById("error-message").textContent = 
    "Error loading TIFF: " + error.message; console.error(error);
  }
}
// Call function with url given above
loadGeoTiff(geotiff_path);

mode="hourly"
mode = "daily"
mode = "monthly"