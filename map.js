// map.js - Konfigurasi Esri Sattelite & Open Boundaries
let leafletMap = null;
let mapLayerGroups = {};
let markerClusterGroup = null;

let boundaryLayer = null;

// --- SVG ICON TEMPLATES (Military HUD Style) ---
const ASSET_SVG = {
    aircraft: (color) => `<svg viewBox="0 0 40 40" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <g fill="${color}" stroke="${color}" stroke-width="0.5" opacity="0.95">
            <path d="M20 4 L24 18 L36 22 L36 24 L24 21 L24 32 L28 35 L28 37 L20 35 L12 37 L12 35 L16 32 L16 21 L4 24 L4 22 L16 18 Z"/>
        </g>
    </svg>`,
    vessel: (color) => `<svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <g fill="${color}" stroke="${color}" stroke-width="0.5" opacity="0.95">
            <path d="M20 2 L26 14 L34 30 L20 26 L6 30 L14 14 Z"/>
            <line x1="20" y1="26" x2="20" y2="38" stroke-width="2"/>
        </g>
    </svg>`,
    base: (color) => `<svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke="${color}" stroke-width="2" opacity="0.95">
            <rect x="8" y="8" width="24" height="24" rx="3"/>
            <line x1="14" y1="8" x2="14" y2="32"/>
            <line x1="26" y1="8" x2="26" y2="32"/>
            <line x1="8" y1="20" x2="32" y2="20"/>
            <circle cx="20" cy="20" r="4" fill="${color}" opacity="0.6"/>
        </g>
    </svg>`,
    missile: (color) => `<svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <g fill="${color}" stroke="${color}" stroke-width="0.5" opacity="0.95">
            <path d="M20 2 L23 12 L23 28 L27 34 L20 30 L13 34 L17 28 L17 12 Z"/>
            <circle cx="20" cy="16" r="2" fill="#000" opacity="0.5"/>
        </g>
    </svg>`
};

// (Static MILITARY_ASSETS removed — all markers are now LIVE real-time from ADS-B / AIS)

function initMap() {
    if (leafletMap || typeof L === 'undefined') {
        if (leafletMap && typeof leafletMap.invalidateSize === 'function') {
            leafletMap.invalidateSize();
        }
        return;
    }

    const container = document.getElementById('satellite-map');
    if (!container) return;
    container.innerHTML = '';

    leafletMap = L.map('satellite-map', {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        markerZoomAnimation: true,
        fadeAnimation: true,
        preferCanvas: true,
        minZoom: 2,
    }).setView([28.0, 48.0], 4); // Fokus Timur Tengah

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        updateWhenIdle: true,
        keepBuffer: 3
    }).addTo(leafletMap);

    // Dark Tactical Overlay
    L.rectangle([[-90, -180], [90, 180]], {
        color: '#06101a', fillColor: '#06101a', fillOpacity: 0.55, weight: 0, interactive: false
    }).addTo(leafletMap);

    // Clustering
    if (typeof L.markerClusterGroup !== 'undefined') {
        markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 40,
            iconCreateFunction: function (cluster) {
                return L.divIcon({ html: '<div class="cluster-icon">' + cluster.getChildCount() + '</div>', className: 'custom-cluster', iconSize: L.point(30, 30) });
            }
        });
        leafletMap.addLayer(markerClusterGroup);
    }

    // Layer Groups per Category
    const categories = ['naval', 'airbase', 'missile', 'proxy', 'nuclear'];
    categories.forEach(cat => {
        mapLayerGroups[cat] = L.featureGroup().addTo(leafletMap);
    });

    // No static markers — all data is now LIVE from ADS-B / AIS
    loadGeoBoundaries();

    // ── Coordinate readout (WORLDVIEW style) ──
    leafletMap.on('mousemove', function (e) {
        const coordEl = document.getElementById('wv-coords');
        if (coordEl) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            const latD = Math.abs(lat);
            const lonD = Math.abs(lon);
            const latDeg = Math.floor(latD);
            const latMin = ((latD - latDeg) * 60).toFixed(2);
            const lonDeg = Math.floor(lonD);
            const lonMin = ((lonD - lonDeg) * 60).toFixed(2);
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            coordEl.textContent = `${latDeg}°${latMin}'${latDir} ${lonDeg}°${lonMin}'${lonDir}`;
        }
    });

    leafletMap.on('zoomend', function () {
        const zoomEl = document.getElementById('wv-zoom');
        if (zoomEl) zoomEl.textContent = leafletMap.getZoom();
    });

    // Sync bottom toolbar pill counts to new unique IDs
    setInterval(() => {
        const adsbVal = document.getElementById('live-adsb-count');
        const aisVal = document.getElementById('live-ais-count');
        const toolbarAdsb = document.getElementById('toolbar-adsb-count');
        const toolbarAis = document.getElementById('toolbar-ais-count');
        const toolbarAisDot = document.getElementById('toolbar-ais-dot');
        const aisStatusDot = document.getElementById('ais-status-dot');
        if (adsbVal && toolbarAdsb) toolbarAdsb.textContent = adsbVal.textContent;
        if (aisVal && toolbarAis) toolbarAis.textContent = aisVal.textContent;
        if (aisStatusDot && toolbarAisDot) {
            toolbarAisDot.className = aisStatusDot.className;
        }
    }, 2000);
}

// ── Toggle Analysis Panel ──
window.toggleAnalysisPanel = function () {
    const overlay = document.getElementById('analysis-overlay');
    if (overlay) {
        overlay.classList.toggle('hidden');
        const btn = document.getElementById('btn-analysis');
        if (btn) {
            btn.textContent = overlay.classList.contains('hidden') ? '▶ ANALYSIS PANEL' : '◀ HIDE ANALYSIS';
        }
        // Pastikan Leaflet diresize setelah animasi panel selesai agar tiles map tidak abu-abu/offset
        if (leafletMap && typeof leafletMap.invalidateSize === 'function') {
            setTimeout(() => { leafletMap.invalidateSize(); }, 350);
        }
    }
};
// --- Altitude-to-Color Gradient ---
function altitudeToColor(alt) {
    if (alt <= 0) return '#2ed573'; // Sea-level / subsurface = green
    if (alt < 10000) return '#ffa502'; // Low altitude = orange
    if (alt < 25000) return '#ffdd59'; // Mid altitude = yellow
    if (alt < 35000) return '#00d4ff'; // High altitude = cyan
    return '#a855f7'; // Very high altitude = purple
}

// --- Build Rich HUD Tooltip ---
function buildAssetTooltip(asset) {
    const confColor = asset.confidence >= 90 ? '#2ed573' : asset.confidence >= 70 ? '#ffa502' : '#ff4757';
    const altDisplay = asset.altitude < 0 ? `${asset.altitude}ft (SUB)` : asset.altitude === 0 ? 'SFC' : `FL${Math.round(asset.altitude / 100)}`;
    const spdUnit = asset.type === 'vessel' ? 'kts' : 'kts';
    return `<div class="asset-hud-tooltip">
        <div class="aht-callsign" style="color:${asset.color}">${asset.callsign}</div>
        <div class="aht-grid">
            <span class="aht-label">SPD</span><span class="aht-value">${asset.speed} ${spdUnit}</span>
            <span class="aht-label">ALT</span><span class="aht-value">${altDisplay}</span>
            <span class="aht-label">HDG</span><span class="aht-value">${asset.heading}°</span>
            <span class="aht-label">CONF</span><span class="aht-value" style="color:${confColor}">${asset.confidence}%</span>
        </div>
        <div class="aht-type">${asset.type.toUpperCase()} | ${asset.cat.toUpperCase()}</div>
    </div>`;
}

// --- Create SVG DivIcon — Clean, no glow (FlightRadar style) ---
function createAssetIcon(asset) {
    const rotation = asset.heading || 0;

    if (asset.type === 'vessel') {
        const typeStr = asset.vesselTypeName || 'Vessel';
        const color = asset.color || '#2ed573';

        // WORLDVIEW-style HUD marker for vessels
        const targetSvg = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 6 2 L 2 2 L 2 6" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none"/>
            <path d="M 18 2 L 22 2 L 22 6" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none"/>
            <path d="M 6 22 L 2 22 L 2 18" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none"/>
            <path d="M 18 22 L 22 22 L 22 18" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none"/>
            <circle cx="12" cy="12" r="4" fill="${color}" />
            <line x1="12" y1="12" x2="12" y2="2" stroke="${color}" stroke-width="1.5" opacity="0.8"/>
        </svg>`;

        return L.divIcon({
            className: 'mil-asset-icon wv-vessel-icon',
            html: `
            <div class="wv-vessel-container">
                <div class="wv-vessel-label" style="color: ${color}">${asset.callsign} <span class="wv-vessel-type">(${typeStr})</span></div>
                <div class="wv-vessel-target" style="transform:rotate(${rotation}deg)">
                    ${targetSvg}
                </div>
            </div>`,
            iconSize: [200, 80],
            iconAnchor: [100, 40] // Center of 200x80 container
        });
    }

    // Default for aircraft/bases
    const svgFn = ASSET_SVG[asset.type] || ASSET_SVG.base;
    const svgHtml = svgFn(asset.color);
    return L.divIcon({
        className: 'mil-asset-icon',
        html: `<div class="mil-asset-svg" style="transform:rotate(${rotation}deg)">${svgHtml}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

// --- Draw Trail/History Line with Altitude Gradient ---
function drawTrailLine(asset) {
    if (!asset.trail || asset.trail.length < 2) return null;

    const fullTrail = [...asset.trail, [asset.lat, asset.lon]];
    const fullAlts = [...asset.trailAlt, asset.altitude];
    const segments = [];

    for (let i = 0; i < fullTrail.length - 1; i++) {
        const seg = L.polyline([fullTrail[i], fullTrail[i + 1]], {
            color: altitudeToColor(fullAlts[i]),
            weight: 2,
            opacity: 0.3 + (i / fullTrail.length) * 0.6, // Fade older segments
            dashArray: asset.moving ? null : '4,6'
        });
        segments.push(seg);
    }

    const group = L.featureGroup(segments);
    return group;
}



// 6. Integrasi Regional GeoBoundaries API (Timteng, Asia Selatan, Asia Tenggara)
async function loadGeoBoundaries() {
    try {
        console.log('[Map] Memuat batas teritorial (GeoBoundaries) untuk 3 Region utama...');

        boundaryLayer = L.geoJSON(null, {
            style: {
                color: '#00d4ff', // Warna cyan terang agar kontras di atas laut & satelit
                weight: 1.5,
                opacity: 0.75,
                fillOpacity: 0
            },
            onEachFeature: function (feature, layer) {
                // Menambahkan nama negara ke tengah poligon
                if (feature.properties && feature.properties.shapeName) {
                    if (typeof layer.getBounds === 'function') {
                        const bounds = layer.getBounds();
                        if (bounds.isValid()) {
                            let center = bounds.getCenter();

                            // Koreksi posisi beberapa negara agar label tak tenggelam atau numpuk
                            if (feature.properties.shapeISO === 'IDN') center = L.latLng(-1.5, 117.5);
                            else if (feature.properties.shapeISO === 'MYS') center = L.latLng(4.5, 102.0);
                            else if (feature.properties.shapeISO === 'PHL') center = L.latLng(12.0, 122.0);
                            else if (feature.properties.shapeISO === 'VNM') center = L.latLng(16.0, 106.0);
                            else if (feature.properties.shapeISO === 'THA') center = L.latLng(15.0, 101.0);

                            L.marker(center, {
                                icon: L.divIcon({
                                    className: 'country-label-icon',
                                    html: `<span>${feature.properties.shapeName.toUpperCase()}</span>`,
                                    iconSize: [250, 20]
                                }),
                                interactive: false,
                                keyboard: false
                            }).addTo(leafletMap);
                        }
                    }
                }
            }
        }).addTo(leafletMap);

        const targetRegions = [
            'IDN', 'MYS', 'SGP', 'THA', 'VNM', 'PHL', 'BRN', 'KHM', 'MMR', 'LAO', 'TLS', // SE Asia
            'IRN', 'IRQ', 'ISR', 'SAU', 'SYR', 'LBN', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT', 'JOR', 'TUR', 'EGY', // Middle East
            'IND', 'PAK', 'AFG', 'BGD', 'LKA', 'NPL', 'BTN', 'MDV' // South Asia
        ];

        // Fetch semua region API yang di-cache lokal secara paralel
        targetRegions.forEach(iso => {
            fetch(`assets/boundaries/regions/${iso}.geojson`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Not found');
                })
                .then(data => {
                    if (data && boundaryLayer) boundaryLayer.addData(data);
                })
                .catch(err => {
                    // Silently ignore individual missing files to keep console clean
                });
        });

    } catch (e) {
        console.error('Batas teritorial regional gagal dimuat:', e);
    }
}



window.toggleLayer = function (cat, el) {
    const isActive = el.classList.contains('active');
    if (!leafletMap || !mapLayerGroups[cat]) return;

    if (isActive) {
        el.classList.remove('active');
        leafletMap.removeLayer(mapLayerGroups[cat]);
    } else {
        el.classList.add('active');
        leafletMap.addLayer(mapLayerGroups[cat]);
    }
};

// ══════════════════════════════════════════════════════════════════
//  LIVE ASSET LAYER (Optimized Real-Time ADS-B & AIS)
// ══════════════════════════════════════════════════════════════════

let liveAdsbLayer = null;
let liveAisLayer = null;
let liveMarkerRefs = {}; // id → { marker, glow, trailSegments[], lastHeading, lastTrailLen, source }

function ensureLiveLayers() {
    if (!leafletMap) return;
    if (!liveAdsbLayer) {
        liveAdsbLayer = L.featureGroup().addTo(leafletMap);
    }
    if (!liveAisLayer) {
        liveAisLayer = L.featureGroup().addTo(leafletMap);
    }
}

// Build tooltip with spoofing badge + aircraft type
function buildLiveTooltip(asset) {
    const confColor = asset.confidence >= 90 ? '#2ed573' : asset.confidence >= 70 ? '#ffa502' : '#ff4757';
    const altDisplay = asset.altitude < 0 ? `${asset.altitude}ft (SUB)` : asset.altitude === 0 ? 'SFC' : `FL${Math.round(asset.altitude / 100)}`;
    const spoofBadge = asset.spoofing ? '<div class="spoofing-badge">⚠ SPOOFING</div>' : '';
    const srcBadge = asset._source === 'adsb' ? '📡 ADS-B' : '🚢 AIS';
    const acType = asset.aircraftType ? ` [${asset.aircraftType}]` : '';
    return `<div class="asset-hud-tooltip">
        ${spoofBadge}
        <div class="aht-callsign" style="color:${asset.color}">${asset.callsign}${acType}</div>
        <div class="aht-grid">
            <span class="aht-label">SPD</span><span class="aht-value">${asset.speed} kts</span>
            <span class="aht-label">ALT</span><span class="aht-value">${altDisplay}</span>
            <span class="aht-label">HDG</span><span class="aht-value">${asset.heading}°</span>
            <span class="aht-label">CONF</span><span class="aht-value" style="color:${confColor}">${asset.confidence}%</span>
        </div>
        <div class="aht-type">${srcBadge} | ${asset.type.toUpperCase()}</div>
    </div>`;
}

// OPTIMIZED: Main bridge function — incremental trail, heading-aware icon cache
window.addOrUpdateLiveAsset = function (asset) {
    if (!leafletMap) return;
    ensureLiveLayers();

    const targetLayer = asset._source === 'ais' ? liveAisLayer : liveAdsbLayer;
    const existing = liveMarkerRefs[asset.id];

    if (existing) {
        // Update position
        existing.marker.setLatLng([asset.lat, asset.lon]);

        // OPTIMIZATION: Only update icon if heading changed (> 3°) — avoids SVG DOM churn
        const headingDelta = Math.abs(asset.heading - (existing.lastHeading || 0));
        if (headingDelta > 3 || existing.lastColor !== asset.color) {
            existing.marker.setIcon(createAssetIcon(asset));
            existing.lastHeading = asset.heading;
            existing.lastColor = asset.color;
        }

        // OPTIMIZATION: Lazy tooltip — only update content when tooltip is currently shown
        if (existing.marker.isTooltipOpen()) {
            existing.marker.setTooltipContent(buildLiveTooltip(asset));
        } else {
            // Store latest data for when tooltip opens
            existing._pendingTooltip = asset;
        }

        // OPTIMIZATION: Incremental trail — only add NEW segments, don't recreate all
        const currentTrailLen = (asset.trail || []).length;
        if (currentTrailLen > (existing.lastTrailLen || 0) && currentTrailLen >= 2) {
            // Add only the latest segment
            const trail = asset.trail;
            const alts = asset.trailAlt || [];
            const i = currentTrailLen - 1;
            const seg = L.polyline([trail[i - 1], trail[i]], {
                color: altitudeToColor(alts[i - 1] || 0),
                weight: 1.5,
                opacity: 0.3 + (i / currentTrailLen) * 0.5
            });
            seg.addTo(targetLayer);
            existing.trailSegments.push(seg);
            // Prune old trail segments (keep max 200)
            while (existing.trailSegments.length > 200) {
                const old = existing.trailSegments.shift();
                if (old) old.remove(); // .remove() is safer for garbage collection than removeLayer()
            }
            existing.lastTrailLen = currentTrailLen;
        }

    } else {
        // Create new marker — clean, no glow (FlightRadar style)
        const marker = L.marker([asset.lat, asset.lon], {
            icon: createAssetIcon(asset),
            zIndexOffset: 1200
        }).addTo(targetLayer);

        marker.bindTooltip(buildLiveTooltip(asset), {
            permanent: false,
            direction: 'right',
            className: 'asset-hud-tooltip-container',
            offset: [18, 0],
            sticky: true
        });

        // Add tooltip open handler for lazy updates
        marker.on('tooltipopen', () => {
            const ref = liveMarkerRefs[asset.id];
            if (ref && ref._pendingTooltip) {
                marker.setTooltipContent(buildLiveTooltip(ref._pendingTooltip));
                ref._pendingTooltip = null;
            }
        });

        liveMarkerRefs[asset.id] = {
            marker,
            trailSegments: [],
            lastHeading: asset.heading,
            lastColor: asset.color,
            lastTrailLen: 0,
            source: asset._source,
            _pendingTooltip: null
        };
    }
};

window.removeLiveAsset = function (id) {
    const ref = liveMarkerRefs[id];
    if (!ref) return;

    const layer = ref.source === 'ais' ? liveAisLayer : liveAdsbLayer;
    if (layer) {
        if (ref.marker) ref.marker.remove();
        ref.trailSegments.forEach(seg => {
            if (seg) seg.remove();
        });
    }
    delete liveMarkerRefs[id];
};

// Toggle live layers
window.toggleLiveLayer = function (source, el) {
    if (!leafletMap) return;
    ensureLiveLayers();
    const isActive = el.classList.contains('active');
    const layer = source === 'adsb' ? liveAdsbLayer : liveAisLayer;

    if (isActive) {
        el.classList.remove('active');
        leafletMap.removeLayer(layer);
    } else {
        el.classList.add('active');
        leafletMap.addLayer(layer);
    }
};

