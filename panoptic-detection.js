// panoptic-detection.js — Panoptic Detection Engine
// Simulates computer-vision-style panoptic segmentation overlay on tracked assets
// Classification: vehicles, persons, infrastructure, anomalies

const DETECTION_CATEGORIES = {
    AIRCRAFT: { id: 'aircraft', label: 'AIRCRAFT', color: '#ff4757', icon: '✈', priority: 'HIGH' },
    VESSEL: { id: 'vessel', label: 'VESSEL', color: '#2ed573', icon: '⚓', priority: 'MEDIUM' },
    SATELLITE: { id: 'satellite', label: 'SATELLITE', color: '#00d2ff', icon: '🛰', priority: 'LOW' },
    VEHICLE: { id: 'vehicle', label: 'VEHICLE', color: '#ffa502', icon: '🚗', priority: 'LOW' },
    INFRASTRUCTURE: { id: 'infrastructure', label: 'INFRASTRUCTURE', color: '#c882ff', icon: '🏗', priority: 'MEDIUM' },
    ANOMALY: { id: 'anomaly', label: 'ANOMALY', color: '#ff2244', icon: '⚠', priority: 'CRITICAL' },
    PERSON: { id: 'person', label: 'PERSON', color: '#ffe132', icon: '👤', priority: 'LOW' },
    UAV: { id: 'uav', label: 'UAV/DRONE', color: '#ff6b81', icon: '🔺', priority: 'HIGH' }
};

const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.85,
    MEDIUM: 0.60,
    LOW: 0.30
};

class PanopticDetectionEngine {
    constructor() {
        this.detections = new Map();
        this.detectionLog = [];
        this.maxLogSize = 500;
        this.enabled = false;
        this.frameCount = 0;
        this.totalDetections = 0;
        this.anomalyCount = 0;
        this.processingTime = 0;
        this.updateTimer = null;
        this.boundingBoxEntities = {};
    }

    enable() {
        this.enabled = true;
        if (this.updateTimer) clearInterval(this.updateTimer);
        this.updateTimer = setInterval(() => this._runDetectionCycle(), 5000);
        console.log('[PANOPTIC] Detection engine enabled');
    }

    disable() {
        this.enabled = false;
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        this._clearBoundingBoxes();
        console.log('[PANOPTIC] Detection engine disabled');
    }

    toggle() {
        if (this.enabled) this.disable();
        else this.enable();
        return this.enabled;
    }

    _runDetectionCycle() {
        if (!this.enabled) return;

        const startTime = performance.now();
        this.frameCount++;

        // Process all tracked live assets
        if (typeof window !== 'undefined') {
            this._detectFromAdsb();
            this._detectFromAis();
            this._detectFromSatellites();
            this._detectFromTrafficCams();
            this._detectAnomalies();
        }

        this.processingTime = performance.now() - startTime;
        this._updateStatsPanel();
    }

    _detectFromAdsb() {
        const adsbAssets = document.querySelectorAll ? [] : [];
        // Pull from global live assets if available
        if (window.AssetTracker && window.AssetTracker.getLiveAssets) {
            const assets = window.AssetTracker.getLiveAssets();
            if (assets && typeof assets === 'object') {
                Object.values(assets).forEach(asset => {
                    if (asset && asset.lat && asset.lon) {
                        this._addDetection({
                            id: `det_adsb_${asset.hex || asset.id}`,
                            category: asset.speed > 400 ? DETECTION_CATEGORIES.AIRCRAFT : 
                                     (asset.altitude < 500 ? DETECTION_CATEGORIES.UAV : DETECTION_CATEGORIES.AIRCRAFT),
                            lat: asset.lat,
                            lon: asset.lon,
                            altitude: asset.altitude || 0,
                            confidence: 0.75 + Math.random() * 0.25,
                            source: 'ADS-B',
                            metadata: {
                                callsign: asset.callsign || 'UNK',
                                speed: asset.speed || 0,
                                heading: asset.heading || 0,
                                type: asset.t || 'N/A'
                            }
                        });
                    }
                });
            }
        }
    }

    _detectFromAis() {
        // Pull from AIS live assets
        if (window.AssetTracker && window.AssetTracker.getAisAssets) {
            const vessels = window.AssetTracker.getAisAssets();
            if (vessels && typeof vessels === 'object') {
                Object.values(vessels).forEach(v => {
                    if (v && v.lat && v.lon) {
                        this._addDetection({
                            id: `det_ais_${v.mmsi || v.id}`,
                            category: DETECTION_CATEGORIES.VESSEL,
                            lat: v.lat,
                            lon: v.lon,
                            altitude: 0,
                            confidence: 0.70 + Math.random() * 0.30,
                            source: 'AIS',
                            metadata: {
                                name: v.name || v.mmsi || 'UNK',
                                speed: v.speed || 0,
                                heading: v.heading || 0,
                                type: v.vesselType || 'N/A'
                            }
                        });
                    }
                });
            }
        }
    }

    _detectFromSatellites() {
        // Count satellite entities from map
        if (window.viewer) {
            const entities = window.viewer.entities.values;
            let satCount = 0;
            for (let i = 0; i < entities.length && satCount < 50; i++) {
                if (entities[i].id && entities[i].id.startsWith('sat_')) {
                    satCount++;
                    const pos = entities[i].position;
                    if (pos) {
                        this._addDetection({
                            id: `det_${entities[i].id}`,
                            category: DETECTION_CATEGORIES.SATELLITE,
                            lat: 0, lon: 0, altitude: 400000,
                            confidence: 0.95,
                            source: 'TLE/SGP4',
                            metadata: { name: entities[i].name || entities[i].id }
                        });
                    }
                }
            }
        }
    }

    _detectFromTrafficCams() {
        if (!window.TrafficCams || !window.TrafficCams.visible) return;

        // Simulate panoptic detections from traffic cameras
        const cams = window.TrafficCams.getCameraList();
        cams.forEach(cam => {
            // Simulate vehicle detections near each camera
            const vehicleCount = Math.floor(3 + Math.random() * 12);
            for (let i = 0; i < vehicleCount; i++) {
                this._addDetection({
                    id: `det_veh_${cam.id}_${i}`,
                    category: DETECTION_CATEGORIES.VEHICLE,
                    lat: cam.lat + (Math.random() - 0.5) * 0.002,
                    lon: cam.lon + (Math.random() - 0.5) * 0.002,
                    altitude: 0,
                    confidence: 0.60 + Math.random() * 0.35,
                    source: `CAM:${cam.id}`,
                    metadata: { camera: cam.name, type: 'vehicle' }
                });
            }

            // Occasional person detection
            if (Math.random() > 0.7) {
                this._addDetection({
                    id: `det_ped_${cam.id}`,
                    category: DETECTION_CATEGORIES.PERSON,
                    lat: cam.lat + (Math.random() - 0.5) * 0.001,
                    lon: cam.lon + (Math.random() - 0.5) * 0.001,
                    altitude: 0,
                    confidence: 0.45 + Math.random() * 0.40,
                    source: `CAM:${cam.id}`,
                    metadata: { camera: cam.name, type: 'pedestrian' }
                });
            }
        });
    }

    _detectAnomalies() {
        // Check for anomalous behaviors
        this.detections.forEach((det, id) => {
            if (det.category.id === 'aircraft' && det.metadata) {
                // Speed anomaly
                if (det.metadata.speed > 1500) {
                    this._addDetection({
                        id: `anomaly_speed_${id}`,
                        category: DETECTION_CATEGORIES.ANOMALY,
                        lat: det.lat, lon: det.lon, altitude: det.altitude,
                        confidence: 0.90,
                        source: 'ANOMALY_ENGINE',
                        metadata: { reason: 'EXCESSIVE_SPEED', value: det.metadata.speed, parent: id }
                    });
                }

                // Low altitude military
                if (det.altitude > 0 && det.altitude < 1000 && det.metadata.speed > 200) {
                    this._addDetection({
                        id: `anomaly_lowalt_${id}`,
                        category: DETECTION_CATEGORIES.ANOMALY,
                        lat: det.lat, lon: det.lon, altitude: det.altitude,
                        confidence: 0.75,
                        source: 'ANOMALY_ENGINE',
                        metadata: { reason: 'LOW_ALT_FAST', value: det.altitude, parent: id }
                    });
                }
            }
        });
    }

    _addDetection(det) {
        det.timestamp = Date.now();
        det.confidenceLabel = det.confidence >= CONFIDENCE_THRESHOLDS.HIGH ? 'HIGH' :
                             det.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';

        this.detections.set(det.id, det);
        this.totalDetections++;

        if (det.category.id === 'anomaly') {
            this.anomalyCount++;
        }

        // Add to log
        this.detectionLog.unshift({
            id: det.id,
            category: det.category.label,
            confidence: det.confidence,
            source: det.source,
            timestamp: det.timestamp,
            icon: det.category.icon
        });

        if (this.detectionLog.length > this.maxLogSize) {
            this.detectionLog.length = this.maxLogSize;
        }
    }

    _clearBoundingBoxes() {
        if (!window.viewer) return;
        Object.keys(this.boundingBoxEntities).forEach(id => {
            window.viewer.entities.remove(this.boundingBoxEntities[id]);
        });
        this.boundingBoxEntities = {};
    }

    getDetectionsByCategory() {
        const counts = {};
        Object.keys(DETECTION_CATEGORIES).forEach(k => {
            counts[DETECTION_CATEGORIES[k].id] = 0;
        });
        this.detections.forEach(det => {
            counts[det.category.id] = (counts[det.category.id] || 0) + 1;
        });
        return counts;
    }

    getStats() {
        const counts = this.getDetectionsByCategory();
        return {
            totalActive: this.detections.size,
            totalProcessed: this.totalDetections,
            anomalies: this.anomalyCount,
            frameCount: this.frameCount,
            processingTimeMs: Math.round(this.processingTime * 100) / 100,
            fps: this.frameCount > 0 ? (1000 / (this.processingTime || 1)).toFixed(1) : '0',
            byCategory: counts,
            enabled: this.enabled
        };
    }

    getRecentLog(count = 20) {
        return this.detectionLog.slice(0, count);
    }

    _updateStatsPanel() {
        const panel = document.getElementById('panoptic-stats');
        if (!panel) return;

        const stats = this.getStats();
        const counts = stats.byCategory;

        panel.innerHTML = `
            <div class="panoptic-grid">
                <div class="panoptic-stat">
                    <span class="panoptic-stat-val" style="color:#00ff41">${stats.totalActive}</span>
                    <span class="panoptic-stat-label">ACTIVE</span>
                </div>
                <div class="panoptic-stat">
                    <span class="panoptic-stat-val" style="color:#ff2244">${stats.anomalies}</span>
                    <span class="panoptic-stat-label">ANOMALIES</span>
                </div>
                <div class="panoptic-stat">
                    <span class="panoptic-stat-val" style="color:#00e5ff">${stats.processingTimeMs}ms</span>
                    <span class="panoptic-stat-label">PROC TIME</span>
                </div>
                <div class="panoptic-stat">
                    <span class="panoptic-stat-val">${stats.frameCount}</span>
                    <span class="panoptic-stat-label">FRAMES</span>
                </div>
            </div>
            <div class="panoptic-categories">
                ${Object.values(DETECTION_CATEGORIES).map(cat => `
                    <div class="panoptic-cat-row">
                        <span class="panoptic-cat-icon">${cat.icon}</span>
                        <span class="panoptic-cat-name">${cat.label}</span>
                        <span class="panoptic-cat-count" style="color:${cat.color}">${counts[cat.id] || 0}</span>
                    </div>
                `).join('')}
            </div>
        `;

        // Update detection log panel
        const logPanel = document.getElementById('panoptic-log');
        if (logPanel) {
            const recent = this.getRecentLog(15);
            logPanel.innerHTML = recent.map(entry => `
                <div class="panoptic-log-item">
                    <span class="panoptic-log-icon">${entry.icon}</span>
                    <span class="panoptic-log-cat">${entry.category}</span>
                    <span class="panoptic-log-conf" style="color:${entry.confidence >= 0.85 ? '#00ff41' : entry.confidence >= 0.6 ? '#ffe132' : '#ff9100'}">${(entry.confidence * 100).toFixed(0)}%</span>
                    <span class="panoptic-log-src">${entry.source}</span>
                </div>
            `).join('') || '<div style="color:var(--text-dim)">AWAITING DETECTIONS...</div>';
        }
    }

    renderBoundingBoxOverlay(viewer) {
        if (!viewer || !this.enabled) return;

        this._clearBoundingBoxes();

        // Only render bounding boxes for non-satellite, non-vehicle detections (to keep it clean)
        const importantDetections = Array.from(this.detections.values())
            .filter(d => d.category.priority === 'HIGH' || d.category.priority === 'CRITICAL')
            .slice(0, 50);

        importantDetections.forEach(det => {
            if (!det.lat || !det.lon) return;

            const bbSize = det.category.id === 'anomaly' ? 0.02 : 0.01;

            const entity = viewer.entities.add({
                id: `bbox_${det.id}`,
                rectangle: {
                    coordinates: Cesium.Rectangle.fromDegrees(
                        det.lon - bbSize, det.lat - bbSize,
                        det.lon + bbSize, det.lat + bbSize
                    ),
                    material: Cesium.Color.fromCssColorString(det.category.color).withAlpha(0.15),
                    outline: true,
                    outlineColor: Cesium.Color.fromCssColorString(det.category.color).withAlpha(0.6),
                    height: det.altitude || 0,
                    heightReference: det.altitude > 0 ? Cesium.HeightReference.NONE : Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });

            this.boundingBoxEntities[det.id] = entity;
        });
    }
}

window.PanopticEngine = new PanopticDetectionEngine();
export default window.PanopticEngine;
