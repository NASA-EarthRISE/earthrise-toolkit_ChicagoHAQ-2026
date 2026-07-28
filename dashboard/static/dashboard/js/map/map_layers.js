// ──────────────────────────────────────────────────────────────────────────────
// map_layers.js — Color scales, layer rendering, legends
// Load order: time_utils.js → map_init.js → map_layers.js → data_loader.js → map_controls.js
// ──────────────────────────────────────────────────────────────────────────────

// ── COLOR SCALES ──────────────────────────────────────────────────────────────
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

// ── V4 RENDER FEATURES (Clarity Sensors) ─────────────────────────────────────
function renderFeatures(filteredFeatures, date) {
    filteredFeatures = filteredFeatures || [];
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
    } else if (TIME_SCALE === "daily") {
        displayTime = "Daily Average";
    } else {
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

// ── V4 COMMUNITY AREA RENDERING (Clarity) ────────────────────────────────────
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
        style: function (feature) {
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
        onEachFeature: function (feature, layer) {
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

// ── TEMPO COMMUNITY AREAS (hourly) ───────────────────────────────────────────
function drawTempoCommunityAreas(filteredFeatures) {
    filteredFeatures = filteredFeatures || [];
    if (!canRenderTempo("drawTempoCommunityAreas")) return;

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

        let point;
        try {
            point = turf.centroid(f);
        } catch (err) {
            return;
        }

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
        style: function (feature) {
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
        onEachFeature: function (feature, layer) {
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

// ── TEMPO RENDER FEATURES (hourly grid cells) ────────────────────────────────
function renderTempoFeatures(filteredFeatures, date) {
    filteredFeatures = filteredFeatures || [];
    if (!canRenderTempo("renderTempoFeatures")) return;

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
            onEachFeature: function (feature, layer) {
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

// ── TEMPO DAILY RENDER ───────────────────────────────────────────────────────
function renderDailyTempoData(data) {
    if (!canRenderTempo("renderDailyTempoData")) return;
    const newLayer = L.layerGroup();

    data.features.forEach(f => {
        let value = parseFloat(f.properties.vertical_column_troposphere);
        if (isNaN(value)) return;

        let geoJsonLayer = L.geoJSON(f, {
            style: {
                color: getColorTempo(value),
                fillColor: getColorTempo(value),
                weight: 0,
                fillOpacity: 0.77,
                opacity: 0.78
            }
        });

        newLayer.addLayer(geoJsonLayer);
    });

    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    currentLayer = newLayer;
    currentLayer.addTo(map);
    hideLoading();
}

// ── TEMPO MONTHLY RENDER ─────────────────────────────────────────────────────
function renderMonthlyTempoData(data, load) {
    if (!isActiveLoad(load)) {
        console.log("Blocked stale TEMPO monthly render");
        return;
    }

    if (currentDataProduct !== "tempo") {
        console.log("Blocked TEMPO monthly render because current product is:", currentDataProduct);
        return;
    }

    if (!currentLayer) {
        currentLayer = L.layerGroup().addTo(map);
    } else {
        currentLayer.clearLayers();
    }

    data.features.forEach(f => {
        let value = parseFloat(f.properties.vertical_column_troposphere);
        if (isNaN(value)) return;

        let geoJsonLayer = L.geoJSON(f, {
            style: {
                color: getColorTempo(value),
                fillColor: getColorTempo(value),
                weight: 0,
                fillOpacity: 0.77,
                opacity: 0.78
            }
        });

        currentLayer.addLayer(geoJsonLayer);
    });

    hideLoading();
}

// ── FUSION HELPERS ───────────────────────────────────────────────────────────
function getFusionValue(properties) {
    if (!properties) {
        return NaN;
    }
    return Number(properties.no2_estimate);
}

function renderFusionFeatures(features, labelText) {
    features = features || [];

    if (currentDataProduct !== "fusion") {
        console.log("Blocked Fusion render because current product is:", currentDataProduct);
        return false;
    }

    const newLayer = L.layerGroup();
    let renderedCount = 0;

    features.forEach(f => {
        const p = f.properties || {};
        const value = getFusionValue(p);

        if (isNaN(value)) {
            return;
        }

        let lat = Number(p.latitude);
        let lon = Number(p.longitude);

        if ((isNaN(lat) || isNaN(lon)) && f.geometry && f.geometry.coordinates) {
            if (f.geometry.type === "Polygon") {
                const coords = f.geometry.coordinates[0];
                if (coords && coords.length > 0) {
                    const lons = coords.map(c => Number(c[0]));
                    const lats = coords.map(c => Number(c[1]));
                    lon = lons.reduce((a, b) => a + b, 0) / lons.length;
                    lat = lats.reduce((a, b) => a + b, 0) / lats.length;
                }
            }
            if (f.geometry.type === "Point") {
                lon = Number(f.geometry.coordinates[0]);
                lat = Number(f.geometry.coordinates[1]);
            }
        }

        if (isNaN(lat) || isNaN(lon)) {
            return;
        }

        const gridCell = L.geoJSON(f, {
            style: {
                color: getColorClarity(value),
                fillColor: getColorClarity(value),
                weight: 0.5,
                opacity: 0.8,
                fillOpacity: 0.75
            },
            onEachFeature: function (feature, layer) {
                layer.bindTooltip(`
                    <b>Fusion Grid Cell</b><br>
                    ${labelText}<br>
                    NO₂ Estimate: ${value.toFixed(2)} ppb<br>
                    Lat: ${lat.toFixed(4)}<br>
                    Lon: ${lon.toFixed(4)}
                `);
            }
        });

        newLayer.addLayer(gridCell);
        renderedCount += 1;
    });

    if (renderedCount === 0) {
        return false;
    }

    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    if (communityLayer) {
        map.removeLayer(communityLayer);
        communityLayer = null;
    }

    currentLayer = newLayer;
    currentLayer.addTo(map);

    hideLoading();
    hideNoDataNotice();

    return true;
}

function renderFusionCommunityAreas(rows, labelText) {
    rows = rows || [];

    if (currentDataProduct !== "fusion") {
        return false;
    }

    if (!communityData || !communityData.features) {
        console.warn("Community boundary data not loaded yet.");
        return false;
    }

    if (rows.length === 0) {
        console.warn("No Fusion community rows for selected time.");
        return false;
    }

    const stats = {};

    rows.forEach(row => {
        const communityKey = normalizeCommunityName(row.community);
        const value = Number(row.no2_estimate_mean);
        const count = Number(row.grid_cell_count || 1);

        if (!communityKey || isNaN(value)) {
            return;
        }

        if (!stats[communityKey]) {
            stats[communityKey] = {
                displayName: row.community,
                weightedSum: 0,
                count: 0,
                min: Infinity,
                max: -Infinity,
            };
        }

        stats[communityKey].weightedSum += value * count;
        stats[communityKey].count += count;
        stats[communityKey].min = Math.min(stats[communityKey].min, value);
        stats[communityKey].max = Math.max(stats[communityKey].max, value);
    });

    const hasAnyCommunityData = Object.values(stats).some(s => s.count > 0);

    if (!hasAnyCommunityData) {
        console.warn("Fusion community stats were empty after grouping.");
        return false;
    }

    if (currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = null;
    }

    if (communityLayer) {
        map.removeLayer(communityLayer);
        communityLayer = null;
    }

    communityLayer = L.geoJSON(communityData, {
        style: function (feature) {
            const communityName = getCommunityFeatureName(feature);
            const communityKey = normalizeCommunityName(communityName);
            const s = stats[communityKey];

            let avg = null;

            if (s && s.count > 0) {
                avg = s.weightedSum / s.count;
            }

            return {
                color: "#222",
                weight: 1,
                fillColor: avg === null ? "transparent" : getColorClarity(avg),
                fillOpacity: avg === null ? 0 : 0.65,
            };
        },

        onEachFeature: function (feature, layer) {
            const communityName = getCommunityFeatureName(feature);
            const communityKey = normalizeCommunityName(communityName);
            const s = stats[communityKey];

            let avg = null;
            let count = 0;

            if (s && s.count > 0) {
                avg = s.weightedSum / s.count;
                count = s.count;
            }

            layer.bindTooltip(`
                <b>${communityName}</b><br>
                ${labelText}<br>
                Avg Fusion NO₂: ${avg === null ? "No Data" : avg.toFixed(2) + " ppb"}<br>
                Grid cells: ${count}
            `);
        }
    });

    communityLayer.addTo(map);
    hideLoading();
    hideNoDataNotice();

    return true;
}

// ── LEGEND ───────────────────────────────────────────────────────────────────
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

function updateIndividualModeLabel() {
    const label = document.getElementById('individual-mode-label');
    if (!label) {
        return;
    }

    if (currentDataProduct === "tempo") {
        label.textContent = " Individual Pixel";
    } else if (currentDataProduct === "fusion") {
        label.textContent = " Individual Grid Cell";
    } else {
        label.textContent = " Individual Sensor";
    }
}