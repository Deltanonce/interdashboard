// map.js - OMEGA RESTORE: 3D Geospatial Engine (CesiumJS)
import SatelliteTracker, { SATELLITE_CATEGORIES } from './asset-tracker/satellite-tracker.js';

let viewer = null;
let leafletMap = null; // 2D Fallback
let is3DMode = true;

let liveMarkerRefs = {}; // id -> { entity, latestAsset, source }
let predictionEntities = {}; // id -> { pathEntity, endpointEntity }
let satelliteEntities = {}; // satId -> entity
let alertedAssetIds = new Set();
let lockedAssetIds = new Set();
let orbitalViewActive = false;
let followedEntity = null;
let cinematicOrbitActive = false; // OMEGA RESTORE: Cinematic state
let orbitTarget = null;
let orbitAngle = 0;
let motionBlurStage = null;

const alertSound = new Audio('assets/tactical_alert.mp3');
const scanSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');

// TLE Data URL (CelesTrak - Active Satellites)
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

function detectCapabilities() {
    try {
        const canvas = document.createElement('canvas');
        return {
            webgl: !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))),
            webgl2: !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'))
        };
    } catch (e) {
        return { webgl: false, webgl2: false };
    }
}

async function initMap() {
    const caps = detectCapabilities();
    if (!caps.webgl) {
        window.Logger.log('MAP', 'WebGL not supported. Switching to 2D Fallback Mode.');
        return showFallbackMode();
    }

    try {
        await initCesium();
    } catch (err) {
        window.Logger.log('CESIUM', 'Failed to initialize Cesium 3D Engine.', err);
        showFallbackMode();
    }
}

async function initCesium() {
    if (viewer) return;
    is3DMode = true;

    // Initialize Cesium Viewer with disabled default UI for tactical look
    Cesium.Ion.defaultAccessToken = window.CESIUM_ACCESS_TOKEN || ''; 

    viewer = new Cesium.Viewer('satellite-map', {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        requestRenderMode: true, // Optimize performance
        maximumRenderTimeChange: Infinity,
        terrainProvider: await Cesium.createWorldTerrainAsync(),
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        })
    });

    try {
        // Fallback: Add 3D OSM Buildings for volumetric terrain feeling
        const buildingTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingTileset);
    } catch (e) {
        console.warn('3D Buildings failed to load:', e);
    }

    // Dark Satellite Aesthetic: Lower saturation, boost contrast, slight blue tint via color-matrix
    const mapContainer = document.getElementById('satellite-map');
    if (mapContainer) {
        mapContainer.style.filter = "saturate(0.4) contrast(1.2) sepia(0.2) hue-rotate(180deg) brightness(0.8)";
    }

    viewer.scene.globe.enableLighting = true;
    viewer.scene.highDynamicRange = true;

    // Set initial view to Middle East
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(45.0, 25.0, 10000000.0)
    });

    loadSatelliteData();
    setupInteraction();
    startRenderLoop();
    checkSignalJammingZones();
    setupSentinelSweep();

    // --- Satellite Tracker Initialization ---
    await SatelliteTracker.loadAllSatellites();
    setupSatelliteUI();

    // Sync UI pills
    setInterval(() => {
        const adsbVal = document.getElementById('live-adsb-count');
        const aisVal = document.getElementById('live-ais-count');
        const toolbarAdsb = document.getElementById('toolbar-adsb-count');
        const toolbarAis = document.getElementById('toolbar-ais-count');
        if (adsbVal && toolbarAdsb) toolbarAdsb.textContent = adsbVal.textContent;
        if (aisVal && toolbarAis) toolbarAis.textContent = aisVal.textContent;
    }, 2000);
}

function showFallbackMode() {
    is3DMode = false;
    const container = document.getElementById('satellite-map');
    if (!container) return;

    // Clean up container
    container.innerHTML = '';
    container.style.filter = 'none';

    // Load Leaflet CSS dynamically if not present
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
        document.head.appendChild(link);
    }

    // Load Leaflet JS dynamically if not present
    if (typeof L === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
        script.onload = () => initLeaflet();
        document.head.appendChild(script);
    } else {
        initLeaflet();
    }
}

function initLeaflet() {
    leafletMap = L.map('satellite-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([25.0, 45.0], 4);

    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(leafletMap);

    window.Logger.showToast('2D Fallback Mode Active', 'info');
}

// --- Sentinel Sweep Post Process ---
let sweepStage;
function setupSentinelSweep() {
    const sweepShader = `
        uniform sampler2D colorTexture;
        uniform float time;
        uniform float speedMultiplier;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            vec2 center = vec2(0.5, 0.5);
            vec2 dir = v_textureCoordinates - center;
            float angle = atan(dir.y, dir.x);
            float sweepAngle = mod(time * speedMultiplier, 6.28318) - 3.14159; 
            float diff = abs(angle - sweepAngle);
            if (diff < 0.05 || abs(diff - 6.28318) < 0.05) {
                color.rgb += vec3(0.0, 0.5, 0.0);
            }
            fragColor = color;
        }
    `;
    sweepStage = new Cesium.PostProcessStage({
        fragmentShader: sweepShader,
        uniforms: {
            time: 0.0,
            speedMultiplier: 2.0
        }
    });
    viewer.scene.postProcessStages.add(sweepStage);
    
    // Motion Blur Stage (Simple)
    motionBlurStage = new Cesium.PostProcessStage({
        fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;
            out vec4 fragColor;
            void main(void) {
                vec4 color = vec4(0.0);
                color += texture(colorTexture, v_textureCoordinates + vec2(-0.001, 0.0)) * 0.2;
                color += texture(colorTexture, v_textureCoordinates + vec2(0.001, 0.0)) * 0.2;
                color += texture(colorTexture, v_textureCoordinates) * 0.6;
                fragColor = color;
            }
        `
    });
    viewer.scene.postProcessStages.add(motionBlurStage);
    motionBlurStage.enabled = false;

    viewer.scene.preUpdate.addEventListener(function(scene, time) {
        const timestamp = performance.now() / 1000.0;
        sweepStage.uniforms.time = timestamp;
        sweepStage.uniforms.speedMultiplier = cinematicOrbitActive ? 8.0 : 2.0;

        if (cinematicOrbitActive && orbitTarget) {
            const center = orbitTarget.position.getValue(time);
            if (center) {
                orbitAngle += 0.01;
                const distance = 1200.0;
                const x = distance * Math.cos(orbitAngle);
                const y = distance * Math.sin(orbitAngle);
                const z = 600.0;
                viewer.camera.lookAt(center, new Cesium.Cartesian3(x, y, z));
            }
        }
    });
}

window.toggleOrbitLock = function(id) {
    if (!is3DMode) {
        window.Logger.showToast('Cinematic Orbit requires 3D Mode', 'warn');
        return;
    }
    if (cinematicOrbitActive) {
        stopOrbit();
    } else {
        startCinematicOrbit(id);
    }
};

function startCinematicOrbit(id) {
    const ref = liveMarkerRefs[id];
    if (!ref) return;
    
    cinematicOrbitActive = true;
    orbitTarget = ref.entity;
    orbitAngle = 0;
    
    if (motionBlurStage) motionBlurStage.enabled = true;
    const indicator = document.getElementById('cinematic-indicator');
    if (indicator) indicator.style.display = 'block';
    
    window.speakIntelligence(`Cinematic orbit locked on ${ref.latestAsset.callsign}.`);
}

function stopOrbit() {
    cinematicOrbitActive = false;
    orbitTarget = null;
    if (viewer) viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    
    if (motionBlurStage) motionBlurStage.enabled = false;
    const indicator = document.getElementById('cinematic-indicator');
    if (indicator) indicator.style.display = 'none';
    
    window.speakIntelligence("Orbital lock released.");
}

// --- CelesTrak TLE Integration ---
async function loadSatelliteData() {
    try {
        // Since we can't reliably hit celestrak directly due to CORS sometimes, we fetch from a proxy or directly if possible.
        // For the sake of this simulation, we'll try direct. If it fails, we fall back gracefully.
        const response = await fetch(TLE_URL);
        const text = await response.text();
        const lines = text.split('\n');
        
        let count = 0;
        for (let i = 0; i < lines.length && count < 180; i += 3) {
            const name = lines[i].trim();
            const tle1 = lines[i+1]?.trim();
            const tle2 = lines[i+2]?.trim();
            
            if (name && tle1 && tle2 && satellite) {
                try {
                    const satrec = satellite.twoline2satrec(tle1, tle2);
                    addSatelliteEntity(name, satrec);
                    count++;
                } catch(e) {}
            }
        }
        console.log(`[3D] Loaded ${count} orbital satellites.`);
    } catch (e) {
        console.error('Failed to load TLE data:', e);
    }
}

function addSatelliteEntity(name, satrec) {
    const id = 'sat_' + name.replace(/\s+/g, '_');
    
    const entity = viewer.entities.add({
        id: id,
        name: name,
        description: 'Orbital Reconnaissance Asset',
        position: new Cesium.CallbackProperty((time, result) => {
            const jsDate = Cesium.JulianDate.toDate(time);
            const positionAndVelocity = satellite.propagate(satrec, jsDate);
            if (!positionAndVelocity.position) return undefined;
            const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, satellite.gstime(jsDate));
            
            // Proximity logic for Intelligence Buffer
            checkProximity(id, positionGd);
            
            return Cesium.Cartesian3.fromRadians(positionGd.longitude, positionGd.latitude, positionGd.height * 1000, viewer.scene.globe.ellipsoid, result);
        }, false),
        point: {
            pixelSize: 4,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1
        },
        path: {
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.1,
                color: Cesium.Color.CYAN.withAlpha(0.3)
            }),
            width: 2,
            leadTime: 0,
            trailTime: 60 * 45 // 45 minutes trail
        }
    });
    
    satelliteEntities[id] = { entity, satrec, name };
}

function checkProximity(satId, satPosGd) {
    // Basic proximity check: if a satellite is directly over an ADS-B target (within ~1 degree)
    if (Math.random() < 0.0001) { // Throttle heavily to simulate rare alignment without bogging down the thread
        Object.values(liveMarkerRefs).forEach(ref => {
            if (ref.latestAsset && ref.latestAsset.priority) {
                const latDiff = Math.abs((satPosGd.latitude * 180 / Math.PI) - ref.latestAsset.lat);
                const lonDiff = Math.abs((satPosGd.longitude * 180 / Math.PI) - ref.latestAsset.lon);
                if (latDiff < 2 && lonDiff < 2) {
                    notifyServerProximity(satId, ref.latestAsset.hex);
                }
            }
        });
    }
}

async function notifyServerProximity(satId, targetHex) {
    try {
        await fetch('/api/proximity-alert', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ satId, targetHex })
        });
    } catch(e) {}
}

// --- Live Asset Layer (ADS-B & AIS in 3D) ---
window.addOrUpdateLiveAsset = function (asset) {
    if (!viewer) return;
    
    if (typeof updateTelemetrySidebar === 'function') {
        updateTelemetrySidebar(asset);
    }

    if (asset.priority) {
        window.onPriorityDetected(asset);
    }

    if (window.SHOW_PREDICTIONS && (asset.priority || lockedAssetIds.has(asset.id))) {
        renderPredictionPath(asset);
    }

    const altitude = asset.altitude > 0 ? asset.altitude * 0.3048 : 0; // ft to meters
    const position = Cesium.Cartesian3.fromDegrees(asset.lon, asset.lat, altitude);
    
    // ── DYNAMIC COLORING BASED ON VALIDATION ──
    let color = asset._source === 'adsb' ? Cesium.Color.RED : Cesium.Color.LIME;
    let labelSuffix = '';

    if (asset._source === 'ais' && asset.classification) {
        color = Cesium.Color.fromCssColorString(asset.classification.color);
        labelSuffix = ` ${asset.classification.icon}`;
        if (asset.classification.finalThreatLevel === 'high' || asset.classification.finalThreatLevel === 'critical') {
            labelSuffix += ` [${asset.classification.finalThreatLevel.toUpperCase()}]`;
        }
    }

    if (asset.validation) {
        if (!asset.validation.valid) {
            color = Cesium.Color.fromCssColorString('#ffb000'); // Amber for anomaly
            labelSuffix += ' [ANOMALY]';
        } else if (asset.validation.warnings && asset.validation.warnings.length > 0) {
            color = Cesium.Color.RED; // Force Red for emergency squawks
            labelSuffix += ` [${asset.validation.warnings[0].meaning}]`;
        }
    }

    if (liveMarkerRefs[asset.id]) {
        const ref = liveMarkerRefs[asset.id];
        ref.latestAsset = asset;
        ref.entity.position = position;
        
        // Update color and label
        if (ref.entity.cylinder) ref.entity.cylinder.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.6));
        if (ref.entity.box) ref.entity.box.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.6));
        if (ref.entity.billboard) ref.entity.billboard.image = createSvgDataUri(asset._source, asset.classification?.color || (asset._source === 'adsb' ? '#ff4757' : '#2ed573'));
        if (ref.entity.label) ref.entity.label.text = (asset.callsign || asset.hex || 'UNK') + labelSuffix;
        
        // Update orientation if heading available
        if (asset.heading) {
            const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(asset.heading - 90), 0, 0);
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
            ref.entity.orientation = orientation;
        }

    } else {
        const entityConfig = {
            id: asset.id,
            position: position,
            label: {
                text: asset.callsign || asset.hex || 'UNK',
                font: '10pt monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000)
            }
        };

        if (asset.heading) {
            const hpr = new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(asset.heading - 90), 0, 0);
            entityConfig.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
        }

        if (asset._source === 'adsb') {
            // Render as 3D Glowing Pyramid (Cylinder with top radius 0)
            entityConfig.cylinder = {
                length: 2000.0, // 2km high pyramid
                topRadius: 0.0,
                bottomRadius: 1000.0, // 1km base
                material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.6))
            };
        } else {
            // Render as 3D Hull on water surface (Box)
            entityConfig.box = {
                dimensions: new Cesium.Cartesian3(500.0, 1500.0, 500.0), // Box dimensions
                material: new Cesium.ColorMaterialProperty(Cesium.Color.LIME.withAlpha(0.6)),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            };
        }

        const entity = viewer.entities.add(entityConfig);
        liveMarkerRefs[asset.id] = { entity, latestAsset: asset, source: asset._source };
    }
};

window.removeLiveAsset = function (id) {
    if (liveMarkerRefs[id]) {
        viewer.entities.remove(liveMarkerRefs[id].entity);
        delete liveMarkerRefs[id];
    }
};

window.syncLiveAssets = function (activeIds) {
    if (!activeIds || !Array.isArray(activeIds)) return;
    const currentIds = Object.keys(liveMarkerRefs);
    currentIds.forEach(id => {
        if (!activeIds.includes(id)) {
            window.removeLiveAsset(id);
        }
    });
};

function createSvgDataUri(source, color) {
    // Generate simple SVG URI for billboards
    const svg = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="10" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="2"/>
        <line x1="16" y1="0" x2="16" y2="32" stroke="${color}" stroke-width="1"/>
        <line x1="0" y1="16" x2="32" y2="16" stroke="${color}" stroke-width="1"/>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

// --- Interaction & Orbital View ---
function setupInteraction() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Left click to enter Orbital View or show profile
    handler.setInputAction(function (click) {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            
            // Check if it's a satellite
            if (satelliteEntities[entity.id]) {
                enterOrbitalView(entity);
            } else if (liveMarkerRefs[entity.id]) {
                // Try to show threat profile
            }
        } else {
            exitOrbitalView();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right click for Tactical Menu
    handler.setInputAction(function (click) {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && liveMarkerRefs[pickedObject.id.id]) {
            if (typeof window.openTacticalMenu === 'function') {
                window.openTacticalMenu(pickedObject.id.id, click.position.x, click.position.y);
            }
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function enterOrbitalView(entity) {
    orbitalViewActive = true;
    followedEntity = entity;
    viewer.trackedEntity = entity;
    
    // Play sound
    scanSound.currentTime = 0;
    scanSound.play().catch(e => {});
    
    const container = document.getElementById('map-container');
    if (container) {
        container.classList.add('satellite-refocus');
        setTimeout(() => container.classList.remove('satellite-refocus'), 400);
    }
    window.speakIntelligence(`Orbital link established with ${entity.name}. Video feed synchronized.`);
}

function exitOrbitalView() {
    if (orbitalViewActive) {
        orbitalViewActive = false;
        viewer.trackedEntity = undefined;
        followedEntity = null;
        window.speakIntelligence("Orbital link detached. Returning to strategic overview.");
    }
}

// --- Signal Jamming Zones ---
function checkSignalJammingZones() {
    // Check camera position periodically
    setInterval(() => {
        if (!viewer) return;
        const cameraPos = viewer.camera.positionCartographic;
        const lat = Cesium.Math.toDegrees(cameraPos.latitude);
        const lon = Cesium.Math.toDegrees(cameraPos.longitude);
        
        // Define a conflict zone (e.g., Red Sea / Yemen area)
        const isJammingZone = (lat > 12 && lat < 20 && lon > 40 && lon < 50);
        
        const container = document.getElementById('map-container');
        if (container) {
            if (isJammingZone) {
                if (!container.classList.contains('glitch-anim')) {
                    container.classList.add('glitch-anim');
                    if (Math.random() < 0.2) window.speakIntelligence("Warning. High electromagnetic interference detected. Signal degradation imminent.");
                }
            } else {
                container.classList.remove('glitch-anim');
            }
        }
    }, 2000);
}

function startRenderLoop() {
    viewer.scene.postRender.addEventListener(function () {
        if (window.PerfMonitor) window.PerfMonitor.recordFrame();
        if (orbitalViewActive && followedEntity) {
            // Apply slight rotation or zoom adjustments for cinematic effect
        }
        viewer.scene.requestRender();
    });
}

// --- Omega Protocol Compatibility Stubs ---
window.onPriorityDetected = function (asset) {
    if (!asset || !asset.priority) return;
    if (alertedAssetIds.has(asset.id)) return;
    alertedAssetIds.add(asset.id);
    
    const voiceText = `Strategic Alert. ${asset.callsign || 'Unidentified asset'}, type ${asset.t || 'unknown'}, detected.`;
    window.speakIntelligence(voiceText);
    
    if (alertSound.paused) {
        alertSound.play().catch(e => {});
    }
};

window.speakIntelligence = function(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const robotic = voices.find(v => v.name.includes('Google') || v.name.includes('Robot'));
    if (robotic) utter.voice = robotic;
    window.speechSynthesis.speak(utter);
};

window.triggerDeepScan = function(id) {
    const ref = liveMarkerRefs[id];
    if (!ref) return;
    scanSound.currentTime = 0;
    scanSound.play().catch(e => {});
    window.speakIntelligence(`Deep scan initiated for ${ref.latestAsset.callsign}.`);
};

window.toggleTargetLock = function(id) {
    if (lockedAssetIds.has(id)) lockedAssetIds.delete(id);
    else {
        lockedAssetIds.add(id);
        const ref = liveMarkerRefs[id];
        if (ref) window.speakIntelligence(`Target ${ref.latestAsset.callsign} locked.`);
    }
};

// Shader compatibility (Cesium Post-Process Stages)
let nightVisionStage = null;
let thermalStage = null;

window.applyShader = function(type) {
    if (!viewer) return;

    if (!nightVisionStage) {
        nightVisionStage = new Cesium.PostProcessStage({
            fragmentShader: `
                uniform sampler2D colorTexture;
                in vec2 v_textureCoordinates;
                out vec4 fragColor;
                void main(void) {
                    vec4 color = texture(colorTexture, v_textureCoordinates);
                    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    fragColor = vec4(0.0, luminance * 1.8, 0.0, 1.0);
                }
            `
        });
        viewer.scene.postProcessStages.add(nightVisionStage);
        nightVisionStage.enabled = false;

        thermalStage = new Cesium.PostProcessStage({
            fragmentShader: `
                uniform sampler2D colorTexture;
                in vec2 v_textureCoordinates;
                out vec4 fragColor;
                void main(void) {
                    vec4 color = texture(colorTexture, v_textureCoordinates);
                    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    vec3 thermal = vec3(luminance * 2.0, luminance, 1.0 - luminance);
                    fragColor = vec4(thermal, 1.0);
                }
            `
        });
        viewer.scene.postProcessStages.add(thermalStage);
        thermalStage.enabled = false;
    }

    const mapContainer = document.getElementById('satellite-map');
    
    nightVisionStage.enabled = false;
    thermalStage.enabled = false;
    mapContainer.style.filter = "none"; // reset CSS filter

    if (type === 'normal') {
        mapContainer.style.filter = "saturate(0.4) contrast(1.2) sepia(0.2) hue-rotate(180deg) brightness(0.8)";
    } else if (type === 'thermal') {
        thermalStage.enabled = true;
    } else if (type === 'night') {
        nightVisionStage.enabled = true;
    }
};

// Telemetry Sidebar helper
function updateTelemetrySidebar(asset) {
    const feed = document.getElementById('telemetry-feed');
    if (!feed) return;
    const placeholder = feed.querySelector('.telem-item[style*="italic"]');
    if (placeholder) placeholder.remove();
    const el = document.createElement('div');
    el.className = 'telem-item';
    el.innerHTML = `<strong>[${asset.hex || 'SYS'}]</strong> ${asset.callsign || 'UNK'} : LAT ${asset.lat.toFixed(2)} LON ${asset.lon.toFixed(2)} SPD ${asset.speed} ALT ${asset.altitude}`;
    feed.prepend(el);
    while (feed.children.length > 20) feed.lastElementChild.remove();
}

// --- PREDICTION PATH RENDERING ---
function renderPredictionPath(asset) {
    if (!viewer || !window.SHOW_PREDICTIONS) return;

    if (predictionEntities[asset.id]) {
        viewer.entities.remove(predictionEntities[asset.id].pathEntity);
        if (predictionEntities[asset.id].endpointEntity) {
            viewer.entities.remove(predictionEntities[asset.id].endpointEntity);
        }
        delete predictionEntities[asset.id];
    }

    if (typeof AssetTracker === 'undefined' || !AssetTracker.calculateInterceptPath) return;

    const predictions = AssetTracker.calculateInterceptPath(asset, 15);
    if (!predictions || predictions.length < 2) return;

    const positions = predictions.map(p => 
        Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altitude * 0.3048)
    );

    const pathEntity = viewer.entities.add({
        id: `prediction-${asset.id}`,
        polyline: {
            positions: positions,
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.YELLOW.withAlpha(0.7),
                dashLength: 16
            }),
            clampToGround: false
        }
    });

    const lastPoint = predictions[predictions.length - 1];
    const endpointEntity = viewer.entities.add({
        id: `prediction-endpoint-${asset.id}`,
        position: Cesium.Cartesian3.fromDegrees(lastPoint.lon, lastPoint.lat, lastPoint.altitude * 0.3048),
        point: {
            pixelSize: 8,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
        },
        label: {
            text: `+${predictions.length - 1}min`,
            font: '10px monospace',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10)
        }
    });

    predictionEntities[asset.id] = { pathEntity, endpointEntity };
}

window.updatePredictionPath = function(assetId) {
    const ref = liveMarkerRefs[assetId];
    if (ref && ref.latestAsset) {
        if (ref.latestAsset.priority || lockedAssetIds.has(assetId)) {
            renderPredictionPath(ref.latestAsset);
        }
    }
};

window.clearAllPredictions = function() {
    Object.keys(predictionEntities).forEach(id => {
        viewer.entities.remove(predictionEntities[id].pathEntity);
        if (predictionEntities[id].endpointEntity) {
            viewer.entities.remove(predictionEntities[id].endpointEntity);
        }
    });
    predictionEntities = {};
};

// --- SATELLITE UI CONTROLS ---
function setupSatelliteUI() {
    const toggleBtn = document.getElementById('toggle-satellites');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (SatelliteTracker.enabled) {
                SatelliteTracker.stop(viewer);
                toggleBtn.textContent = 'ENABLE SATELLITE FEED';
                toggleBtn.classList.remove('active');
            } else {
                SatelliteTracker.start(viewer);
                toggleBtn.textContent = 'DISABLE SATELLITE FEED';
                toggleBtn.classList.add('active');
            }
        });
    }

    Object.keys(SATELLITE_CATEGORIES).forEach(cat => {
        const el = document.getElementById(`toggle-${cat}`);
        if (el) {
            el.addEventListener('change', (e) => {
                SatelliteTracker.toggleCategory(cat, e.target.checked, viewer);
            });
        }
    });
}
