/**
 * @file index.js
 * @description Main entry point for AssetTracker modular architecture.
 */

import { AdsbHandler } from './adsb-handler.js';
import { AisHandler } from './ais-handler.js';
import { calculateInterceptPath, calculateInterceptPoint } from './prediction-engine.js';

const AssetTracker = (() => {
    'use strict';

    // ── CONFIGURATION ──────────────────────────────────────────────────
    const API_BASE_URL = (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.API_BASE_URL)
        ? window.CONFIG.API_BASE_URL
        : '/api';

    const CONFIG = {
        ADSB: {
            PROXY_URL: API_BASE_URL.replace(/\/api$/, '') + '/api/adsb-mil',
            DIRECT_URL: 'https://api.adsb.lol/v2/mil',
            POLL_INTERVAL: 15000,
            MAX_TRAIL_POINTS: 50,
            MAX_HISTORY_POINTS: 2000
        },
        AIS: {
            WS_URL: 'wss://stream.aisstream.io/v0/stream',
            WS_MAX_FAILURES: 4,
            POLL_ENDPOINT: API_BASE_URL.replace(/\/api$/, '') + '/api/ais-poll',
            POLL_INTERVAL: 5000,
            MAX_TRAIL_POINTS: 50,
            MAX_HISTORY_POINTS: 2000,
            BOUNDING_BOXES: [
                [[12, 41], [30, 44]], [[23, 48], [30, 57]], [[11, 43], [16, 51]],
                [[30, 31], [32, 35]], [[-2, 100], [8, 110]], [[-5, 105], [10, 120]],
                [[20, 115], [28, 125]]
            ]
        },
        GENERAL: {
            MAX_LIVE_ASSETS: 200,
            STALE_THRESHOLD: 300, // 5 min
            MIDDLE_EAST_BOUNDS: { latMin: -11, latMax: 55, lonMin: 20, lonMax: 155 }
        }
    };

    // ── STATE ──────────────────────────────────────────────────────────
    const state = {
        liveAssets: {},
        dirtyAssets: new Set(),
        assetTimestampIndex: new Map(),
        stats: { adsbCount: 0, aisCount: 0, lastAdsbPoll: null, aisConnected: false, spoofAlerts: 0 }
    };

    let isRunning = false;
    let aisRenderTimer = null;
    let staleCleanupTimer = null;

    // ── HANDLERS ───────────────────────────────────────────────────────
    const adsbHandler = new AdsbHandler(CONFIG.ADSB, state, {
        isInsideMiddleEast,
        removeAsset,
        onUpdate: flushDirtyToMap
    });

    const aisHandler = new AisHandler(CONFIG.AIS, state, {
        updateStatusDot,
        updateKeyStatus,
        onUpdateDebounced: () => {
            if (!aisRenderTimer) {
                aisRenderTimer = setTimeout(() => {
                    flushDirtyToMap();
                    enforceAssetLimit();
                    updateLiveCountBadge();
                    aisRenderTimer = null;
                }, 500);
            }
        }
    });

    // ── UTILITIES ──────────────────────────────────────────────────────
    function getEl(id) {
        if (typeof window !== 'undefined' && window.DOMCache && typeof window.DOMCache.get === 'function') {
            return window.DOMCache.get(id);
        }
        return document.getElementById(id);
    }

    function isInsideMiddleEast(lat, lon) {
        const b = CONFIG.GENERAL.MIDDLE_EAST_BOUNDS;
        return lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
    }

    function removeAsset(id) {
        if (state.liveAssets[id]) {
            delete state.liveAssets[id];
            state.assetTimestampIndex.delete(id);
            state.dirtyAssets.delete(id);
            if (id.startsWith('ais-')) aisHandler.decrementAisCount();
            if (typeof window.removeLiveAsset === 'function') window.removeLiveAsset(id);
        }
    }

    function flushDirtyToMap() {
        if (typeof window.addOrUpdateLiveAsset !== 'function' || state.dirtyAssets.size === 0) return;
        if (window._mapIsZooming) return;

        state.dirtyAssets.forEach(id => {
            const asset = state.liveAssets[id];
            if (asset) window.addOrUpdateLiveAsset(asset);
        });
        state.dirtyAssets.clear();

        if (typeof window.syncLiveAssets === 'function') {
            window.syncLiveAssets(Object.keys(state.liveAssets));
        }
    }

    function enforceAssetLimit() {
        const overflow = state.assetTimestampIndex.size - CONFIG.GENERAL.MAX_LIVE_ASSETS;
        if (overflow <= 0) return;

        const evictIds = [];
        for (const [id] of state.assetTimestampIndex) {
            evictIds.push(id);
            if (evictIds.length >= overflow) break;
        }

        evictIds.forEach(id => removeAsset(id));
        if (evictIds.length > 0) {
            console.log(`[Tracker] Evicted ${evictIds.length} assets (max ${CONFIG.GENERAL.MAX_LIVE_ASSETS})`);
        }
    }

    function cleanStaleAssets() {
        const cutoff = Date.now() - CONFIG.GENERAL.STALE_THRESHOLD * 1000;
        const staleIds = [];

        for (const [id, ts] of state.assetTimestampIndex) {
            if (ts < cutoff) staleIds.push(id);
            else break;
        }

        staleIds.forEach(id => removeAsset(id));
        if (staleIds.length > 0) console.log(`[Tracker] Cleaned ${staleIds.length} stale assets`);
    }

    function purgeOutOfBoundsAircraft() {
        const idsToRemove = [];
        Object.keys(state.liveAssets).forEach(id => {
            const asset = state.liveAssets[id];
            if (!asset || asset._source !== 'adsb') return;
            if (asset.lat == null || asset.lon == null || !isInsideMiddleEast(asset.lat, asset.lon)) {
                idsToRemove.push(id);
            }
        });
        idsToRemove.forEach(id => removeAsset(id));
    }

    function updateLiveCountBadge() {
        const adsbB = getEl('live-adsb-count'), aisB = getEl('live-ais-count');
        if (adsbB) adsbB.textContent = state.stats.adsbCount;
        if (aisB) aisB.textContent = state.stats.aisCount;

        const adsbT = getEl('toolbar-adsb-count'), aisT = getEl('toolbar-ais-count');
        if (adsbT) adsbT.textContent = state.stats.adsbCount;
        if (aisT) aisT.textContent = state.stats.aisCount;

        updateStatusDot(state.stats.aisConnected);
    }

    function updateStatusDot(connected) {
        ['ais-status-dot', 'toolbar-ais-dot'].forEach(id => {
            const el = getEl(id);
            if (el) el.classList.toggle('connected', connected);
        });
    }

    function updateKeyStatus(status, detail) {
        const dot = getEl('ais-key-dot'), text = getEl('ais-key-text');
        if (dot) dot.classList.toggle('connected', status === 'valid');
        if (text) {
            if (status === 'valid') text.textContent = 'CONFIGURED';
            else if (status === 'missing') text.textContent = 'NOT SET';
            else if (status === 'error') text.textContent = detail ? `ERROR (${detail})` : 'ERROR';
            else text.textContent = 'UNKNOWN';
        }
    }

    // ── PUBLIC API ─────────────────────────────────────────────────────
    return {
        start: () => {
            if (isRunning) return;
            isRunning = true;
            console.log('[AssetTracker] ████ INITIALIZING MODULAR ARCHITECTURE ████');
            updateKeyStatus('unknown');
            adsbHandler.start();
            aisHandler.start();

            if (staleCleanupTimer) clearInterval(staleCleanupTimer);
            staleCleanupTimer = setInterval(() => {
                cleanStaleAssets();
                purgeOutOfBoundsAircraft();
                enforceAssetLimit();
                updateLiveCountBadge();
            }, 30000);
        },
        stop: () => {
            isRunning = false;
            adsbHandler.stop();
            aisHandler.stop();
            if (staleCleanupTimer) {
                clearInterval(staleCleanupTimer);
                staleCleanupTimer = null;
            }
            console.log('[AssetTracker] Stopped all tracking.');
        },
        getStats: () => ({ ...state.stats }),
        getLiveAssets: () => ({ ...state.liveAssets }),
        calculateInterceptPath,
        calculateInterceptPoint
    };
})();

// Initialize Global Settings
window.SHOW_PREDICTIONS = true;

// Backward compatibility
window.AssetTracker = AssetTracker;
export default AssetTracker;
