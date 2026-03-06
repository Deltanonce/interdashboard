// ============================================================================
// asset-tracker.js — Real-Time Telemetry: ADS-B Mil + AIS Maritime
// Intel Dashboard V4.0 — Fase 3
// ============================================================================

const AssetTracker = (() => {
    'use strict';

    // ── CONFIGURATION ──────────────────────────────────────────────────
    // Endpoint strategy: only read from window.CONFIG.API_BASE_URL, otherwise use same-origin /api fallback.
    const API_BASE_URL = (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.API_BASE_URL)
        ? window.CONFIG.API_BASE_URL
        : '/api';
    const ADSB_PROXY = API_BASE_URL.replace(/\/api$/, '') + '/api/adsb-mil'; // Proxied via server.js
    const ADSB_DIRECT = 'https://api.adsb.lol/v2/mil'; // Fallback direct
    const ADSB_POLL_INTERVAL = 15000; // 15 sec
    const AIS_WS_URL = 'wss://stream.aisstream.io/v0/stream';
    const MAX_TRAIL_POINTS = 50;
    const MAX_LIVE_ASSETS = 200;
    const STALE_THRESHOLD = 300; // 5 min: remove asset if unseen for this long
    const SPOOFING_DISTANCE_KM = 100;
    const SPOOFING_TIME_SEC = 60;

    // Bounding boxes for AIS: [[latMin, lonMin], [latMax, lonMax]]
    // Expanded to cover busiest maritime chokepoints
    const AIS_BOUNDING_BOXES = [
        [[12, 41], [30, 44]],    // Red Sea (Bab el-Mandeb → Suez Canal)
        [[23, 48], [30, 57]],    // Persian Gulf / Strait of Hormuz
        [[11, 43], [16, 51]],    // Gulf of Aden / Bab el-Mandeb south
        [[30, 31], [32, 35]],    // Suez Canal + Eastern Mediterranean
        [[-2, 100], [8, 110]],   // Strait of Malacca (very busy)
        [[-5, 105], [10, 120]],  // Natuna / South China Sea
        [[20, 115], [28, 125]]   // Taiwan Strait
    ];

    // ── STATE ──────────────────────────────────────────────────────────
    const liveAssets = {};      // id → normalized asset object
    const dirtyAssets = new Set(); // IDs that changed since last render
    const assetTimestampIndex = new Map(); // id → last-seen timestamp
    let adsbPollTimer = null;
    let aisSocket = null;
    let aisReconnectDelay = 2000;
    let aisReconnectTimer = null;
    let aisRenderTimer = null;  // Debounce timer for AIS batch render
    let isRunning = false;
    let aisCountCache = 0;      // Incremental counter instead of O(n) filter
    let staleCleanupTimer = null;
    let stats = { adsbCount: 0, aisCount: 0, lastAdsbPoll: null, aisConnected: false, spoofAlerts: 0 };

    // ── UTILITY: Haversine Distance (km) ───────────────────────────────
    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ══════════════════════════════════════════════════════════════════
    //  CONFIDENCE SCORING ENGINE
    // ══════════════════════════════════════════════════════════════════

    function computeConfidence(asset, prevAsset) {
        let score = 0;
        let spoofing = false;

        // ── Factor 1: Data Age (0-40 pts) ──
        const ageSec = asset._seenSec || 999;
        if (ageSec < 5) score += 40;
        else if (ageSec < 30) score += 30;
        else if (ageSec < 120) score += 15;
        else score += 5;

        // ── Factor 2: Source Quality (0-30 pts) ──
        const src = (asset.source || '').toLowerCase();
        if (src === 'adsb_icao') score += 30;
        else if (src === 'ais') score += 25;
        else if (src === 'adsb_icao_nt' || src === 'adsr_icao') score += 25;
        else if (src === 'mlat') score += 15;
        else if (src === 'tisb' || src === 'tisb_icao') score += 10;
        else score += 10; // unknown source

        // ── Factor 3: Speed Consistency / Spoofing Detection (0-30 pts) ──
        if (prevAsset && prevAsset.lat && prevAsset.lon && prevAsset._timestamp) {
            const distKm = haversineKm(prevAsset.lat, prevAsset.lon, asset.lat, asset.lon);
            const dtSec = (asset._timestamp - prevAsset._timestamp) / 1000;

            if (dtSec > 0 && dtSec < SPOOFING_TIME_SEC && distKm > SPOOFING_DISTANCE_KM) {
                // SPOOFING ALERT: impossible jump
                spoofing = true;
                score += 0;
            } else if (distKm < 0.01 && asset.speed > 50) {
                // Stationary but claims high speed — suspicious
                score += 10;
            } else {
                score += 30;
            }
        } else {
            score += 20; // No previous data to compare — neutral
        }

        return { confidence: Math.min(100, Math.max(0, score)), spoofing };
    }

    // ══════════════════════════════════════════════════════════════════
    //  TRAIL MANAGER
    // ══════════════════════════════════════════════════════════════════

    function updateTrail(asset, newLat, newLon, newAlt) {
        if (!asset.trail) asset.trail = [];
        if (!asset.trailAlt) asset.trailAlt = [];

        // Only add if moved meaningfully (> ~100m)
        if (asset.trail.length > 0) {
            const last = asset.trail[asset.trail.length - 1];
            const dist = haversineKm(last[0], last[1], newLat, newLon);
            if (dist < 0.01) return; // Skip if barely moved (~10m)
        }

        asset.trail.push([newLat, newLon]);
        asset.trailAlt.push(newAlt || 0);

        // Prune to max
        while (asset.trail.length > MAX_TRAIL_POINTS) {
            asset.trail.shift();
            asset.trailAlt.shift();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  ADS-B TRACKER (HTTP Polling — ADSB.lol Military)
    // ══════════════════════════════════════════════════════════════════

    async function pollAdsb() {
        try {
            // Try proxy first, then direct
            let res;
            try {
                res = await fetch(ADSB_PROXY);
                if (!res.ok) throw new Error('proxy-fail');
            } catch {
                res = await fetch(ADSB_DIRECT);
                if (!res.ok) throw new Error(`ADS-B HTTP ${res.status}`);
            }
            const data = await res.json();
            const aircraft = data.ac || [];

            stats.lastAdsbPoll = new Date();
            let count = 0;

            const now = Date.now();

            aircraft.forEach(ac => {
                // Skip entries without position
                if (ac.lat == null || ac.lon == null) return;

                const id = `adsb-${ac.hex}`;
                const prevAsset = liveAssets[id] || null;

                // OPTIMIZATION: Reuse existing object, only update changed fields
                if (prevAsset) {
                    const oldLat = prevAsset.lat, oldLon = prevAsset.lon, oldHdg = prevAsset.heading;
                    prevAsset.lat = ac.lat;
                    prevAsset.lon = ac.lon;
                    prevAsset.altitude = ac.alt_baro || ac.alt_geom || 0;
                    prevAsset.speed = Math.round(ac.gs || 0);
                    prevAsset.heading = Math.round(ac.track || ac.nav_heading || 0);
                    prevAsset.callsign = (ac.flight || ac.r || ac.hex || 'UNKN').trim().toUpperCase();
                    prevAsset._seenSec = ac.seen || 0;
                    prevAsset._timestamp = now;
                    assetTimestampIndex.delete(id);
                    assetTimestampIndex.set(id, now);
                    prevAsset.aircraftType = ac.t || prevAsset.aircraftType;

                    // Recompute color
                    prevAsset.color = '#00d4ff';
                    if ((ac.mlat && ac.mlat.length > 0) || ac.type === 'mlat') {
                        prevAsset.color = '#ffa502';
                        prevAsset.source = 'mlat';
                    } else {
                        prevAsset.source = ac.type || 'unknown';
                    }
                    if (ac.emergency && ac.emergency !== 'none') prevAsset.color = '#ff4757';

                    // Trail: only add if actually moved
                    updateTrail(prevAsset, ac.lat, ac.lon, prevAsset.altitude);

                    // Confidence
                    const cs = computeConfidence(prevAsset, { lat: oldLat, lon: oldLon, _timestamp: prevAsset._timestamp - 15000 });
                    prevAsset.confidence = cs.confidence;
                    prevAsset.spoofing = cs.spoofing;
                    if (cs.spoofing) { prevAsset.color = '#ff4757'; stats.spoofAlerts++; }

                    // Mark dirty only if position or heading actually changed
                    if (Math.abs(ac.lat - oldLat) > 0.0001 || Math.abs(ac.lon - oldLon) > 0.0001 || oldHdg !== prevAsset.heading) {
                        dirtyAssets.add(id);
                    }
                } else {
                    // New aircraft — create full object
                    const normalized = {
                        id, type: 'aircraft',
                        callsign: (ac.flight || ac.r || ac.hex || 'UNKN').trim().toUpperCase(),
                        lat: ac.lat, lon: ac.lon,
                        altitude: ac.alt_baro || ac.alt_geom || 0,
                        speed: Math.round(ac.gs || 0),
                        heading: Math.round(ac.track || ac.nav_heading || 0),
                        source: ac.type || 'unknown',
                        _seenSec: ac.seen || 0, _timestamp: now,
                        squawk: ac.squawk || '', aircraftType: ac.t || '', registration: ac.r || '',
                        moving: true, cat: 'airbase',
                        color: ((ac.mlat && ac.mlat.length > 0) || ac.type === 'mlat') ? '#ffa502' : '#00d4ff',
                        trail: [], trailAlt: [], confidence: 50, spoofing: false,
                        _live: true, _source: 'adsb'
                    };
                    if (ac.emergency && ac.emergency !== 'none') normalized.color = '#ff4757';
                    updateTrail(normalized, ac.lat, ac.lon, normalized.altitude);
                    const cs = computeConfidence(normalized, null);
                    normalized.confidence = cs.confidence;
                    liveAssets[id] = normalized;
                    assetTimestampIndex.delete(id);
                    assetTimestampIndex.set(id, now);
                    dirtyAssets.add(id);
                }
                count++;
            });

            stats.adsbCount = count;
            console.log(`[ADS-B] ✈ ${count} pesawat militer | ${dirtyAssets.size} updated (${new Date().toLocaleTimeString()})`);

            // OPTIMIZATION: Only render dirty assets, not all
            flushDirtyToMap();
            cleanStaleAssets();
            enforceAssetLimit();
            updateLiveCountBadge();

        } catch (err) {
            console.error('[ADS-B] Error polling:', err.message);
        }
    }

    function startAdsbPolling() {
        if (adsbPollTimer) return;
        console.log('[ADS-B] Starting military aircraft polling...');
        pollAdsb(); // Immediate first poll
        adsbPollTimer = setInterval(pollAdsb, ADSB_POLL_INTERVAL);
    }

    function stopAdsbPolling() {
        if (adsbPollTimer) {
            clearInterval(adsbPollTimer);
            adsbPollTimer = null;
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  AIS TRACKER (Dual-mode: WebSocket → HTTP Polling fallback)
    // ══════════════════════════════════════════════════════════════════

    let aisWsFailCount = 0;
    const AIS_WS_MAX_FAILURES = 4;
    const AIS_POLL_ENDPOINT = API_BASE_URL.replace(/\/api$/, '') + '/api/ais-poll';
    const AIS_POLL_INTERVAL = 5000; // 5 seconds for faster updates
    let aisPollTimer = null;
    let aisMode = 'ws'; // Try direct WebSocket first, then fallback to HTTP relay
    let aisMessageCount = 0;

    function connectAis() {
        const apiKey = (typeof window !== 'undefined' && window.AISSTREAM_API_KEY) ? window.AISSTREAM_API_KEY : null;
        const PLACEHOLDER_KEY = 'GANTI_DENGAN_API_KEY_ANDA';
        if (!apiKey || apiKey.length < 10 || apiKey === PLACEHOLDER_KEY) {
            console.warn('[AIS] API key browser belum dikonfigurasi. Mencoba mode HTTP relay server (/api/ais-poll)...');
            aisMode = 'http';
            startAisPolling();
            return;
        }

        if (aisMode === 'http' || aisWsFailCount >= AIS_WS_MAX_FAILURES) {
            // Switch to HTTP polling mode
            aisMode = 'http';
            console.log('[AIS] 🚢 Using HTTP polling mode (server-side relay)...');
            startAisPolling();
            return;
        }

        console.log(`[AIS] 🚢 Attempting WebSocket connection to aisstream.io... (attempt ${aisWsFailCount + 1}/${AIS_WS_MAX_FAILURES})`);
        console.log(`[AIS] API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
        console.log(`[AIS] Bounding boxes: ${JSON.stringify(AIS_BOUNDING_BOXES)}`);

        try {
            aisSocket = new WebSocket(AIS_WS_URL);

            aisSocket.onopen = () => {
                console.log('[AIS] ✅ WebSocket CONNECTED to aisstream.io!');
                stats.aisConnected = true;
                aisReconnectDelay = 2000;
                aisWsFailCount = 0;
                aisMessageCount = 0;

                const subscribeMsg = {
                    Apikey: apiKey,
                    BoundingBoxes: AIS_BOUNDING_BOXES,
                    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
                };
                console.log('[AIS] Sending subscription:', JSON.stringify(subscribeMsg).substring(0, 200) + '...');
                aisSocket.send(JSON.stringify(subscribeMsg));
                updateAisStatusDot(true);
            };

            aisSocket.onmessage = (event) => {
                aisMessageCount++;
                try {
                    const msg = JSON.parse(event.data);

                    // Log first 5 messages for debugging, then every 50th
                    if (aisMessageCount <= 5 || aisMessageCount % 50 === 0) {
                        const msgType = msg.MessageType || 'unknown';
                        const shipName = msg.MetaData?.ShipName || 'N/A';
                        const mmsi = msg.MetaData?.MMSI || 'N/A';
                        console.log(`[AIS] 📩 Message #${aisMessageCount}: type=${msgType}, ship=${shipName}, mmsi=${mmsi}`);
                    }

                    processAisMessage(msg);
                } catch (e) {
                    if (aisMessageCount <= 3) {
                        console.warn('[AIS] ⚠️ Failed to parse message:', event.data.substring(0, 200));
                    }
                }
            };

            aisSocket.onclose = (event) => {
                stats.aisConnected = false;
                aisWsFailCount++;
                updateAisStatusDot(false);
                console.warn(`[AIS] ❌ WebSocket CLOSED — code: ${event.code}, reason: "${event.reason || 'none'}", clean: ${event.wasClean}, messages received: ${aisMessageCount}`);

                if (aisWsFailCount >= AIS_WS_MAX_FAILURES) {
                    console.warn(`[AIS] WebSocket failed ${aisWsFailCount} times. Switching to HTTP polling mode.`);
                    aisMode = 'http';
                    startAisPolling();
                } else {
                    console.warn(`[AIS] Attempt ${aisWsFailCount}/${AIS_WS_MAX_FAILURES}. Retrying in ${aisReconnectDelay / 1000}s...`);
                    scheduleAisReconnect();
                }
            };

            aisSocket.onerror = (err) => {
                stats.aisConnected = false;
                console.error('[AIS] ❌ WebSocket ERROR:', err);
            };

        } catch (err) {
            console.error('[AIS] WebSocket creation failed:', err);
            aisWsFailCount++;
            scheduleAisReconnect();
        }
    }

    // ── AIS HTTP Polling (uses server-side relay) ──
    let aisPollCount = 0;
    async function pollAisHttp() {
        aisPollCount++;
        try {
            const res = await fetch(AIS_POLL_ENDPOINT);
            if (!res.ok) throw new Error(`AIS HTTP ${res.status}`);
            const data = await res.json();

            // Debug: log first 10 polls, then every 20th
            if (aisPollCount <= 10 || aisPollCount % 20 === 0) {
                console.log(`[AIS-HTTP] Poll #${aisPollCount}: connected=${data.connected}, messages=${data.messages?.length || 0}, count=${data.count || 0}`);
            }

            if (data.connected) {
                stats.aisConnected = true;
                updateAisStatusDot(true);
            }

            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msgStr => {
                    try {
                        const msg = JSON.parse(msgStr);
                        processAisMessage(msg);
                    } catch (e) { /* skip */ }
                });
                console.log(`[AIS] 🚢 ${data.messages.length} vessel messages received via HTTP relay (poll #${aisPollCount})`);
            }
        } catch (err) {
            if (aisPollCount <= 5) {
                console.warn(`[AIS-HTTP] Poll #${aisPollCount} error: ${err.message}`);
            }
        }
    }

    function startAisPolling() {
        if (aisPollTimer) return;
        pollAisHttp(); // Immediate first poll
        aisPollTimer = setInterval(() => {
            if (isRunning) pollAisHttp();
        }, AIS_POLL_INTERVAL);
        console.log('[AIS] HTTP polling started (every 5s via /api/ais-poll)');
    }

    function updateAisStatusDot(connected) {
        const dot = document.getElementById('ais-status-dot');
        if (dot) {
            dot.classList.toggle('connected', connected);
        }
    }

    function scheduleAisReconnect() {
        if (aisReconnectTimer) clearTimeout(aisReconnectTimer);
        aisReconnectTimer = setTimeout(() => {
            if (isRunning) {
                connectAis();
                aisReconnectDelay = Math.min(aisReconnectDelay * 2, 30000);
            }
        }, aisReconnectDelay);
    }


    function getVesselTypeName(code) {
        if (!code) return 'Vessel';
        if (code >= 20 && code <= 29) return 'WIG';
        if (code == 30) return 'Fishing';
        if (code >= 31 && code <= 32) return 'Towing';
        if (code == 33) return 'Dredging';
        if (code == 34) return 'Diving';
        if (code == 35) return 'Military';
        if (code == 36) return 'Sailing';
        if (code == 37) return 'Pleasure';
        if (code >= 40 && code <= 49) return 'High Speed';
        if (code == 50) return 'Pilot';
        if (code >= 51 && code <= 59) return 'Search/Rescue';
        if (code >= 60 && code <= 69) return 'Passenger';
        if (code >= 70 && code <= 79) return 'Cargo';
        if (code >= 80 && code <= 89) return 'Tanker';
        if (code >= 90 && code <= 99) return 'Other';
        return 'Vessel';
    }

    function processAisMessage(msg) {
        if (!msg || !msg.MetaData) return;

        const meta = msg.MetaData;
        const mmsi = meta.MMSI ? String(meta.MMSI) : null;
        if (!mmsi) return;

        const id = `ais-${mmsi}`;
        const now = Date.now();
        const prevAsset = liveAssets[id] || null;
        const msgType = msg.MessageType || '';

        // Position Report (types 1, 2, 3)
        if (msgType === 'PositionReport' && msg.Message && msg.Message.PositionReport) {
            const pos = msg.Message.PositionReport;
            const lat = meta.latitude || pos.Latitude;
            const lon = meta.longitude || pos.Longitude;

            if (lat == null || lon == null || (lat === 0 && lon === 0)) return;

            const normalized = {
                id,
                type: 'vessel',
                callsign: (meta.ShipName || `MMSI-${mmsi}`).trim().toUpperCase(),
                lat,
                lon,
                altitude: 0,
                speed: Math.round((pos.Sog || 0) * 10) / 10, // Speed over ground in kts
                heading: Math.round(pos.TrueHeading || pos.Cog || 0),
                source: 'ais',
                _seenSec: meta.time_utc ? (now - new Date(meta.time_utc).getTime()) / 1000 : 5,
                _timestamp: now,
                mmsi,
                moving: (pos.Sog || 0) > 0.5,
                cat: 'naval',
                color: '#2ed573', // Green for vessels
                trail: prevAsset ? [...(prevAsset.trail || [])] : [],
                trailAlt: prevAsset ? [...(prevAsset.trailAlt || [])] : [],
                confidence: 50,
                spoofing: false,
                _live: true,
                _source: 'ais',
                vesselType: prevAsset ? prevAsset.vesselType : 0,
                vesselTypeName: prevAsset ? prevAsset.vesselTypeName : 'Vessel'
            };

            // Trail update
            updateTrail(normalized, lat, lon, 0);

            // Confidence
            const { confidence, spoofing } = computeConfidence(normalized, prevAsset);
            normalized.confidence = confidence;
            normalized.spoofing = spoofing;
            if (spoofing) {
                normalized.color = '#ff4757';
                stats.spoofAlerts++;
                console.warn(`[SPOOF ALERT] Vessel ${normalized.callsign} — impossible jump!`);
            }

            // OPTIMIZATION: Incremental count — avoid O(n) filter
            if (!prevAsset || prevAsset._source !== 'ais') aisCountCache++;
            liveAssets[id] = normalized;
            assetTimestampIndex.delete(id);
            assetTimestampIndex.set(id, now);
            stats.aisCount = aisCountCache;
            dirtyAssets.add(id);
        }

        // Ship Static Data (type 5) — Enrich existing entry
        if (msgType === 'ShipStaticData' && msg.Message && msg.Message.ShipStaticData) {
            const sd = msg.Message.ShipStaticData;
            if (liveAssets[id]) {
                liveAssets[id].callsign = (sd.Name || liveAssets[id].callsign).trim().toUpperCase();
                liveAssets[id].vesselType = sd.Type || liveAssets[id].vesselType || 0;
                liveAssets[id].vesselTypeName = getVesselTypeName(liveAssets[id].vesselType);
                dirtyAssets.add(id);
            }
        }

        // OPTIMIZATION: Debounce AIS rendering — batch every 500ms
        if (!aisRenderTimer) {
            aisRenderTimer = setTimeout(() => {
                flushDirtyToMap();
                enforceAssetLimit();
                updateLiveCountBadge();
                aisRenderTimer = null;
            }, 500);
        }
    }

    function disconnectAis() {
        if (aisSocket) {
            aisSocket.close();
            aisSocket = null;
        }
        if (aisReconnectTimer) {
            clearTimeout(aisReconnectTimer);
            aisReconnectTimer = null;
        }
        stats.aisConnected = false;
    }

    // ══════════════════════════════════════════════════════════════════
    //  MAP INTEGRATION (Bridge to map.js)
    // ══════════════════════════════════════════════════════════════════

    // OPTIMIZATION: Only push dirty assets to map, not the entire set
    function flushDirtyToMap() {
        if (typeof window.addOrUpdateLiveAsset !== 'function' || dirtyAssets.size === 0) return;

        dirtyAssets.forEach(id => {
            const asset = liveAssets[id];
            if (asset) window.addOrUpdateLiveAsset(asset);
        });
        dirtyAssets.clear();
    }


    function enforceAssetLimit() {
        const overflow = assetTimestampIndex.size - MAX_LIVE_ASSETS;
        if (overflow <= 0) return;

        const evictIds = [];
        for (const [id] of assetTimestampIndex) {
            evictIds.push(id);
            if (evictIds.length >= overflow) break;
        }

        evictIds.forEach(id => {
            delete liveAssets[id];
            assetTimestampIndex.delete(id);
            dirtyAssets.delete(id);
            if (id.startsWith('ais-')) aisCountCache = Math.max(0, aisCountCache - 1);
            if (typeof window.removeLiveAsset === 'function') window.removeLiveAsset(id);
        });

        if (evictIds.length > 0) {
            console.log(`[Tracker] Evicted ${evictIds.length} oldest assets (max ${MAX_LIVE_ASSETS})`);
        }
    }

    function cleanStaleAssets() {
        const cutoff = Date.now() - STALE_THRESHOLD * 1000;
        const staleIds = [];

        // O(stale) complexity:
        // JS Map preserves insertion order. By deleting and re-inserting on update,
        // the Map stays sorted by timestamp. We can break as soon as we hit a non-stale asset.
        for (const [id, ts] of assetTimestampIndex) {
            if (ts < cutoff) {
                staleIds.push(id);
            } else {
                break; // Everything after this is newer (not stale)
            }
        }

        if (staleIds.length === 0) return; // early exit — kasus paling umum

        staleIds.forEach(id => {
            delete liveAssets[id];
            assetTimestampIndex.delete(id);
            if (id.startsWith('ais-')) aisCountCache = Math.max(0, aisCountCache - 1);
            if (typeof window.removeLiveAsset === 'function') window.removeLiveAsset(id);
        });

        console.log(`[Tracker] Cleaned ${staleIds.length} stale assets`);
    }

    function updateLiveCountBadge() {
        // HUD (Left Panel)
        const adsbBadge = document.getElementById('live-adsb-count');
        const aisBadge = document.getElementById('live-ais-count');
        if (adsbBadge) adsbBadge.textContent = stats.adsbCount;
        if (aisBadge) aisBadge.textContent = stats.aisCount;

        // BOTTOM TOOLBAR
        const adsbToolbar = document.getElementById('toolbar-adsb-count');
        const aisToolbar = document.getElementById('toolbar-ais-count');
        if (adsbToolbar) adsbToolbar.textContent = stats.adsbCount;
        if (aisToolbar) aisToolbar.textContent = stats.aisCount;

        // AIS connection indicator (Update both)
        ['ais-status-dot', 'toolbar-ais-dot'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('connected', stats.aisConnected);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════════════════

    function start() {
        if (isRunning) return;
        isRunning = true;
        console.log('[AssetTracker] ████ INITIALIZING REAL-TIME TELEMETRY ████');
        startAdsbPolling();
        connectAis();

        // Periodic stale cleanup every 30s
        if (staleCleanupTimer) clearInterval(staleCleanupTimer);
        staleCleanupTimer = setInterval(cleanStaleAssets, 30000);
    }

    function stop() {
        isRunning = false;
        stopAdsbPolling();
        disconnectAis();
        if (staleCleanupTimer) {
            clearInterval(staleCleanupTimer);
            staleCleanupTimer = null;
        }
        console.log('[AssetTracker] Stopped all tracking.');
    }

    function getStats() {
        return { ...stats };
    }

    function getLiveAssets() {
        return { ...liveAssets };
    }

    // Expose
    return { start, stop, getStats, getLiveAssets };
})();

// Start is now explicitly called by app-logic.js AFTER initMap() completes.
// This prevents race conditions where the map isn't ready.
