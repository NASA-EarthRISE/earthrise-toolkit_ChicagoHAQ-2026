// ── V4 COMMUNITY AREA RENDERING ──────────────────────────────────────────────────────

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
      style: function(feature) {
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
      onEachFeature: function(feature, layer) {
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

function loadDailyCommunities(date) {
  fetch(`data/clarity/daily_community_${date}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (communityLayer) {
          map.removeLayer(communityLayer);
      }
      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.avg_no2;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
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
      console.error("Could not load daily community file:", err);
  });
}

function loadMonthlyCommunities(month) {
  fetch(`data/clarity/monthly_community_${date}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (communityLayer) {
          map.removeLayer(communityLayer);
      }
      communityLayer = L.geoJSON(data, {
          style: function(feature) {
              let raw = feature.properties.avg_no2;
              let avg = raw === null || raw === "" ? null : Number(raw);
              return {
                  color: "#222",
                  weight: 1,
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
      console.error("Could not load monthly community file:", err);
  });
}

function loadDailySensors(date) {
  fetch(`data/clarity/daily_sensor_${date}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let avg = parseFloat(p.avg_no2);
          let marker = L.circleMarker([
              f.geometry.coordinates[1],
              f.geometry.coordinates[0]
          ], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
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
      console.error("Could not load daily sensor file:", err);
  });
}

function loadMonthlySensors(month) {
  fetch(`data/clarity/monthly_sensor_${month}.geojson`)
  .then(r => r.json())
  .then(data => {
      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();
      data.features.forEach(f => {
          let p = f.properties;
          let avg = parseFloat(p.avg_no2);
          let marker = L.circleMarker([
              f.geometry.coordinates[1],
              f.geometry.coordinates[0]
          ], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
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
      console.error("Could not load monthly sensor file:", err);
  });
}

function loadDateRange() {
  if (!timeInterval) {
      showLoading(`Loading ${rangeStartDate} to ${rangeCurrentEndDate}`);
  }

  let selectedDates = dates.filter(d =>
      d >= rangeStartDate && d <= rangeCurrentEndDate
  );

  let filePrefix = displayMode === "community" ? "daily_community" : "daily_sensor";

  Promise.all(
      selectedDates.map(date =>
          fetch(`data/clarity/${filePrefix}_${date}.geojson`)
          .then(r => r.json())
      )
  )
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
                  grouped[sensor] = {
                      lat: f.geometry.coordinates[1],
                      lon: f.geometry.coordinates[0],
                      sum: 0,
                      count: 0
                  };
              }
              if (!isNaN(avg)) {
                  grouped[sensor].sum += avg;
                  grouped[sensor].count++;
              }
          });
      });

      if (currentLayer) {
          map.removeLayer(currentLayer);
      }
      currentLayer = L.layerGroup();

      Object.keys(grouped).forEach(sensor => {
          let g = grouped[sensor];
          if (g.count === 0) return;
          let avg = g.sum / g.count;
          let marker = L.circleMarker([g.lat, g.lon], {
              radius: 6,
              fillColor: getColor(avg),
              color: "#222",
              weight: 1,
              fillOpacity: 0.9
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

          if (!stats[name]) {
              stats[name] = { sum: 0, count: 0 };
          }
          if (!isNaN(avg)) {
              stats[name].sum += avg * measurements;
              stats[name].count += measurements;
          }
      });
  });

  if (communityLayer) {
      map.removeLayer(communityLayer);
  }

  communityLayer = L.geoJSON(communityData, {
      style: function(feature) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || p.name;
          let avg = null;
          if (stats[name] && stats[name].count > 0) {
              avg = stats[name].sum / stats[name].count;
          }
          return {
              color: "#222",
              weight: 1,
              fillColor: avg === null ? "transparent" : getColor(avg),
              fillOpacity: avg === null ? 0 : 0.65
          };
      },
      onEachFeature: function(feature, layer) {
          let props = feature.properties;
          let name = props.community || props.COMMUNITY || props.community_name || props.name;
          let avg = null;
          let totalCount = 0;
          if (stats[name]) {
              totalCount = stats[name].count;
              if (totalCount > 0) {
                  avg = stats[name].sum / totalCount;
              }
          }
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
