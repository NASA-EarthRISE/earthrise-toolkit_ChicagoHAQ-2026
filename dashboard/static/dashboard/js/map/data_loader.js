// ──────────────────────────────────────────────────────────────────────────────
// data_loader.js — Data fetching, date loading, caching
// Load order: time_utils.js → map_init.js → map_layers.js → data_loader.js → map_controls.js
// ──────────────────────────────────────────────────────────────────────────────

// ── CSV / COMMUNITY HELPERS ──────────────────────────────────────────────────

function parseSimpleCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(",");
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index].trim() : "";
        });
        return row;
    });
}

function normalizeCommunityName(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getCommunityFeatureName(feature) {
    const props = feature.properties || {};
    return (
        props.community ||
        props.COMMUNITY ||
        props.community_name ||
        props.name ||
        props.NAME ||
        "Unknown"
    );
}

// ── FUSION COMMUNITY CSV LOADER ─────────────────────────────────────────────

let fusioncommunityHourLookup = {};
let fusionCommunityRows = null;
let fusionCommunityPromise = null;

function loadFusionCommunityCSV() {
    if (fusionCommunityRows) return Promise.resolve(fusionCommunityRows);
    if (fusionCommunityPromise) return fusionCommunityPromise;

    fusionCommunityPromise = fetch("/data/fused/fused_hourly_by_community.csv")
        .then(r => {
            if (!r.ok) throw new Error("Could not load /data/fused/fused_hourly_by_community.csv");
            return r.text();
        })
        .then(text => {
            const rawRows = parseSimpleCSV(text);

            fusionCommunityRows = rawRows.map(row => {
                const timeString = row.time || row.datetime || row.timestamp || row.datetime_utc || "";
                const utcDate = TimeUtils.parseUTCString(timeString);
                let chicagoDate = null;
                let chicagoHour = null;

                if (utcDate) {
                    const parts = TimeUtils.getChicagoParts(utcDate);
                    chicagoDate = `${parts.year}-${parts.month}-${parts.day}`;
                    chicagoHour = Number(parts.hour);
                }

                return {
                    community_id: Number(row.community_id),
                    community: row.community,
                    time: row.time,
                    date: row.date,
                    hour: Number(row.hour),
                    _utc: utcDate,
                    _chicagoDate: chicagoDate,
                    _chicagoHour: chicagoHour,
                    no2_estimate_mean: Number(row.no2_estimate_mean),
                    no2_estimate_median: Number(row.no2_estimate_median),
                    no2_estimate_min: Number(row.no2_estimate_min),
                    no2_estimate_max: Number(row.no2_estimate_max),
                    grid_cell_count: Number(row.grid_cell_count || 0)
                };
            }).filter(r => r.community && r._chicagoDate && !isNaN(r._chicagoHour) && !isNaN(r.no2_estimate_mean));

            console.log("Loaded Fusion community rows:", fusionCommunityRows.length);

            fusioncommunityHourLookup = {};
            fusionCommunityRows.forEach(r => {
                const d = r._chicagoDate;
                const h = r._chicagoHour;
                if (!fusioncommunityHourLookup[d]) {
                    fusioncommunityHourLookup[d] = Array.from({ length: 24 }, () => []);
                }
                fusioncommunityHourLookup[d][h].push(r);
            });

            console.log("Built Fusion community lookup:", Object.keys(fusioncommunityHourLookup).length, "dates");
            return fusionCommunityRows;
        });

    return fusionCommunityPromise;
}

// ── HOUR BUCKETS / PREFETCH HELPERS ──────────────────────────────────────────

function buildHourBuckets(features) {
    let buckets = {};
    for (let h = 0; h < 24; h++) buckets[h] = [];
    features.forEach(f => { buckets[f._chicagoHour].push(f); });
    return buckets;
}

function prefetchNextDay(date) {
    let currentIndex = dates.indexOf(date);
    if (currentIndex < 0 || currentIndex >= dates.length - 1) return;

    let nextDate = dates[currentIndex + 1];
    if (nextCachedDate === nextDate) return;

    let requests = [];
    if (currentIndex > 0) {
        requests.push(fetch(`/data/clarity/${dates[currentIndex - 1]}.geojson`).then(r => r.ok ? r.json() : null));
    }
    requests.push(fetch(`/data/clarity/${nextDate}.geojson`).then(r => r.ok ? r.json() : null));
    if (currentIndex < dates.length - 2) {
        requests.push(fetch(`/data/clarity/${dates[currentIndex + 2]}.geojson`).then(r => r.ok ? r.json() : null));
    }

    Promise.all(requests).then(files => {
        if (currentDataProduct !== "clarity" || TIME_SCALE !== "hourly") return;

        let combinedFeatures = [];
        files.forEach(data => { if (data) combinedFeatures.push(...data.features); });

        let filteredFeatures = combinedFeatures.filter(f => {
            const dateHour = TimeUtils.extractChicagoDateHour(f.properties);
            if (!dateHour) return false;
            f._chicagoHour = dateHour.hour;
            return dateHour.date === nextDate;
        });

        nextCachedDate = nextDate;
        nextCachedHourBuckets = buildHourBuckets(filteredFeatures);
        console.log("Prefetched:", nextDate);
    });
}

function prefetchTempoNextDay(date) {
    let currentIndex = dates.indexOf(date);
    if (currentIndex < 0 || currentIndex >= dates.length - 1) return;

    let nextDate = dates[currentIndex + 1];
    if (nextCachedDate === nextDate) return;

    let requests = [];
    if (currentIndex > 0) {
        requests.push(fetch(`/data/tempo/${dates[currentIndex - 1]}.geojson`).then(r => r.ok ? r.json() : null));
    }
    requests.push(fetch(`/data/tempo/${nextDate}.geojson`).then(r => r.ok ? r.json() : null));
    if (currentIndex < dates.length - 2) {
        requests.push(fetch(`/data/tempo/${dates[currentIndex + 2]}.geojson`).then(r => r.ok ? r.json() : null));
    }

    Promise.all(requests).then(files => {
        if (currentDataProduct !== "tempo" || TIME_SCALE !== "hourly") return;

        let combinedFeatures = [];
        files.forEach(data => { if (data) combinedFeatures.push(...data.features); });

        let filteredFeatures = combinedFeatures.filter(f => {
            const dateHour = TimeUtils.extractChicagoDateHour(f.properties);
            if (!dateHour) return false;
            f._chicagoHour = dateHour.hour;
            return dateHour.date === nextDate;
        });

        nextCachedDate = nextDate;
        nextCachedHourBuckets = buildHourBuckets(filteredFeatures);
        console.log("TEMPO Prefetched:", nextDate);
    });
}

// ── REMOVE INVALID HOURLY DATE ───────────────────────────────────────────────

function removeInvalidHourlyDate(date, reason) {
    if (!date || TIME_SCALE !== "hourly" || currentDataProduct !== "clarity") return;
    if (invalidClarityHourlyDates.has(date)) return;

    invalidClarityHourlyDates.add(date);
    console.warn("Removing invalid hourly Clarity date from slider:", { date, reason });

    const oldIndex = dates.indexOf(date);
    dates = dates.filter(d => d !== date);
    allDates = allDates.filter(d => d !== date);

    const dateSlider = document.getElementById("dateSlider");
    if (!dateSlider) return;

    if (!dates || dates.length === 0) {
        dateSlider.min = 0;
        dateSlider.max = 0;
        dateSlider.value = 0;
        const dateLabel = document.getElementById("dateLabel");
        const timeLabel = document.getElementById("timeLabel");
        if (dateLabel) dateLabel.innerHTML = "No valid dates available";
        if (timeLabel) timeLabel.innerHTML = "";
        hideLoading();
        return;
    }

    const nextIndex = Math.min(Math.max(oldIndex, 0), dates.length - 1);
    dateSlider.min = 0;
    dateSlider.max = dates.length - 1;
    dateSlider.value = nextIndex;

    const nextDate = dates[nextIndex];
    updateDateAndTimeLabels(nextDate);

    cachedDate = null;
    cachedFeatures = null;
    cachedHourBuckets = null;
    nextCachedDate = null;
    nextCachedHourBuckets = null;

    loadDate(nextDate);
}

// ── FUSION VALUE HELPER ──────────────────────────────────────────────────────

function getFusionValue(properties) {
    if (!properties) return NaN;
    return Number(properties.no2_estimate);
}

// ── FUSION NO DATA MESSAGE ───────────────────────────────────────────────────

function showFusionNoDataMessage(date, detailText) {
    hideLoading();
    if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
    if (communityLayer) { map.removeLayer(communityLayer); communityLayer = null; }

    const label = TIME_SCALE === "monthly" ? formatMonthForDisplay(date) : utcDateToCentralPretty(date);
    const detailParts = [];
    if (label) detailParts.push(label);
    if (detailText) detailParts.push(detailText);

    showNoDataNotice("No Fusion Data Available", detailParts.join(" • "));
}

// ── FUSION DATA LOADERS ──────────────────────────────────────────────────────

function loadFusionHourly(date, existingLoad) {
    const load = existingLoad || startNewLoad("fusion");
    if (!isActiveLoad(load)) return;

    fetch(`/data/fused/${date}.geojson`)
        .then(r => {
            if (!r.ok) throw new Error(`Missing Fusion hourly file: ${date}`);
            return r.json();
        })
        .then(data => {
            if (!isActiveLoad(load)) return;

            const features = data && data.features ? data.features : [];
            const filteredFeatures = features.filter(f => {
                const p = f.properties || {};
                const timeString = p.time || p.datetime || p.datetime_local || p.timestamp || "";
                if (!timeString) return false;

                const utcDate = TimeUtils.parseUTCString(timeString);
                if (!utcDate) return false;

                const utcDateStr = utcDate.toISOString().split('T')[0];
                const chicagoParts = TimeUtils.getChicagoParts(utcDate);
                const hour = Number(chicagoParts.hour);

                return utcDateStr === date && hour === selectedHour;
            });

            const hasValidData = filteredFeatures.some(f => !isNaN(getFusionValue(f.properties || {})));

            if (!hasValidData) {
                showFusionNoDataMessage(date, `Time: ${formatHourForDisplay(date, selectedHour)}`);
                return;
            }

            const rendered = renderFusionFeatures(
                filteredFeatures,
                `Time: ${formatHourForDisplay(date, selectedHour)}`
            );

            if (!rendered) {
                showFusionNoDataMessage(date, `Time: ${formatHourForDisplay(date, selectedHour)}`);
            }
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load Fusion hourly file:", err);
            showFusionNoDataMessage(date, `Time: ${formatHourForDisplay(date, selectedHour)}`);
        });
}

function loadFusionDaily(date, existingLoad) {
    const dailyKey = toDailyKey(date);
    if (!dailyKey) { console.warn("Blocked invalid Fusion daily load:", date); return; }

    const load = existingLoad || startNewLoad("fusion");
    if (!isActiveLoad(load)) return;

    fetch(`/data/fused/day_${dailyKey}.geojson`)
        .then(r => {
            if (!r.ok) throw new Error(`Missing Fusion daily file: ${dailyKey}`);
            return r.json();
        })
        .then(data => {
            if (!isActiveLoad(load)) return;
            const rendered = renderFusionFeatures(data.features || [], "Daily Average");
            if (!rendered) showFusionNoDataMessage(date, "Daily Average");
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load Fusion daily file:", err);
            showFusionNoDataMessage(date, "Daily Average");
        });
}

function loadFusionMonthly(month, existingLoad) {
    month = toMonthKey(month);
    if (!isMonthlyDate(month)) { console.warn("Blocked invalid Fusion monthly load:", month); return; }

    const load = existingLoad || startNewLoad("fusion");
    if (!isActiveLoad(load)) return;

    fetch(`/data/fused/month_${month}.geojson`)
        .then(r => {
            if (!r.ok) throw new Error(`Missing Fusion monthly file: ${month}`);
            return r.json();
        })
        .then(data => {
            if (!isActiveLoad(load)) return;
            const rendered = renderFusionFeatures(data.features || [], "Monthly Average");
            if (!rendered) showFusionNoDataMessage(month, "Monthly Average");
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load Fusion monthly file:", err);
            showFusionNoDataMessage(month, "Monthly Average");
        });
}

function loadFusionCommunities(date, existingLoad) {
    const load = existingLoad || startNewLoad("fusion");
    if (!isActiveLoad(load)) return;

    loadFusionCommunityCSV()
        .then(() => {
            if (!isActiveLoad(load)) return;

            let filteredRows = [];
            let labelText = "";

            if (TIME_SCALE === "hourly") {
                const bucket = fusioncommunityHourLookup[date] && fusioncommunityHourLookup[date][selectedHour];
                filteredRows = bucket || [];
                labelText = `Time: ${formatHourForDisplay(date, selectedHour)}`;
            } else if (TIME_SCALE === "daily") {
                const buckets = fusioncommunityHourLookup[date];
                filteredRows = buckets ? buckets.flat() : [];
                labelText = "Daily Average";
            } else if (TIME_SCALE === "monthly") {
                const monthKey = toMonthKey(date);
                const matchedDates = Object.keys(fusioncommunityHourLookup).filter(d => d.startsWith(monthKey));
                filteredRows = matchedDates.flatMap(d => fusioncommunityHourLookup[d].flat());
                labelText = "Monthly Average";
            }

            const rendered = renderFusionCommunityAreas(filteredRows, labelText);
            if (!rendered) showFusionNoDataMessage(date, labelText);
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Fusion community load failed:", err);
            showFusionNoDataMessage(date, "Community Area");
        });
}

// ── CLARITY DATA LOADERS ─────────────────────────────────────────────────────

function loadDailySensors(date, existingLoad) {
    const dailyKey = toDailyKey(date);
    if (!dailyKey) { console.warn("Blocked daily sensor load. daily_sensor requires YYYY-MM-DD, got:", date); return; }

    const load = existingLoad || startNewLoad("clarity");
    if (!isActiveLoad(load)) return;

    fetch(`/data/clarity/daily_sensor_${dailyKey}.geojson`)
        .then(r => {
            if (!r.ok) throw new Error(`Missing daily sensor file: ${dailyKey}`);
            return r.json();
        })
        .then(data => {
            if (!isActiveLoad(load)) return;
            if (currentLayer) { map.removeLayer(currentLayer); }

            currentLayer = L.layerGroup();
            data.features.forEach(f => {
                let p = f.properties;
                let avg = parseFloat(p.avg_no2);
                let marker = L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
                    radius: 6, fillColor: getColor(avg), color: "#222", weight: 1, fillOpacity: 0.9
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
            if (!isActiveLoad(load)) return;
            console.error("Could not load daily sensor file:", err);
        });
}

function loadMonthlySensors(month, existingLoad) {
    month = toMonthKey(month);
    if (!isMonthlyDate(month)) { console.warn("Blocked invalid monthly sensor load. Expected YYYY-MM, got:", month); return; }

    const load = existingLoad || startNewLoad("clarity");
    if (!isActiveLoad(load)) return;

    fetch(`/data/clarity/monthly_sensor_${month}.geojson`)
        .then(r => {
            if (!r.ok) throw new Error(`Missing monthly sensor file: ${month}`);
            return r.json();
        })
        .then(data => {
            if (!isActiveLoad(load)) return;
            if (currentLayer) { map.removeLayer(currentLayer); }

            currentLayer = L.layerGroup();
            data.features.forEach(f => {
                let p = f.properties;
                let avg = parseFloat(p.avg_no2);
                let marker = L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
                    radius: 6, fillColor: getColor(avg), color: "#222", weight: 1, fillOpacity: 0.9
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
            if (!isActiveLoad(load)) return;
            console.error("Could not load monthly sensor file:", err);
        });
}

function loadDailyCommunities(date, existingLoad) {
    const load = existingLoad || startNewLoad("clarity");
    if (!isActiveLoad(load)) return;

    fetch(`/data/clarity/daily_community_${date}.geojson`)
        .then(r => r.json())
        .then(data => {
            if (!isActiveLoad(load)) return;
            if (communityLayer) { map.removeLayer(communityLayer); }

            communityLayer = L.geoJSON(data, {
                style: function(feature) {
                    let raw = feature.properties.avg_no2;
                    let avg = raw === null || raw === "" ? null : Number(raw);
                    return {
                        color: "#222", weight: 1,
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
            if (!isActiveLoad(load)) return;
            console.error("Could not load daily community file:", err);
        });
}

function loadMonthlyCommunities(month, existingLoad) {
    const load = existingLoad || startNewLoad("clarity");
    if (!isActiveLoad(load)) return;

    fetch(`/data/clarity/monthly_community_${month}.geojson`)
        .then(r => r.json())
        .then(data => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale Clarity monthly community load:", month); return; }
            if (communityLayer) { map.removeLayer(communityLayer); }

            communityLayer = L.geoJSON(data, {
                style: function(feature) {
                    let raw = feature.properties.avg_no2;
                    let avg = raw === null || raw === "" ? null : Number(raw);
                    return {
                        color: "#222", weight: 1,
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
            if (!isActiveLoad(load)) return;
            console.error("Could not load monthly community file:", err);
        });
}

// ── CLARITY DATE RANGE ───────────────────────────────────────────────────────

function loadDateRange() {
    if (!timeInterval) {
        showLoading(`Loading ${utcDateToCentralPretty(rangeStartDate)} to ${utcDateToCentralPretty(rangeCurrentEndDate)}`);
    }

    let selectedDates = dates.filter(d => d >= rangeStartDate && d <= rangeCurrentEndDate);
    let filePrefix = displayMode === "community" ? "daily_community" : "daily_sensor";

    Promise.all(selectedDates.map(date => fetch(`/data/clarity/${filePrefix}_${date}.geojson`).then(r => r.json())))
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
                        grouped[sensor] = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], sum: 0, count: 0 };
                    }
                    if (!isNaN(avg)) { grouped[sensor].sum += avg; grouped[sensor].count++; }
                });
            });

            if (currentLayer) { map.removeLayer(currentLayer); }
            currentLayer = L.layerGroup();

            Object.keys(grouped).forEach(sensor => {
                let g = grouped[sensor];
                if (g.count === 0) return;
                let avg = g.sum / g.count;
                let marker = L.circleMarker([g.lat, g.lon], {
                    radius: 6, fillColor: getColor(avg), color: "#222", weight: 1, fillOpacity: 0.9
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

            if (!stats[name]) stats[name] = { sum: 0, count: 0 };
            if (!isNaN(avg)) { stats[name].sum += avg * measurements; stats[name].count += measurements; }
        });
    });

    if (communityLayer) { map.removeLayer(communityLayer); }

    communityLayer = L.geoJSON(communityData, {
        style: function(feature) {
            let props = feature.properties;
            let name = props.community || props.COMMUNITY || props.community_name || props.name;
            let avg = null;
            if (stats[name] && stats[name].count > 0) avg = stats[name].sum / stats[name].count;
            return {
                color: "#222", weight: 1,
                fillColor: avg === null ? "transparent" : getColor(avg),
                fillOpacity: avg === null ? 0 : 0.65
            };
        },
        onEachFeature: function(feature, layer) {
            let props = feature.properties;
            let name = props.community || props.COMMUNITY || props.community_name || props.name;
            let avg = null;
            let totalCount = 0;
            if (stats[name]) { totalCount = stats[name].count; if (totalCount > 0) avg = stats[name].sum / totalCount; }
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

// ── TEMPO DATA LOADERS ───────────────────────────────────────────────────────

function formatCentralTimePretty(utcString) {
    return TimeUtils.formatCentralTime(utcString);
}

function loadDailyTempo(date, existingLoad) {
    const load = existingLoad || startNewLoad("tempo");
    if (!isActiveLoad(load)) return;
    if (!canRenderTempo("loadDailyTempo")) return;

    if (tempoDailyCache[date]) {
        if (!isActiveLoad(load)) return;
        renderDailyTempoData(tempoDailyCache[date]);
        return;
    }

    fetch(`/data/tempo/day_${date}.geojson`)
        .then(r => { if (!r.ok) return null; return r.json(); })
        .then(data => {
            if (!isActiveLoad(load)) return;
            if (!canRenderTempo("loadDailyTempo.then")) return;
            if (!data || !data.features) return;

            tempoDailyCache[date] = data;
            renderDailyTempoData(data);
        });
}

function loadMonthlyTempo(month, existingLoad) {
    const load = existingLoad || startNewLoad("tempo");
    if (!isActiveLoad(load)) return;

    if (tempoMonthlyCache[month]) {
        if (!isActiveLoad(load)) return;
        renderMonthlyTempoData(tempoMonthlyCache[month], load);
        return;
    }

    fetch(`/data/tempo/month_${month}.geojson`)
        .then(r => r.json())
        .then(data => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale TEMPO monthly load:", month); return; }
            if (!data || !data.features) return;

            tempoMonthlyCache[month] = data;
            renderMonthlyTempoData(data, load);
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load TEMPO monthly file:", err);
        });
}

function loadTempoDailyCommunities(date) {
    if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }

    fetch(`/data/tempo/day_community_${date}.geojson`)
        .then(r => { if (!r.ok) return null; return r.json(); })
        .then(data => {
            if (!data || !data.features || data.features.length === 0) {
                if (communityLayer) { map.removeLayer(communityLayer); communityLayer = null; }
                hideLoading();
                showLoading(`No Data Available<br>${utcDateToCentralPretty(date)}`);
                return;
            }

            if (communityLayer) { map.removeLayer(communityLayer); }

            communityLayer = L.geoJSON(data, {
                style: function(feature) {
                    let raw = feature.properties.vertical_column_troposphere;
                    let avg = raw === null || raw === "" ? null : Number(raw);
                    return {
                        color: "#222", weight: 1,
                        fillColor: avg === null ? "transparent" : getColorTempo(avg),
                        fillOpacity: avg === null ? 0 : 0.65
                    };
                },
                onEachFeature: function(feature, layer) {
                    let p = feature.properties;
                    layer.bindTooltip(`
                        <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                        Avg NO₂: ${p.vertical_column_troposphere == null ? "No Data" : Number(p.vertical_column_troposphere).toExponential(2)}
                    `);
                }
            });

            communityLayer.addTo(map);
            hideLoading();
        })
        .catch(err => { console.warn("No TEMPO community data for", date); });
}

function loadTempoMonthlyCommunities(month, existingLoad) {
    const load = existingLoad || startNewLoad("tempo");
    if (!isActiveLoad(load)) return;
    if (!canRenderTempo("loadTempoMonthlyCommunities")) return;

    if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }

    fetch(`/data/tempo/monthly_community_${month}.geojson`)
        .then(r => r.json())
        .then(data => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale TEMPO monthly community load:", month); return; }
            if (!canRenderTempo("loadTempoMonthlyCommunities.then")) return;

            if (communityLayer) { map.removeLayer(communityLayer); }

            communityLayer = L.geoJSON(data, {
                style: function(feature) {
                    let raw = feature.properties.vertical_column_troposphere;
                    let avg = raw === null || raw === "" ? null : Number(raw);
                    return {
                        color: "#222", weight: 1,
                        fillColor: avg === null ? "transparent" : getColorTempo(avg),
                        fillOpacity: avg === null ? 0 : 0.65
                    };
                },
                onEachFeature: function(feature, layer) {
                    let p = feature.properties;
                    layer.bindTooltip(`
                        <b>${p.community || p.COMMUNITY || p.community_name || p.name}</b><br>
                        Avg NO₂: ${p.vertical_column_troposphere == null ? "No Data" : Number(p.vertical_column_troposphere).toExponential(2)}
                    `);
                }
            });

            communityLayer.addTo(map);
            hideLoading();
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load TEMPO monthly community file:", err);
        });
}

// ── TEMPO DATE RANGE ─────────────────────────────────────────────────────────

function loadTempoDateRange() {
    if (!timeInterval) {
        showLoading(`Loading ${utcDateToCentralPretty(rangeStartDate)} to ${utcDateToCentralPretty(rangeCurrentEndDate)}`);
    }

    let selectedDates = rangeDates.length > 0 ? rangeDates : dates.filter(d => d >= rangeStartDate && d <= rangeCurrentEndDate);

    Promise.all(selectedDates.map(date =>
        fetch(`/data/tempo/day_${date}.geojson`).then(r => {
            if (!r.ok) { console.warn("Missing TEMPO daily file:", date); return null; }
            return r.json();
        })
    ))
    .then(files => {
        files = files.filter(f => f !== null);
        if (files.length === 0) { console.warn("No TEMPO daily files found in range."); hideLoading(); return; }

        let cellStats = {};
        files.forEach(data => {
            data.features.forEach(f => {
                let value = Number(f.properties.vertical_column_troposphere);
                if (isNaN(value)) return;
                let key = JSON.stringify(f.geometry);
                if (!cellStats[key]) cellStats[key] = { feature: structuredClone(f), sum: 0, count: 0 };
                cellStats[key].sum += value;
                cellStats[key].count++;
            });
        });

        if (currentLayer) { map.removeLayer(currentLayer); }
        currentLayer = L.layerGroup();

        Object.values(cellStats).forEach(cell => {
            let avg = cell.sum / cell.count;
            cell.feature.properties.vertical_column_troposphere = avg;
            let geoJsonLayer = L.geoJSON(cell.feature, {
                style: {
                    color: getColorTempo(avg), fillColor: getColorTempo(avg),
                    weight: 0, fillOpacity: 0.77, opacity: 0.78
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
    .catch(err => { console.error("TEMPO date range load failed:", err); });
}

function loadTempoCommunityDateRange() {
    if (!timeInterval) {
        showLoading(`Loading ${utcDateToCentralPretty(rangeStartDate)} to ${utcDateToCentralPretty(rangeCurrentEndDate)}`);
    }

    let selectedDates = rangeDates.length > 0 ? rangeDates : dates.filter(d => d >= rangeStartDate && d <= rangeCurrentEndDate);

    Promise.all(selectedDates.map(date =>
        fetch(`/data/tempo/day_community_${date}.geojson`).then(r => { if (!r.ok) return null; return r.json(); })
    ))
    .then(files => {
        files = files.filter(f => f !== null);
        if (files.length === 0) { hideLoading(); return; }

        let stats = {};
        files.forEach(data => {
            data.features.forEach(f => {
                let community = f.properties.community;
                let value = Number(f.properties.vertical_column_troposphere);
                if (isNaN(value)) return;
                if (!stats[community]) stats[community] = { sum: 0, count: 0 };
                stats[community].sum += value;
                stats[community].count++;
            });
        });

        if (communityLayer) { map.removeLayer(communityLayer); }

        communityLayer = L.geoJSON(communityData, {
            style: function(feature) {
                let community = feature.properties.community;
                let avg = null;
                if (stats[community]) avg = stats[community].sum / stats[community].count;
                return {
                    color: "#222", weight: 1,
                    fillColor: avg == null ? "transparent" : getColorTempo(avg),
                    fillOpacity: avg == null ? 0 : 0.65
                };
            },
            onEachFeature: function(feature, layer) {
                let community = feature.properties.community;
                let avg = null;
                let count = 0;
                if (stats[community]) { avg = stats[community].sum / stats[community].count; count = stats[community].count; }
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
    .catch(err => { console.error("TEMPO community range load failed:", err); });
}

// ── UNIFIED LOAD DATE ────────────────────────────────────────────────────────

function loadDate(date, existingLoad) {
    if (!date || typeof date !== "string") {
        console.warn("Blocked loadDate because date is invalid:", date);
        hideLoading();
        return;
    }

    const load = existingLoad || startNewLoad(currentDataProduct);
    const productAtStart = load.product;

    if (!isActiveLoad(load)) return;

    console.log("Loading:", date, "Product:", productAtStart, "Current Product:", currentDataProduct,
        "Display:", displayMode, "Aggregation:", TIME_SCALE, "Load token:", load.id);

    let loadingText;
    if (TIME_SCALE === "monthly") loadingText = `Loading ${formatMonthForDisplay(date)}`;
    else if (TIME_SCALE === "daily") loadingText = `Loading ${utcDateToCentralPretty(date)}`;
    else loadingText = `Loading ${utcDateToCentralPretty(date)} • ${formatHourForDisplay(date, selectedHour)}`;

    if (!(TIME_SCALE === "hourly" && cachedDate === date) && !timeInterval) {
        showLoading(loadingText);
    }

    let currentIndex = dates.indexOf(date);
    let prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
    let nextDate = currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;
    let selectedMonth = date.substring(0, 7);

    // ── TEMPO ROUTING ──
    if (productAtStart === "tempo") {
        if (TIME_SCALE === "range") {
            if (displayMode === "community") loadTempoCommunityDateRange();
            else loadTempoDateRange();
            return;
        }
        if (TIME_SCALE === "daily") {
            if (displayMode === "community") loadTempoDailyCommunities(date);
            else loadDailyTempo(date, load);
            return;
        }
        if (TIME_SCALE === "monthly") {
            if (displayMode === "community") loadTempoMonthlyCommunities(selectedMonth, load);
            else loadMonthlyTempo(selectedMonth, load);
            return;
        }
        if (TIME_SCALE === "hourly" && cachedDate === date && cachedHourBuckets) {
            if (displayMode === "community") drawTempoCommunityAreas(cachedFeatures);
            else renderTempoFeatures(cachedHourBuckets[selectedHour], date);
            return;
        }

        let tRequests = [];
        if (prevDate) tRequests.push(fetch(`/data/tempo/${prevDate}.geojson`).then(r => r.ok ? r.json() : null));
        tRequests.push(fetch(`/data/tempo/${date}.geojson`).then(r => r.ok ? r.json() : null));
        if (nextDate) tRequests.push(fetch(`/data/tempo/${nextDate}.geojson`).then(r => r.ok ? r.json() : null));

        Promise.all(tRequests).then(files => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale TEMPO hourly load:", date); return; }

            let combinedFeatures = [];
            files.forEach(data => { if (data) combinedFeatures.push(...data.features); });

            let filteredFeatures = combinedFeatures.filter(f => {
                const dateHour = TimeUtils.extractChicagoDateHour(f.properties);
                if (!dateHour) return false;
                f._chicagoHour = dateHour.hour;
                return dateHour.date === date;
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
                showNoDataNotice("No TEMPO Data Available", `No data for ${utcDateToCentralPretty(date)}.`);
                return;
            }

            if (displayMode === "community") drawTempoCommunityAreas(filteredFeatures);
            else if (TIME_SCALE === "hourly") renderTempoFeatures(cachedHourBuckets[selectedHour], date);
            else renderTempoFeatures(filteredFeatures, date);
        });
        return;
    }

    // ── FUSION ROUTING ──
    if (productAtStart === "fusion") {
        if (displayMode === "community") { loadFusionCommunities(date, load); return; }
        if (TIME_SCALE === "hourly") { loadFusionHourly(date, load); return; }
        if (TIME_SCALE === "daily") { loadFusionDaily(date, load); return; }
        if (TIME_SCALE === "monthly") { loadFusionMonthly(selectedMonth, load); return; }
        console.warn("Unsupported Fusion TIME_SCALE:", TIME_SCALE);
        hideLoading();
        return;
    }

    // ── CLARITY ROUTING ──
    if (TIME_SCALE === "range") { loadDateRange(); return; }
    if (TIME_SCALE === "daily") {
        if (displayMode === "sensor") loadDailySensors(date, load);
        else if (displayMode === "community") loadDailyCommunities(date, load);
        return;
    }
    if (TIME_SCALE === "monthly") {
        if (displayMode === "sensor") loadMonthlySensors(date, load);
        else if (displayMode === "community") loadMonthlyCommunities(toMonthKey(date), load);
        return;
    }
    if (TIME_SCALE === "hourly" && cachedDate === date && cachedHourBuckets) {
        renderFeatures(cachedHourBuckets[selectedHour], date);
        return;
    }

    let requests = [];
    if (prevDate) requests.push(fetch(`/data/clarity/${prevDate}.geojson`).then(r => r.ok ? r.json() : null));
    requests.push(fetch(`/data/clarity/${date}.geojson`).then(r => r.ok ? r.json() : null));
    if (nextDate) requests.push(fetch(`/data/clarity/${nextDate}.geojson`).then(r => r.ok ? r.json() : null));

    Promise.all(requests).then(files => {
        if (!isActiveLoad(load)) { console.log("Ignoring stale Clarity hourly load:", date); return; }

        let combinedFeatures = [];
        files.forEach(data => { if (data) combinedFeatures.push(...data.features); });

        let filteredFeatures = combinedFeatures.filter(f => {
            const dateHour = TimeUtils.extractChicagoDateHour(f.properties);
            if (!dateHour) return false;
            f._chicagoHour = dateHour.hour;
            return dateHour.date === date;
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
            if (TIME_SCALE === "hourly" && currentDataProduct === "clarity") {
                removeInvalidHourlyDate(date, "No valid filtered features");
                return;
            }
            showNoDataNotice("No OpenAir Data Available", `No sensor data for ${utcDateToCentralPretty(date)}.`);
            return;
        }

        if (TIME_SCALE === "hourly") renderFeatures(cachedHourBuckets[selectedHour], date);
        else renderFeatures(filteredFeatures, date);
    });
}

// ── DATE LOADING FUNCTIONS ───────────────────────────────────────────────────

function generateClarityDatesFromFiles() {
    const fallbackDates = [];
    const start = new Date(2025, 8, 1);
    const end = new Date(2026, 3, 31);
    const current = new Date(start);
    while (current <= end) {
        fallbackDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    console.log("Using fallback date range:", fallbackDates[0], "to", fallbackDates[fallbackDates.length - 1]);
    return fallbackDates;
}

function loadClarityDates() {
    invalidClarityHourlyDates = new Set();
    const load = startNewLoad("clarity");
    if (!isActiveLoad(load)) return;

    fetch("/data/clarity/dates.json")
        .then(r => {
            if (!r.ok) throw new Error("Could not load /data/clarity/dates.json");
            return r.json();
        })
        .then(response => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale Clarity dates load"); return; }

            let loadedDates = Array.isArray(response) ? response : (response.dates || []);

            if (!loadedDates || loadedDates.length === 0) {
                console.warn("No Clarity dates found in API response, generating fallback dates.");
                loadedDates = generateClarityDatesFromFiles();
            }

            if (TIME_SCALE === "monthly") {
                loadedDates = [...new Set(loadedDates.map(d => d.substring(0, 7)))].filter(month => month !== "2026-06");
            }

            dates = loadedDates;
            allDates = loadedDates;

            if (!dates || dates.length === 0) { console.warn("No usable Clarity dates."); hideLoading(); return; }

            rangeStartDate = dates[0];
            rangeEndDate = dates[dates.length - 1];
            rangeCurrentEndDate = rangeEndDate;

            const dateSlider = document.getElementById("dateSlider");
            const startDateInput = document.getElementById("startDate");
            const endDateInput = document.getElementById("endDate");

            if (dateSlider) { dateSlider.min = 0; dateSlider.max = dates.length - 1; dateSlider.value = 0; }
            if (startDateInput) startDateInput.value = TIME_SCALE === "monthly" ? "" : rangeStartDate;
            if (endDateInput) endDateInput.value = TIME_SCALE === "monthly" ? "" : rangeEndDate;

            selectedHour = Number(document.getElementById("timeSlider")?.value || 0);
            updateDateAndTimeLabels(dates[0]);
            updateBottomControlVisibility();

            cachedDate = null; cachedFeatures = null; cachedHourBuckets = null;
            nextCachedDate = null; nextCachedHourBuckets = null;

            console.log("Loaded Clarity dates:", { timeScale: TIME_SCALE, count: dates.length, first: dates[0], last: dates[dates.length - 1] });
            applyPreferredDateAndHourAfterDateLoad(load);
        })
        .catch(err => {
            console.error("Could not load Clarity dates.json:", err);
            if (!isActiveLoad(load)) return;

            dates = generateClarityDatesFromFiles();
            allDates = dates;

            if (!dates || dates.length === 0) { hideLoading(); return; }

            rangeStartDate = dates[0];
            rangeEndDate = dates[dates.length - 1];
            rangeCurrentEndDate = rangeEndDate;

            const dateSlider = document.getElementById("dateSlider");
            if (dateSlider) { dateSlider.min = 0; dateSlider.max = dates.length - 1; dateSlider.value = 0; }

            selectedHour = Number(document.getElementById("timeSlider")?.value || 0);
            applyPreferredDateAndHourAfterDateLoad(load);
        });
}

function loadTempoDates() {
    const load = startNewLoad("tempo");
    if (!isActiveLoad(load)) return;

    let datesFile;
    if (TIME_SCALE === "daily") datesFile = "/data/tempo/TEMPOdaily_dates.json";
    else if (TIME_SCALE === "monthly") datesFile = "/data/tempo/TEMPOdaily_dates.json";
    else datesFile = "/data/tempo/TEMPOdates.json";

    fetch(datesFile)
        .then(r => r.json())
        .then(response => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale TEMPO dates load"); return; }

            let loadedDates = Array.isArray(response) ? response : (response.dates || []);

            if (TIME_SCALE === "monthly") {
                loadedDates = [...new Set(loadedDates.map(d => d.substring(0, 7)))];
            }

            if (!loadedDates || loadedDates.length === 0) {
                console.warn("No TEMPO dates found in API response, generating fallback dates.");
                loadedDates = generateClarityDatesFromFiles();
            }

            dates = [...loadedDates];
            allDates = [...loadedDates];
            rangeStartDate = dates[0];
            rangeEndDate = dates[dates.length - 1];
            rangeCurrentEndDate = rangeEndDate;

            const dateSlider = document.getElementById("dateSlider");
            const dateLabel = document.getElementById("dateLabel");
            const startDateInput = document.getElementById("startDate");
            const endDateInput = document.getElementById("endDate");

            if (startDateInput) startDateInput.value = rangeStartDate;
            if (endDateInput) endDateInput.value = rangeEndDate;
            if (dateSlider) { dateSlider.max = dates.length - 1; dateSlider.value = 0; }

            if (TIME_SCALE === "monthly") { if (dateLabel) dateLabel.innerHTML = formatMonthForDisplay(dates[0]); }
            else { if (dateLabel) dateLabel.innerHTML = utcDateToCentralPretty(dates[0]); }

            const timeLabel = document.getElementById("timeLabel");
            if (timeLabel && TIME_SCALE === "hourly") timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;
            else if (timeLabel) timeLabel.innerHTML = "";

            cachedDate = null; cachedFeatures = null; cachedHourBuckets = null;
            nextCachedDate = null; nextCachedHourBuckets = null;

            applyPreferredDateAndHourAfterDateLoad(load);
        })
        .catch(err => {
            console.error("Could not load TEMPO dates.json:", err);
            if (!isActiveLoad(load)) return;

            dates = generateClarityDatesFromFiles();
            allDates = dates;

            if (dates.length > 0) {
                rangeStartDate = dates[0];
                rangeEndDate = dates[dates.length - 1];
                rangeCurrentEndDate = rangeEndDate;

                const dateSlider = document.getElementById("dateSlider");
                dateSlider.max = dates.length - 1;
                dateSlider.value = 0;
                applyPreferredDateAndHourAfterDateLoad(load);
            }
        });
}

function loadFusionDates() {
    const load = startNewLoad("fusion");
    if (!isActiveLoad(load)) return;

    fetch("/data/fused/dates.json")
        .then(r => {
            if (!r.ok) throw new Error("Could not load /data/fused/dates.json");
            return r.json();
        })
        .then(response => {
            if (!isActiveLoad(load)) { console.log("Ignoring stale Fusion dates load"); return; }

            let loadedDates = Array.isArray(response) ? response : (response.dates || []);

            if (!loadedDates || loadedDates.length === 0) {
                console.warn("No Fusion dates found in dates.json.");
                showToast("Fusion data product has no dates or data points available yet.", "warning");

                dates = [];
                allDates = [];

                const dateSlider = document.getElementById("dateSlider");
                const dateLabel = document.getElementById("dateLabel");
                const timeLabel = document.getElementById("timeLabel");

                if (dateSlider) { dateSlider.min = 0; dateSlider.max = 0; dateSlider.value = 0; }
                if (dateLabel) dateLabel.innerHTML = "No Fusion Data Available";
                if (timeLabel) timeLabel.innerHTML = "";

                clearDataLayers();
                hideLoading();
                return;
            }

            if (TIME_SCALE === "monthly") {
                loadedDates = [...new Set(loadedDates.map(d => d.substring(0, 7)))];
            }

            dates = [...loadedDates];
            allDates = [...loadedDates];
            rangeStartDate = dates[0];
            rangeEndDate = dates[dates.length - 1];
            rangeCurrentEndDate = rangeEndDate;

            const dateSlider = document.getElementById("dateSlider");
            const dateLabel = document.getElementById("dateLabel");
            const timeLabel = document.getElementById("timeLabel");
            const startDateInput = document.getElementById("startDate");
            const endDateInput = document.getElementById("endDate");

            if (dateSlider) { dateSlider.min = 0; dateSlider.max = dates.length - 1; }
            if (startDateInput) startDateInput.value = TIME_SCALE === "monthly" ? "" : rangeStartDate;
            if (endDateInput) endDateInput.value = TIME_SCALE === "monthly" ? "" : rangeEndDate;

            if (dateLabel) {
                if (TIME_SCALE === "monthly") dateLabel.innerHTML = formatMonthForDisplay(dates[0]);
                else dateLabel.innerHTML = utcDateToCentralPretty(dates[0]);
            }

            if (timeLabel && TIME_SCALE === "hourly") timeLabel.innerHTML = `Time: ${formatHourForDisplay(dates[0], 0)}`;
            else if (timeLabel) timeLabel.innerHTML = "";

            cachedDate = null; cachedFeatures = null; cachedHourBuckets = null;
            nextCachedDate = null; nextCachedHourBuckets = null;

            updateBottomControlVisibility();

            console.log("Loaded Fusion dates:", { timeScale: TIME_SCALE, count: dates.length, first: dates[0], last: dates[dates.length - 1] });
            applyPreferredDateAndHourAfterDateLoad(load);
        })
        .catch(err => {
            if (!isActiveLoad(load)) return;
            console.error("Could not load Fusion dates:", err);

            showToast("Fusion data product is not yet available. No dates or data points exist for this product.", "warning");

            dates = [];
            allDates = [];

            const dateSlider = document.getElementById("dateSlider");
            const dateLabel = document.getElementById("dateLabel");
            const timeLabel = document.getElementById("timeLabel");

            if (dateSlider) { dateSlider.min = 0; dateSlider.max = 0; dateSlider.value = 0; }
            if (dateLabel) dateLabel.innerHTML = "No Fusion Data Available";
            if (timeLabel) timeLabel.innerHTML = "";

            clearDataLayers();
            hideLoading();
        });
}