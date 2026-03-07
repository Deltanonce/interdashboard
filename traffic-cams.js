// traffic-cams.js — Austin Real-Time Traffic Camera System
// Pulls live camera feeds from Austin's Open Data portal (CoA CCTV)

const AUSTIN_CCTV_API = 'https://data.austintexas.gov/resource/b4k4-adkb.json';
const REFRESH_INTERVAL = 30000; // 30s refresh for camera list
const MAX_CAMS = 200;

class TrafficCameraSystem {
    constructor() {
        this.cameras = [];
        this.activeFeed = null;
        this.cameraEntities = {};
        this.visible = false;
        this.refreshTimer = null;
        this.selectedCamera = null;
        this.feedPanel = null;
    }

    async loadCameras() {
        try {
            const url = `${AUSTIN_CCTV_API}?$limit=${MAX_CAMS}&$where=camera_status='TURNED_ON'`;
            const res = await fetch(`/api/traffic-cams?url=${encodeURIComponent(url)}`);
            if (!res.ok) {
                // Fallback: try direct fetch
                return this._loadFallbackCameras();
            }
            const data = await res.json();
            this.cameras = this._normalizeCameras(data);
            console.log(`[TRAFFIC-CAM] Loaded ${this.cameras.length} Austin cameras`);
            return this.cameras;
        } catch (e) {
            console.warn('[TRAFFIC-CAM] API fetch failed, using fallback:', e.message);
            return this._loadFallbackCameras();
        }
    }

    _normalizeCameras(data) {
        return data
            .filter(c => c.location_latitude && c.location_longitude)
            .map((c, i) => ({
                id: c.camera_id || `cam_${i}`,
                name: c.location_name || c.camera_name || `Camera ${i}`,
                lat: parseFloat(c.location_latitude),
                lon: parseFloat(c.location_longitude),
                status: c.camera_status || 'UNKNOWN',
                imageUrl: c.camera_mfg_url || c.screenshot_address || null,
                turn: c.turn_on_date || null,
                type: c.primary_st_segment_id ? 'INTERSECTION' : 'CORRIDOR'
            }));
    }

    _loadFallbackCameras() {
        // Hardcoded Austin traffic camera hotspots for offline/fallback mode
        this.cameras = [
            { id: 'ATX001', name: 'I-35 @ Riverside Dr', lat: 30.2520, lon: -97.7380, status: 'ACTIVE', type: 'INTERSTATE' },
            { id: 'ATX002', name: 'MoPac @ Bee Cave Rd', lat: 30.2600, lon: -97.7950, status: 'ACTIVE', type: 'HIGHWAY' },
            { id: 'ATX003', name: 'I-35 @ 51st St', lat: 30.3030, lon: -97.7190, status: 'ACTIVE', type: 'INTERSTATE' },
            { id: 'ATX004', name: 'US 183 @ Burnet Rd', lat: 30.3700, lon: -97.7180, status: 'ACTIVE', type: 'HIGHWAY' },
            { id: 'ATX005', name: 'Congress Ave @ 6th St', lat: 30.2672, lon: -97.7431, status: 'ACTIVE', type: 'DOWNTOWN' },
            { id: 'ATX006', name: 'Lamar Blvd @ 38th St', lat: 30.3010, lon: -97.7505, status: 'ACTIVE', type: 'ARTERIAL' },
            { id: 'ATX007', name: 'I-35 @ Ben White Blvd', lat: 30.2295, lon: -97.7550, status: 'ACTIVE', type: 'INTERSTATE' },
            { id: 'ATX008', name: 'Airport Blvd @ I-35', lat: 30.3080, lon: -97.7125, status: 'ACTIVE', type: 'INTERCHANGE' },
            { id: 'ATX009', name: 'S 1st St @ Barton Springs', lat: 30.2620, lon: -97.7540, status: 'ACTIVE', type: 'DOWNTOWN' },
            { id: 'ATX010', name: 'E Cesar Chavez @ I-35', lat: 30.2600, lon: -97.7375, status: 'ACTIVE', type: 'INTERCHANGE' },
            { id: 'ATX011', name: 'Guadalupe St @ MLK Jr', lat: 30.2820, lon: -97.7420, status: 'ACTIVE', type: 'UNIVERSITY' },
            { id: 'ATX012', name: 'N Lamar @ 45th St', lat: 30.3100, lon: -97.7505, status: 'ACTIVE', type: 'ARTERIAL' },
            { id: 'ATX013', name: 'E 7th St @ Pleasant Valley', lat: 30.2660, lon: -97.7200, status: 'ACTIVE', type: 'EASTSIDE' },
            { id: 'ATX014', name: 'S Congress @ Oltorf', lat: 30.2450, lon: -97.7485, status: 'ACTIVE', type: 'ARTERIAL' },
            { id: 'ATX015', name: 'Parmer Ln @ MoPac', lat: 30.4190, lon: -97.7525, status: 'ACTIVE', type: 'HIGHWAY' },
            { id: 'ATX016', name: 'I-35 @ Rundberg Ln', lat: 30.3510, lon: -97.6920, status: 'ACTIVE', type: 'INTERSTATE' },
        ];
        console.log('[TRAFFIC-CAM] Loaded fallback Austin camera set');
        return this.cameras;
    }

    renderCamerasOnMap(viewer) {
        if (!viewer || !this.cameras.length) return;

        this.cameras.forEach(cam => {
            if (this.cameraEntities[cam.id]) return;

            const entity = viewer.entities.add({
                id: `tcam_${cam.id}`,
                position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 15),
                billboard: {
                    image: this._createCameraSvg(cam.status === 'ACTIVE' || cam.status === 'TURNED_ON'),
                    width: 20,
                    height: 20,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 5e6, 0.2),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER
                },
                label: {
                    text: cam.name,
                    font: '9px monospace',
                    fillColor: Cesium.Color.fromCssColorString('#00e5ff'),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -14),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 0.8, 2e6, 0.15),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000),
                    show: false
                }
            });

            this.cameraEntities[cam.id] = { entity, cam };
        });
    }

    removeCamerasFromMap(viewer) {
        if (!viewer) return;
        Object.keys(this.cameraEntities).forEach(id => {
            viewer.entities.remove(this.cameraEntities[id].entity);
        });
        this.cameraEntities = {};
    }

    toggle(viewer) {
        this.visible = !this.visible;
        if (this.visible) {
            this.renderCamerasOnMap(viewer);
        } else {
            this.removeCamerasFromMap(viewer);
        }
        return this.visible;
    }

    selectCamera(camId) {
        const entry = this.cameraEntities[camId];
        if (!entry) return null;
        this.selectedCamera = entry.cam;
        return entry.cam;
    }

    getCameraList() {
        return this.cameras.map(c => ({
            id: c.id,
            name: c.name,
            lat: c.lat,
            lon: c.lon,
            status: c.status,
            type: c.type
        }));
    }

    renderCameraPanel() {
        const panel = document.getElementById('camera-feed-panel');
        if (!panel) return;

        const listHtml = this.cameras.slice(0, 20).map(cam => `
            <div class="cam-item" data-cam-id="${cam.id}" onclick="window.TrafficCams.focusCamera('${cam.id}')">
                <span class="cam-status ${cam.status === 'ACTIVE' || cam.status === 'TURNED_ON' ? 'cam-online' : 'cam-offline'}">●</span>
                <span class="cam-name">${cam.name}</span>
                <span class="cam-type">${cam.type}</span>
            </div>
        `).join('');

        panel.innerHTML = listHtml || '<div style="color:var(--text-dim); font-size:10px;">NO CAMERAS LOADED</div>';
    }

    focusCamera(camId) {
        const entry = this.cameraEntities[camId];
        if (!entry || !window.viewer) return;

        const cam = entry.cam;
        window.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 2000),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
            },
            duration: 1.5
        });

        // Highlight selected
        document.querySelectorAll('.cam-item').forEach(el => el.classList.remove('cam-selected'));
        const el = document.querySelector(`[data-cam-id="${camId}"]`);
        if (el) el.classList.add('cam-selected');

        // Show label on map
        Object.values(this.cameraEntities).forEach(e => {
            if (e.entity.label) e.entity.label.show = false;
        });
        if (entry.entity.label) entry.entity.label.show = true;

        this.selectedCamera = cam;
        this._renderFeedViewer(cam);
    }

    _renderFeedViewer(cam) {
        const viewer = document.getElementById('cam-feed-viewer');
        if (!viewer) return;

        viewer.innerHTML = `
            <div class="cam-viewer-header">
                <span>FEED: ${cam.name}</span>
                <span class="cam-live-badge">● LIVE</span>
            </div>
            <div class="cam-viewer-body">
                ${cam.imageUrl ?
                    `<img src="${cam.imageUrl}" alt="${cam.name}" class="cam-image" onerror="this.parentElement.innerHTML='<div class=\\'cam-no-signal\\'>NO SIGNAL</div>'" />` :
                    `<div class="cam-simulated-feed">
                        <div class="cam-noise-overlay"></div>
                        <div class="cam-hud-overlay">
                            <div>CAM: ${cam.id}</div>
                            <div>${cam.lat.toFixed(4)}°N ${Math.abs(cam.lon).toFixed(4)}°W</div>
                            <div>STATUS: ${cam.status}</div>
                            <div class="cam-timestamp">${new Date().toISOString()}</div>
                        </div>
                    </div>`
                }
            </div>
        `;
    }

    _createCameraSvg(isActive) {
        const color = isActive ? '#00e5ff' : '#666';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <rect x="2" y="6" width="14" height="12" rx="2" fill="${color}" fill-opacity="0.8" stroke="#fff" stroke-width="0.8"/>
            <polygon points="18,8 22,5 22,19 18,16" fill="${color}" fill-opacity="0.6" stroke="#fff" stroke-width="0.5"/>
            <circle cx="9" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1" opacity="0.7"/>
            <circle cx="9" cy="12" r="1" fill="#fff" opacity="0.9"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => {
            if (this.visible) this.loadCameras().then(() => this.renderCameraPanel());
        }, REFRESH_INTERVAL);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    getStats() {
        const active = this.cameras.filter(c => c.status === 'ACTIVE' || c.status === 'TURNED_ON').length;
        return {
            total: this.cameras.length,
            active,
            offline: this.cameras.length - active,
            visible: this.visible
        };
    }
}

window.TrafficCams = new TrafficCameraSystem();
export default window.TrafficCams;
