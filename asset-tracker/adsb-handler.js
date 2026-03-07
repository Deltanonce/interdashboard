/**
 * @file adsb-handler.js
 * @description Handles ADS-B military aircraft tracking.
 */

import { updateTrail, updateHistory } from './trail-manager.js';
import { computeConfidence } from './confidence-engine.js';
import { validateFlightData } from './adsb-validator.js';

export class AdsbHandler {
    constructor(config, state, callbacks) {
        this.config = config;
        this.state = state;
        this.callbacks = callbacks;
        this.pollTimer = null;
    }

    /**
     * Starts ADS-B polling.
     */
    start() {
        if (this.pollTimer) return;
        console.log('[ADS-B] Starting military aircraft polling...');
        this.poll(); // Immediate first poll
        this.pollTimer = setInterval(() => this.poll(), this.config.POLL_INTERVAL);
    }

    /**
     * Stops ADS-B polling.
     */
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /**
     * Polls ADS-B data from proxy or direct endpoint.
     */
    async poll() {
        const startTime = performance.now();
        let success = false;
        try {
            let res;
            try {
                res = await fetch(this.config.PROXY_URL);
                if (!res.ok) throw new Error('proxy-fail');
            } catch (err) {
                console.warn('[ADS-B] Proxy failed, trying direct endpoint:', err.message);
                res = await fetch(this.config.DIRECT_URL);
                if (!res.ok) throw new Error(`ADS-B HTTP ${res.status}`);
            }

            const data = await res.json();
            success = true;
            const aircraft = data.ac || [];
            this.state.stats.lastAdsbPoll = new Date();
            
            const now = Date.now();
            let count = 0;

            aircraft.forEach(ac => {
                if (ac.lat == null || ac.lon == null) return;

                const id = `adsb-${ac.hex}`;
                const prevAsset = this.state.liveAssets[id] || null;
                const inBounds = this.callbacks.isInsideMiddleEast(ac.lat, ac.lon);

                if (!inBounds) {
                    if (prevAsset) {
                        this.callbacks.removeAsset(id);
                    }
                    return;
                }

                if (prevAsset) {
                    this.updateExistingAsset(prevAsset, ac, id, now);
                } else {
                    this.createNewAsset(ac, id, now);
                }
                count++;
            });

            this.state.stats.adsbCount = count;
            console.log(`[ADS-B] ✈ ${count} military aircraft | ${this.state.dirtyAssets.size} updated (${new Date().toLocaleTimeString()})`);

            this.callbacks.onUpdate();

        } catch (err) {
            console.error('[ADS-B] Polling error:', err.message);
        } finally {
            if (window.PerfMonitor) {
                window.PerfMonitor.recordAdsbPoll(performance.now() - startTime, success);
            }
        }
    }

    updateExistingAsset(prevAsset, ac, id, now) {
        const oldLat = prevAsset.lat, oldLon = prevAsset.lon, oldHdg = prevAsset.heading;
        
        prevAsset.lat = ac.lat;
        prevAsset.lon = ac.lon;
        prevAsset.altitude = ac.alt_baro || ac.alt_geom || 0;
        prevAsset.speed = Math.round(ac.gs || 0);
        prevAsset.heading = Math.round(ac.track || ac.nav_heading || 0);
        prevAsset.callsign = (ac.flight || ac.r || ac.hex || 'UNKN').trim().toUpperCase();
        prevAsset.hex = (ac.hex || prevAsset.hex || '').toUpperCase();
        prevAsset._seenSec = ac.seen || 0;
        prevAsset._timestamp = now;
        prevAsset.aircraftType = ac.t || prevAsset.aircraftType;

        this.state.assetTimestampIndex.delete(id);
        this.state.assetTimestampIndex.set(id, now);

        prevAsset.color = '#00d4ff';
        if ((ac.mlat && ac.mlat.length > 0) || ac.type === 'mlat') {
            prevAsset.color = '#ffa502';
            prevAsset.source = 'mlat';
        } else {
            prevAsset.source = ac.type || 'unknown';
        }
        if (ac.emergency && ac.emergency !== 'none') prevAsset.color = '#ff4757';

        updateTrail(prevAsset, ac.lat, ac.lon, prevAsset.altitude, this.config.MAX_TRAIL_POINTS);
        updateHistory(prevAsset, ac.lat, ac.lon, this.config.MAX_HISTORY_POINTS);
// ── VALIDATION LAYER ──
const validation = validateFlightData(prevAsset, { 
    lat: oldLat, lon: oldLon, _timestamp: prevAsset._timestamp - 15000 
});
prevAsset.validation = validation;
if (!validation.valid) {
    console.warn(`[ADS-B] Validation failure for ${prevAsset.callsign}:`, validation.issues);
    prevAsset.color = '#ffb000'; // Amber for anomaly
}

// Confidence
const cs = computeConfidence(prevAsset, { lat: oldLat, lon: oldLon, _timestamp: prevAsset._timestamp - 15000 });
        prevAsset.confidence = cs.confidence;
        prevAsset.spoofing = cs.spoofing;
        if (cs.spoofing) { 
            prevAsset.color = '#ff4757'; 
            this.state.stats.spoofAlerts++; 
        }

        if (Math.abs(ac.lat - oldLat) > 0.0001 || Math.abs(ac.lon - oldLon) > 0.0001 || oldHdg !== prevAsset.heading) {
            this.state.dirtyAssets.add(id);
        }
    }

    createNewAsset(ac, id, now) {
        const normalized = {
            id, type: 'aircraft',
            callsign: (ac.flight || ac.r || ac.hex || 'UNKN').trim().toUpperCase(),
            lat: ac.lat, lon: ac.lon,
            altitude: ac.alt_baro || ac.alt_geom || 0,
            speed: Math.round(ac.gs || ac.speed || 0),
            heading: Math.round(ac.track || ac.nav_heading || 0),
            hex: (ac.hex || '').toUpperCase(),            source: ac.type || 'unknown',
            _seenSec: ac.seen || 0, _timestamp: now,
            squawk: ac.squawk || '', aircraftType: ac.t || '', registration: ac.r || '',
            moving: true, cat: 'airbase',
            color: ((ac.mlat && ac.mlat.length > 0) || ac.type === 'mlat') ? '#ffa502' : '#00d4ff',
            trail: [], trailAlt: [], history: [], confidence: 50, spoofing: false,
            _live: true, _source: 'adsb'
        };
        if (ac.emergency && ac.emergency !== 'none') normalized.color = '#ff4757';
        
        updateTrail(normalized, ac.lat, ac.lon, normalized.altitude, this.config.MAX_TRAIL_POINTS);
        updateHistory(normalized, ac.lat, ac.lon, this.config.MAX_HISTORY_POINTS);
        
        // ── VALIDATION LAYER ──
        const validation = validateFlightData(normalized, null);
        normalized.validation = validation;
        if (!validation.valid || validation.severity === 'warning') {
            if (!validation.valid) normalized.color = '#ffb000';
            console.log(`[ADS-B] Initial validation for ${normalized.callsign}: ${validation.severity}`);
        }

        const cs = computeConfidence(normalized, null);
        normalized.confidence = cs.confidence;
        
        this.state.liveAssets[id] = normalized;
        this.state.assetTimestampIndex.delete(id);
        this.state.assetTimestampIndex.set(id, now);
        this.state.dirtyAssets.add(id);
    }
}
