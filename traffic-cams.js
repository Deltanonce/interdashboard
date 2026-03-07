// traffic-cams.js — Austin Real-Time Traffic Camera System
// Pulls live camera feeds from Austin's Open Data portal (CoA CCTV)

const AUSTIN_CCTV_API = 'https://data.austintexas.gov/resource/b4k4-adkb.json';
const REFRESH_INTERVAL = 30000; // 30s refresh for camera list
const MAX_CAMS = 200;

// Austin TxDOT live camera snapshot base (public, no auth required)
const TXDOT_SNAPSHOT_BASE = 'https://its.txdot.gov/ITS_WEB/FrontEnd/snapshots/';
// Austin camera IDs map to TxDOT snapshot URLs: CCTV{id}.jpg (refreshed every ~30s)
const TXDOT_CCTV_IDS = {
    'ATX001': 'CCTV506', 'ATX002': 'CCTV515', 'ATX003': 'CCTV509',
    'ATX004': 'CCTV520', 'ATX005': 'CCTV505', 'ATX006': 'CCTV518',
    'ATX007': 'CCTV502', 'ATX008': 'CCTV510', 'ATX009': 'CCTV504',
    'ATX010': 'CCTV503', 'ATX011': 'CCTV507', 'ATX012': 'CCTV519',
    'ATX013': 'CCTV508', 'ATX014': 'CCTV514', 'ATX015': 'CCTV522',
    'ATX016': 'CCTV512'
};

class TrafficCameraSystem {
    constructor() {
        this.cameras = [];
        this.activeFeed = null;
        this.cameraEntities = {};
        this.visible = false;
        this.refreshTimer = null;
        this.selectedCamera = null;
        this.feedPanel = null;
        this.popup = null;
        this.popupRefreshTimer = null;
        this._mapClickHandler = null;
    }

    async loadCameras() {
        try {
            const url = `${AUSTIN_CCTV_API}?$limit=${MAX_CAMS}&$where=camera_status='TURNED_ON'`;
            const res = await fetch(`/api/traffic-cams?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                this.cameras = this._normalizeCameras(data);
                if (this.cameras.length > 0) {
                    console.log(`[TRAFFIC-CAM] Loaded ${this.cameras.length} Austin cameras via proxy`);
                    return this.cameras;
                }
            }
            throw new Error('Empty or unparseable response from proxy');
        } catch (e) {
            console.warn('[TRAFFIC-CAM] Proxy failed:', e.message, '— trying direct fetch');
        }

        // Fallback: try direct fetch (works if Austin API allows CORS)
        try {
            const url = `${AUSTIN_CCTV_API}?$limit=${MAX_CAMS}&$where=camera_status='TURNED_ON'`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.cameras = this._normalizeCameras(data);
                    console.log(`[TRAFFIC-CAM] Loaded ${this.cameras.length} Austin cameras (direct)`);
                    return this.cameras;
                }
            }
        } catch (e2) {
            console.warn('[TRAFFIC-CAM] Direct fetch failed:', e2.message);
        }

        // Last resort: hardcoded fallback cameras
        return this._loadFallbackCameras();
    }

    _normalizeCameras(data) {
        return data
            .filter(c => {
                // Austin API uses GeoJSON: location.coordinates = [lon, lat]
                if (c.location && c.location.coordinates) return true;
                if (c.location_latitude && c.location_longitude) return true;
                return false;
            })
            .map((c, i) => {
                const id = c.camera_id || `cam_${i}`;
                let lat, lon;
                if (c.location && c.location.coordinates) {
                    lon = parseFloat(c.location.coordinates[0]);
                    lat = parseFloat(c.location.coordinates[1]);
                } else {
                    lat = parseFloat(c.location_latitude);
                    lon = parseFloat(c.location_longitude);
                }
                return {
                    id,
                    name: (c.location_name || c.camera_name || `Camera ${i}`).trim(),
                    lat,
                    lon,
                    status: c.camera_status || 'UNKNOWN',
                    imageUrl: c.screenshot_address || c.camera_mfg_url || null,
                    turn: c.turn_on_date || null,
                    type: c.location_type || (c.primary_st_segment_id ? 'INTERSECTION' : 'CORRIDOR'),
                    signal: c.signal_eng_area || null,
                    council: c.council_district || null
                };
            });
    }

    _loadFallbackCameras() {
        // Hardcoded Austin traffic camera hotspots with TxDOT snapshot URLs
        this.cameras = [
            { id: 'ATX001', name: 'I-35 @ Riverside Dr', lat: 30.2520, lon: -97.7380, status: 'ACTIVE', type: 'INTERSTATE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX001}.jpg` },
            { id: 'ATX002', name: 'MoPac @ Bee Cave Rd', lat: 30.2600, lon: -97.7950, status: 'ACTIVE', type: 'HIGHWAY', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX002}.jpg` },
            { id: 'ATX003', name: 'I-35 @ 51st St', lat: 30.3030, lon: -97.7190, status: 'ACTIVE', type: 'INTERSTATE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX003}.jpg` },
            { id: 'ATX004', name: 'US 183 @ Burnet Rd', lat: 30.3700, lon: -97.7180, status: 'ACTIVE', type: 'HIGHWAY', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX004}.jpg` },
            { id: 'ATX005', name: 'Congress Ave @ 6th St', lat: 30.2672, lon: -97.7431, status: 'ACTIVE', type: 'DOWNTOWN', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX005}.jpg` },
            { id: 'ATX006', name: 'Lamar Blvd @ 38th St', lat: 30.3010, lon: -97.7505, status: 'ACTIVE', type: 'ARTERIAL', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX006}.jpg` },
            { id: 'ATX007', name: 'I-35 @ Ben White Blvd', lat: 30.2295, lon: -97.7550, status: 'ACTIVE', type: 'INTERSTATE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX007}.jpg` },
            { id: 'ATX008', name: 'Airport Blvd @ I-35', lat: 30.3080, lon: -97.7125, status: 'ACTIVE', type: 'INTERCHANGE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX008}.jpg` },
            { id: 'ATX009', name: 'S 1st St @ Barton Springs', lat: 30.2620, lon: -97.7540, status: 'ACTIVE', type: 'DOWNTOWN', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX009}.jpg` },
            { id: 'ATX010', name: 'E Cesar Chavez @ I-35', lat: 30.2600, lon: -97.7375, status: 'ACTIVE', type: 'INTERCHANGE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX010}.jpg` },
            { id: 'ATX011', name: 'Guadalupe St @ MLK Jr', lat: 30.2820, lon: -97.7420, status: 'ACTIVE', type: 'UNIVERSITY', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX011}.jpg` },
            { id: 'ATX012', name: 'N Lamar @ 45th St', lat: 30.3100, lon: -97.7505, status: 'ACTIVE', type: 'ARTERIAL', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX012}.jpg` },
            { id: 'ATX013', name: 'E 7th St @ Pleasant Valley', lat: 30.2660, lon: -97.7200, status: 'ACTIVE', type: 'EASTSIDE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX013}.jpg` },
            { id: 'ATX014', name: 'S Congress @ Oltorf', lat: 30.2450, lon: -97.7485, status: 'ACTIVE', type: 'ARTERIAL', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX014}.jpg` },
            { id: 'ATX015', name: 'Parmer Ln @ MoPac', lat: 30.4190, lon: -97.7525, status: 'ACTIVE', type: 'HIGHWAY', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX015}.jpg` },
            { id: 'ATX016', name: 'I-35 @ Rundberg Ln', lat: 30.3510, lon: -97.6920, status: 'ACTIVE', type: 'INTERSTATE', imageUrl: `${TXDOT_SNAPSHOT_BASE}${TXDOT_CCTV_IDS.ATX016}.jpg` },
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

        // Register click handler on map entities
        this._setupMapClickHandler(viewer);
    }

    _setupMapClickHandler(viewer) {
        if (this._mapClickHandler) return;
        this._mapClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        this._mapClickHandler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && picked.id && typeof picked.id.id === 'string' && picked.id.id.startsWith('tcam_')) {
                const camId = picked.id.id.replace('tcam_', '');
                this.focusCamera(camId);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    _destroyMapClickHandler() {
        if (this._mapClickHandler) {
            this._mapClickHandler.destroy();
            this._mapClickHandler = null;
        }
    }

    removeCamerasFromMap(viewer) {
        if (!viewer) return;
        Object.keys(this.cameraEntities).forEach(id => {
            viewer.entities.remove(this.cameraEntities[id].entity);
        });
        this.cameraEntities = {};
        this._destroyMapClickHandler();
        this.closePopup();
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
        if (!entry) {
            // Try finding the cam from the list directly
            const cam = this.cameras.find(c => c.id === camId);
            if (cam) {
                this.selectedCamera = cam;
                this.openPopup(cam);
            }
            return;
        }

        const cam = entry.cam;

        // Fly to camera on map
        if (window.viewer) {
            window.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 2000),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                },
                duration: 1.5
            });
        }

        // Highlight selected in sidebar
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
        this.openPopup(cam);
    }

    // ═══════════════════════════════════════════
    //  LIVE VIDEO POPUP
    // ═══════════════════════════════════════════

    openPopup(cam) {
        this.closePopup();
        this.selectedCamera = cam;

        // Build the image URL with cache-bust for live refresh
        const feedUrl = this._getFeedUrl(cam);
        const now = new Date();
        const ts = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

        const overlay = document.createElement('div');
        overlay.id = 'cctv-popup-overlay';
        overlay.className = 'cctv-popup-overlay';
        overlay.innerHTML = `
            <div class="cctv-popup" id="cctv-popup">
                <div class="cctv-popup-header">
                    <div class="cctv-popup-title">
                        <span class="cctv-popup-icon">📹</span>
                        <span>CCTV FEED — ${this._escapeHtml(cam.name)}</span>
                    </div>
                    <div class="cctv-popup-controls">
                        <span class="cctv-live-indicator" id="cctv-live-dot">● LIVE</span>
                        <button class="cctv-popup-close" id="cctv-popup-close" title="Close">&times;</button>
                    </div>
                </div>
                <div class="cctv-popup-body">
                    <div class="cctv-feed-container" id="cctv-feed-container">
                        ${feedUrl
                            ? `<img src="${feedUrl}" alt="${this._escapeHtml(cam.name)}" class="cctv-feed-img" id="cctv-feed-img" />`
                            : ''}
                        <div class="cctv-feed-hud">
                            <div class="cctv-hud-top">
                                <span>CAM ${this._escapeHtml(cam.id)}</span>
                                <span id="cctv-hud-ts">${ts}</span>
                            </div>
                            <div class="cctv-crosshair"></div>
                            <div class="cctv-hud-bottom">
                                <span>${cam.lat.toFixed(5)}°N  ${Math.abs(cam.lon).toFixed(5)}°W</span>
                                <span id="cctv-hud-refresh">REFRESH: 5s</span>
                            </div>
                        </div>
                        <div class="cctv-scanline"></div>
                        ${!feedUrl ? `<div class="cctv-no-feed"><div class="cctv-static-noise"></div><span>ACQUIRING SIGNAL...</span></div>` : ''}
                    </div>
                    <div class="cctv-info-panel">
                        <div class="cctv-info-title">CAMERA INFORMATION</div>
                        <div class="cctv-info-grid">
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">LOCATION</span>
                                <span class="cctv-info-value">${this._escapeHtml(cam.name)}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">STATUS</span>
                                <span class="cctv-info-value cctv-status-${(cam.status === 'ACTIVE' || cam.status === 'TURNED_ON') ? 'on' : 'off'}">
                                    ${cam.status === 'ACTIVE' || cam.status === 'TURNED_ON' ? '● ONLINE' : '○ OFFLINE'}
                                </span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">TYPE</span>
                                <span class="cctv-info-value">${this._escapeHtml(cam.type || 'GENERAL')}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">COORDINATES</span>
                                <span class="cctv-info-value">${cam.lat.toFixed(5)}, ${cam.lon.toFixed(5)}</span>
                            </div>
                            ${cam.signal ? `<div class="cctv-info-item"><span class="cctv-info-label">SIGNAL AREA</span><span class="cctv-info-value">${this._escapeHtml(cam.signal)}</span></div>` : ''}
                            ${cam.council ? `<div class="cctv-info-item"><span class="cctv-info-label">DISTRICT</span><span class="cctv-info-value">${this._escapeHtml(String(cam.council))}</span></div>` : ''}
                            ${cam.turn ? `<div class="cctv-info-item"><span class="cctv-info-label">ACTIVATED</span><span class="cctv-info-value">${this._escapeHtml(cam.turn)}</span></div>` : ''}
                        </div>
                        <div class="cctv-info-msg" id="cctv-info-msg">
                            <span class="cctv-msg-icon">ℹ</span>
                            Feed refreshes every 5 seconds. Image provided by Austin TxDOT / City of Austin Open Data.
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.popup = overlay;

        // Close handlers
        overlay.querySelector('#cctv-popup-close').addEventListener('click', () => this.closePopup());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closePopup();
        });
        document.addEventListener('keydown', this._escKeyHandler = (e) => {
            if (e.key === 'Escape') this.closePopup();
        });

        // Auto-refresh feed image every 5s for live effect
        if (feedUrl) {
            this._startPopupRefresh(cam);
        } else {
            // Try loading the image after a short delay (signal acquisition effect)
            setTimeout(() => {
                const url = this._getFeedUrl(cam);
                if (url) {
                    const container = document.getElementById('cctv-feed-container');
                    const noFeed = container?.querySelector('.cctv-no-feed');
                    if (noFeed) noFeed.remove();
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = cam.name;
                    img.className = 'cctv-feed-img';
                    img.id = 'cctv-feed-img';
                    container?.prepend(img);
                    this._startPopupRefresh(cam);
                    this._showInfoMsg('Signal acquired. Live feed active.');
                } else {
                    this._showInfoMsg('No live feed URL available for this camera. Showing tactical overlay.', 'warn');
                }
            }, 2000);
        }

        // Entrance animation
        requestAnimationFrame(() => overlay.classList.add('cctv-popup-visible'));

        console.log(`[CCTV] Opened live feed: ${cam.name}`);
    }

    _startPopupRefresh(cam) {
        if (this.popupRefreshTimer) clearInterval(this.popupRefreshTimer);
        let refreshCount = 0;
        this.popupRefreshTimer = setInterval(() => {
            const img = document.getElementById('cctv-feed-img');
            const tsEl = document.getElementById('cctv-hud-ts');
            if (!img || !this.popup) {
                clearInterval(this.popupRefreshTimer);
                return;
            }
            refreshCount++;
            const url = this._getFeedUrl(cam);
            if (url) {
                // Cache-bust by appending timestamp
                img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
            }
            if (tsEl) {
                const now = new Date();
                tsEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            }
            // Flash the live indicator
            const dot = document.getElementById('cctv-live-dot');
            if (dot) {
                dot.classList.add('cctv-live-pulse');
                setTimeout(() => dot.classList.remove('cctv-live-pulse'), 400);
            }
            // Update refresh counter
            const refEl = document.getElementById('cctv-hud-refresh');
            if (refEl) refEl.textContent = `FRAMES: ${refreshCount}`;
        }, 5000);
    }

    closePopup() {
        if (this.popupRefreshTimer) {
            clearInterval(this.popupRefreshTimer);
            this.popupRefreshTimer = null;
        }
        if (this.popup) {
            this.popup.classList.remove('cctv-popup-visible');
            setTimeout(() => {
                this.popup?.remove();
                this.popup = null;
            }, 200);
        }
        if (this._escKeyHandler) {
            document.removeEventListener('keydown', this._escKeyHandler);
            this._escKeyHandler = null;
        }
    }

    _getFeedUrl(cam) {
        // Priority: direct imageUrl from API data, then TxDOT mapping
        if (cam.imageUrl) return cam.imageUrl;
        const txdotId = TXDOT_CCTV_IDS[cam.id];
        if (txdotId) return `${TXDOT_SNAPSHOT_BASE}${txdotId}.jpg`;
        return null;
    }

    _showInfoMsg(text, level = 'info') {
        const el = document.getElementById('cctv-info-msg');
        if (!el) return;
        const icon = level === 'warn' ? '⚠' : 'ℹ';
        el.innerHTML = `<span class="cctv-msg-icon">${icon}</span> ${this._escapeHtml(text)}`;
        if (level === 'warn') el.classList.add('cctv-msg-warn');
        else el.classList.remove('cctv-msg-warn');
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    _renderFeedViewer(cam) {
        const viewer = document.getElementById('cam-feed-viewer');
        if (!viewer) return;

        const feedUrl = this._getFeedUrl(cam);
        viewer.innerHTML = `
            <div class="cam-viewer-header">
                <span>FEED: ${this._escapeHtml(cam.name)}</span>
                <span class="cam-live-badge">● LIVE</span>
            </div>
            <div class="cam-viewer-body" style="cursor:pointer" onclick="window.TrafficCams.openPopup(window.TrafficCams.selectedCamera)">
                ${feedUrl
                    ? `<img src="${feedUrl}" alt="${this._escapeHtml(cam.name)}" class="cam-image" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=cam-no-signal>NO SIGNAL — CLICK TO RETRY</div>'" />`
                    : `<div class="cam-simulated-feed">
                        <div class="cam-noise-overlay"></div>
                        <div class="cam-hud-overlay">
                            <div>CAM: ${this._escapeHtml(cam.id)}</div>
                            <div>${cam.lat.toFixed(4)}°N ${Math.abs(cam.lon).toFixed(4)}°W</div>
                            <div>STATUS: ${cam.status}</div>
                            <div class="cam-timestamp">${new Date().toISOString()}</div>
                        </div>
                    </div>`
                }
                <div style="text-align:center;font-size:8px;color:var(--neon-cyan);padding:2px;cursor:pointer;">▶ CLICK TO EXPAND LIVE VIEW</div>
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
