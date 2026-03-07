// traffic-cams.js — Middle East OSINT / CCTV Surveillance System
// Strategic camera network for conflict zone monitoring and ISR analysis

const REFRESH_INTERVAL = 30000;

// Feed types: 'image' (auto-refresh JPEG), 'stream' (embedded live player), 'tactical' (simulated ISR overlay)
// All cameras reference publicly available OSINT webcam sources

// ─── STRATEGIC CAMERA DATABASE ───
// Curated positions at critical infrastructure, chokepoints, and conflict-adjacent areas.
// feedUrl points to real public webcam snapshots/embeds where available.
const MIDDLE_EAST_CAMERAS = [
    // ── MARITIME CHOKEPOINTS ──
    { id: 'ME001', name: 'Suez Canal — Port Said Entrance', lat: 31.2653, lon: 32.3019, status: 'ACTIVE', type: 'CHOKEPOINT', region: 'EGYPT', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/wIBSJMp8M_g?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME002', name: 'Suez Canal — Great Bitter Lake', lat: 30.3500, lon: 32.3700, status: 'ACTIVE', type: 'CHOKEPOINT', region: 'EGYPT', feedType: 'tactical', feedUrl: null, classification: 'RESTRICTED' },
    { id: 'ME003', name: 'Strait of Hormuz — Bandar Abbas', lat: 27.1832, lon: 56.2666, status: 'ACTIVE', type: 'CHOKEPOINT', region: 'IRAN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME004', name: 'Bab el-Mandeb — Perim Island', lat: 12.6550, lon: 43.4200, status: 'ACTIVE', type: 'CHOKEPOINT', region: 'YEMEN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },

    // ── TURKEY / BOSPHORUS ──
    { id: 'ME005', name: 'Istanbul — Bosphorus Bridge', lat: 41.0451, lon: 29.0343, status: 'ACTIVE', type: 'STRATEGIC', region: 'TURKEY', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/cPI7VCsgZXE?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME006', name: 'Istanbul — Galata Tower', lat: 41.0256, lon: 28.9744, status: 'ACTIVE', type: 'URBAN', region: 'TURKEY', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/VJxs6MCP-D4?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME007', name: 'Incirlik AB — Perimeter Approach', lat: 37.0021, lon: 35.4259, status: 'ACTIVE', type: 'MILITARY', region: 'TURKEY', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },

    // ── UAE / GULF STATES ──
    { id: 'ME008', name: 'Dubai — Sheikh Zayed Road', lat: 25.2048, lon: 55.2708, status: 'ACTIVE', type: 'INFRASTRUCTURE', region: 'UAE', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/SzmJE31rYMw?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME009', name: 'Dubai — Jebel Ali Port', lat: 25.0145, lon: 55.0640, status: 'ACTIVE', type: 'PORT', region: 'UAE', feedType: 'tactical', feedUrl: null, classification: 'RESTRICTED' },
    { id: 'ME010', name: 'Abu Dhabi — Al Dhafra AB Approach', lat: 24.2500, lon: 54.5500, status: 'ACTIVE', type: 'MILITARY', region: 'UAE', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME011', name: 'Doha — Al Udeid AB Perimeter', lat: 25.1173, lon: 51.3150, status: 'ACTIVE', type: 'MILITARY', region: 'QATAR', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME012', name: 'Bahrain — Naval Support Activity', lat: 26.2361, lon: 50.5860, status: 'ACTIVE', type: 'MILITARY', region: 'BAHRAIN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },

    // ── SAUDI ARABIA ──
    { id: 'ME013', name: 'Riyadh — King Fahd Road', lat: 24.7136, lon: 46.6753, status: 'ACTIVE', type: 'INFRASTRUCTURE', region: 'SAUDI', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/ia6hI1YMWFI?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME014', name: 'Jeddah — Islamic Port', lat: 21.4858, lon: 39.1925, status: 'ACTIVE', type: 'PORT', region: 'SAUDI', feedType: 'tactical', feedUrl: null, classification: 'RESTRICTED' },
    { id: 'ME015', name: 'Mecca — Grand Mosque Perimeter', lat: 21.4225, lon: 39.8262, status: 'ACTIVE', type: 'CRITICAL', region: 'SAUDI', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/lXFKH3VPSsI?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },

    // ── CONFLICT ZONES ──
    { id: 'ME016', name: 'Baghdad — Green Zone', lat: 33.3120, lon: 44.3615, status: 'ACTIVE', type: 'CONFLICT', region: 'IRAQ', feedType: 'tactical', feedUrl: null, classification: 'TOP SECRET' },
    { id: 'ME017', name: 'Baghdad — Route Irish (BIAP Rd)', lat: 33.2700, lon: 44.2300, status: 'ACTIVE', type: 'CONFLICT', region: 'IRAQ', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME018', name: 'Basra — Shatt al-Arab Waterway', lat: 30.5200, lon: 47.7800, status: 'ACTIVE', type: 'PORT', region: 'IRAQ', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME019', name: 'Damascus — Umayyad Square', lat: 33.5138, lon: 36.2765, status: 'DEGRADED', type: 'CONFLICT', region: 'SYRIA', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME020', name: 'Aleppo — Citadel Sector', lat: 36.1990, lon: 37.1620, status: 'DEGRADED', type: 'CONFLICT', region: 'SYRIA', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME021', name: 'Sanaa — Airport Ring Road', lat: 15.3694, lon: 44.2194, status: 'DEGRADED', type: 'CONFLICT', region: 'YEMEN', feedType: 'tactical', feedUrl: null, classification: 'TOP SECRET' },
    { id: 'ME022', name: 'Aden — Port Approach', lat: 12.7855, lon: 45.0187, status: 'ACTIVE', type: 'PORT', region: 'YEMEN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME023', name: 'Hodeidah — Port Facility', lat: 14.7980, lon: 42.9540, status: 'DEGRADED', type: 'CONFLICT', region: 'YEMEN', feedType: 'tactical', feedUrl: null, classification: 'TOP SECRET' },

    // ── ISRAEL / LEVANT ──
    { id: 'ME024', name: 'Tel Aviv — Azrieli Skyline', lat: 32.0740, lon: 34.7920, status: 'ACTIVE', type: 'URBAN', region: 'ISRAEL', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/8ZA4GRNdu_0?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME025', name: 'Haifa — Port and Bay', lat: 32.8191, lon: 34.9983, status: 'ACTIVE', type: 'PORT', region: 'ISRAEL', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/Q_VbjN1p2fk?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME026', name: 'Jerusalem — Old City Walls', lat: 31.7767, lon: 35.2345, status: 'ACTIVE', type: 'CRITICAL', region: 'ISRAEL', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/1x_FGXLGD6Y?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },
    { id: 'ME027', name: 'Beirut — Port District', lat: 33.9020, lon: 35.5180, status: 'ACTIVE', type: 'PORT', region: 'LEBANON', feedType: 'tactical', feedUrl: null, classification: 'RESTRICTED' },
    { id: 'ME028', name: 'Amman — Downtown / Citadel', lat: 31.9539, lon: 35.9340, status: 'ACTIVE', type: 'URBAN', region: 'JORDAN', feedType: 'stream', feedUrl: 'https://www.youtube.com/embed/wlfbbkjODig?autoplay=1&mute=1', classification: 'UNCLASSIFIED' },

    // ── IRAN ──
    { id: 'ME029', name: 'Tehran — Azadi Tower', lat: 35.6997, lon: 51.3381, status: 'ACTIVE', type: 'URBAN', region: 'IRAN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
    { id: 'ME030', name: 'Isfahan — Uranium Conversion Facility', lat: 32.6546, lon: 51.6680, status: 'ACTIVE', type: 'NUCLEAR', region: 'IRAN', feedType: 'tactical', feedUrl: null, classification: 'TOP SECRET' },
    { id: 'ME031', name: 'Bushehr — Nuclear Power Plant', lat: 28.8330, lon: 50.8850, status: 'ACTIVE', type: 'NUCLEAR', region: 'IRAN', feedType: 'tactical', feedUrl: null, classification: 'TOP SECRET' },
    { id: 'ME032', name: 'Chabahar — Port', lat: 25.2919, lon: 60.6430, status: 'ACTIVE', type: 'PORT', region: 'IRAN', feedType: 'tactical', feedUrl: null, classification: 'SECRET' },
];

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
        // Load the strategic Middle East camera database
        this.cameras = MIDDLE_EAST_CAMERAS.map(c => ({ ...c }));
        console.log(`[ISR-CAM] Loaded ${this.cameras.length} strategic surveillance nodes across Middle East AOR`);
        return this.cameras;
    }

    renderCamerasOnMap(viewer) {
        if (!viewer || !this.cameras.length) return;

        this.cameras.forEach(cam => {
            if (this.cameraEntities[cam.id]) return;

            const isActive = cam.status === 'ACTIVE';
            const isDegraded = cam.status === 'DEGRADED';

            const entity = viewer.entities.add({
                id: `tcam_${cam.id}`,
                position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 50),
                billboard: {
                    image: this._createCameraSvg(isActive, isDegraded, cam.type),
                    width: 22,
                    height: 22,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e4, 1.5, 1e7, 0.3),
                    verticalOrigin: Cesium.VerticalOrigin.CENTER
                },
                label: {
                    text: cam.name,
                    font: '9px monospace',
                    fillColor: Cesium.Color.fromCssColorString(isDegraded ? '#ff9100' : '#00e5ff'),
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -16),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1e4, 0.8, 5e6, 0.15),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1500000),
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

        const typeColors = {
            'CHOKEPOINT': '#ff2244', 'MILITARY': '#ff9100', 'CONFLICT': '#ff2244',
            'NUCLEAR': '#ff00ff', 'PORT': '#00e5ff', 'STRATEGIC': '#ffe132',
            'INFRASTRUCTURE': '#2ed573', 'URBAN': '#00e5ff', 'CRITICAL': '#ff9100'
        };

        const listHtml = this.cameras.map(cam => {
            const color = typeColors[cam.type] || '#00e5ff';
            const statusDot = cam.status === 'ACTIVE'
                ? '<span class="cam-status cam-online">●</span>'
                : '<span class="cam-status cam-offline">◐</span>';
            return `
            <div class="cam-item" data-cam-id="${cam.id}" onclick="window.TrafficCams.focusCamera('${cam.id}')">
                ${statusDot}
                <span class="cam-name">${cam.name}</span>
                <span class="cam-type" style="color:${color}">${cam.type}</span>
            </div>`;
        }).join('');

        panel.innerHTML = listHtml || '<div style="color:var(--text-dim); font-size:10px;">NO SURVEILLANCE NODES</div>';
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

        const now = new Date();
        const ts = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        const isStream = cam.feedType === 'stream' && cam.feedUrl;
        const isTactical = cam.feedType === 'tactical' || !cam.feedUrl;
        const latDir = cam.lat >= 0 ? 'N' : 'S';
        const lonDir = cam.lon >= 0 ? 'E' : 'W';
        const classColor = { 'UNCLASSIFIED': '#00ff41', 'RESTRICTED': '#ffe132', 'SECRET': '#ff9100', 'TOP SECRET': '#ff2244' }[cam.classification] || '#00e5ff';

        const overlay = document.createElement('div');
        overlay.id = 'cctv-popup-overlay';
        overlay.className = 'cctv-popup-overlay';
        overlay.innerHTML = `
            <div class="cctv-popup" id="cctv-popup">
                <div class="cctv-popup-header">
                    <div class="cctv-popup-title">
                        <span class="cctv-popup-icon">📡</span>
                        <span>ISR FEED — ${this._escapeHtml(cam.name)}</span>
                    </div>
                    <div class="cctv-popup-controls">
                        <span class="cctv-classification-badge" style="color:${classColor};border-color:${classColor}">${this._escapeHtml(cam.classification || 'UNCLASSIFIED')}</span>
                        <span class="cctv-live-indicator" id="cctv-live-dot">● LIVE</span>
                        <button class="cctv-popup-close" id="cctv-popup-close" title="Close">&times;</button>
                    </div>
                </div>
                <div class="cctv-popup-body">
                    <div class="cctv-feed-container" id="cctv-feed-container">
                        ${isStream
                            ? `<iframe src="${cam.feedUrl}" class="cctv-feed-iframe" id="cctv-feed-iframe" allow="autoplay; encrypted-media" allowfullscreen frameborder="0"></iframe>`
                            : isTactical
                                ? this._buildTacticalOverlay(cam, ts)
                                : `<img src="${cam.feedUrl}" alt="${this._escapeHtml(cam.name)}" class="cctv-feed-img" id="cctv-feed-img" />`
                        }
                        <div class="cctv-feed-hud">
                            <div class="cctv-hud-top">
                                <span>NODE ${this._escapeHtml(cam.id)} // ${this._escapeHtml(cam.region || '')}</span>
                                <span id="cctv-hud-ts">${ts}</span>
                            </div>
                            ${!isStream ? '<div class="cctv-crosshair"></div>' : ''}
                            <div class="cctv-hud-bottom">
                                <span>${Math.abs(cam.lat).toFixed(5)}°${latDir}  ${Math.abs(cam.lon).toFixed(5)}°${lonDir}</span>
                                <span id="cctv-hud-refresh">${isStream ? 'STREAM: LIVE' : isTactical ? 'TACTICAL OVERLAY' : 'REFRESH: 5s'}</span>
                            </div>
                        </div>
                        ${!isStream ? '<div class="cctv-scanline"></div>' : ''}
                    </div>
                    <div class="cctv-info-panel">
                        <div class="cctv-info-title">SURVEILLANCE NODE INFORMATION</div>
                        <div class="cctv-info-grid">
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">DESIGNATION</span>
                                <span class="cctv-info-value">${this._escapeHtml(cam.name)}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">STATUS</span>
                                <span class="cctv-info-value cctv-status-${cam.status === 'ACTIVE' ? 'on' : 'off'}">
                                    ${cam.status === 'ACTIVE' ? '● OPERATIONAL' : '◐ DEGRADED'}
                                </span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">CATEGORY</span>
                                <span class="cctv-info-value">${this._escapeHtml(cam.type || 'GENERAL')}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">COORDINATES</span>
                                <span class="cctv-info-value">${Math.abs(cam.lat).toFixed(5)}°${latDir}, ${Math.abs(cam.lon).toFixed(5)}°${lonDir}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">REGION / AOR</span>
                                <span class="cctv-info-value">${this._escapeHtml(cam.region || 'UNKNOWN')}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">FEED TYPE</span>
                                <span class="cctv-info-value">${isStream ? 'LIVE VIDEO STREAM' : isTactical ? 'TACTICAL / SIMINT' : 'SNAPSHOT RELAY'}</span>
                            </div>
                            <div class="cctv-info-item">
                                <span class="cctv-info-label">CLASSIFICATION</span>
                                <span class="cctv-info-value" style="color:${classColor}">${this._escapeHtml(cam.classification || 'UNCLASSIFIED')}</span>
                            </div>
                        </div>
                        <div class="cctv-info-msg" id="cctv-info-msg">
                            <span class="cctv-msg-icon">ℹ</span>
                            ${isStream
                                ? 'Live video stream from OSINT source. Feed may have latency.'
                                : isTactical
                                    ? 'Tactical overlay — simulated ISR feed. Real sensor data requires SCI access.'
                                    : 'Snapshot relay — image refreshes periodically from remote sensor.'}
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

        // Start timestamp update for all feed types
        this._startPopupRefresh(cam);

        // Entrance animation
        requestAnimationFrame(() => overlay.classList.add('cctv-popup-visible'));
        console.log(`[ISR] Opened feed: ${cam.name} [${cam.feedType}]`);
    }

    _buildTacticalOverlay(cam, ts) {
        const statusColor = cam.status === 'ACTIVE' ? '#00ff41' : '#ff9100';
        return `
            <div class="cctv-tactical-feed">
                <div class="cctv-static-noise"></div>
                <div class="cctv-tactical-grid"></div>
                <div class="cctv-tactical-center">
                    <div class="cctv-tactical-icon">⬡</div>
                    <div class="cctv-tactical-label" style="color:${statusColor}">${this._escapeHtml(cam.type)}</div>
                    <div class="cctv-tactical-sublabel">${this._escapeHtml(cam.region || '')}</div>
                    <div class="cctv-tactical-status" style="color:${statusColor}">
                        ${cam.status === 'ACTIVE' ? '■ SENSOR ACTIVE' : '▲ SIGNAL DEGRADED'}
                    </div>
                    <div class="cctv-tactical-class" style="color:var(--neon-red)">
                        CLASSIFICATION: ${this._escapeHtml(cam.classification || 'UNCLASSIFIED')}
                    </div>
                    <div class="cctv-tactical-note">RESTRICTED FEED — REQUIRES SCI CLEARANCE</div>
                </div>
            </div>`;
    }

    _startPopupRefresh(cam) {
        if (this.popupRefreshTimer) clearInterval(this.popupRefreshTimer);
        let refreshCount = 0;
        this.popupRefreshTimer = setInterval(() => {
            const tsEl = document.getElementById('cctv-hud-ts');
            if (!this.popup) { clearInterval(this.popupRefreshTimer); return; }
            refreshCount++;

            // Update timestamp
            if (tsEl) {
                const now = new Date();
                tsEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            }

            // Flash live indicator
            const dot = document.getElementById('cctv-live-dot');
            if (dot) {
                dot.classList.add('cctv-live-pulse');
                setTimeout(() => dot.classList.remove('cctv-live-pulse'), 400);
            }

            // If image feed, refresh the image
            if (cam.feedType === 'image' && cam.feedUrl) {
                const img = document.getElementById('cctv-feed-img');
                if (img) {
                    img.src = cam.feedUrl + (cam.feedUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
                }
            }

            const refEl = document.getElementById('cctv-hud-refresh');
            if (refEl && cam.feedType !== 'stream') {
                refEl.textContent = `UPTIME: ${refreshCount * 5}s`;
            }
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
        if (cam.feedUrl) return cam.feedUrl;
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

        const isStream = cam.feedType === 'stream' && cam.feedUrl;
        const latDir = cam.lat >= 0 ? 'N' : 'S';
        const lonDir = cam.lon >= 0 ? 'E' : 'W';

        viewer.innerHTML = `
            <div class="cam-viewer-header">
                <span>NODE: ${this._escapeHtml(cam.name)}</span>
                <span class="cam-live-badge">${isStream ? '● STREAM' : '● ISR'}</span>
            </div>
            <div class="cam-viewer-body" style="cursor:pointer" onclick="window.TrafficCams.openPopup(window.TrafficCams.selectedCamera)">
                ${isStream
                    ? `<div class="cam-simulated-feed" style="background:#0a0e14;color:var(--neon-green);display:flex;align-items:center;justify-content:center;font-size:10px;height:80px;">▶ CLICK TO OPEN LIVE STREAM</div>`
                    : `<div class="cam-simulated-feed">
                        <div class="cam-noise-overlay"></div>
                        <div class="cam-hud-overlay">
                            <div>NODE: ${this._escapeHtml(cam.id)}</div>
                            <div>${Math.abs(cam.lat).toFixed(4)}°${latDir} ${Math.abs(cam.lon).toFixed(4)}°${lonDir}</div>
                            <div>STATUS: ${cam.status} | ${cam.type}</div>
                            <div class="cam-timestamp">${new Date().toISOString()}</div>
                        </div>
                    </div>`
                }
                <div style="text-align:center;font-size:8px;color:var(--neon-cyan);padding:2px;cursor:pointer;">▶ CLICK TO EXPAND ${isStream ? 'LIVE STREAM' : 'FEED'}</div>
            </div>
        `;
    }

    _createCameraSvg(isActive, isDegraded, type) {
        const color = isDegraded ? '#ff9100' : isActive ? '#00e5ff' : '#666';
        const ring = (type === 'MILITARY' || type === 'NUCLEAR') ? '#ff2244' : (type === 'CONFLICT') ? '#ff9100' : 'none';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            ${ring !== 'none' ? `<circle cx="12" cy="12" r="11" fill="none" stroke="${ring}" stroke-width="1.5" opacity="0.6"/>` : ''}
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
        const active = this.cameras.filter(c => c.status === 'ACTIVE').length;
        const degraded = this.cameras.filter(c => c.status === 'DEGRADED').length;
        return {
            total: this.cameras.length,
            active,
            degraded,
            offline: this.cameras.length - active - degraded,
            visible: this.visible
        };
    }
}

window.TrafficCams = new TrafficCameraSystem();
export default window.TrafficCams;
