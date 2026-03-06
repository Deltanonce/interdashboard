/**
 * @file ais-handler.js
 * @description Handles AIS maritime vessel tracking (WebSocket + HTTP Fallback).
 */

import { updateTrail, updateHistory } from './trail-manager.js';
import { computeConfidence } from './confidence-engine.js';
import { assessThreatLevel } from './ais-classifier.js';

export class AisHandler {
    constructor(config, state, callbacks) {
        this.config = config;
        this.state = state;
        this.callbacks = callbacks;
        this.socket = null;
        this.pollTimer = null;
        this.reconnectTimer = null;
        this.reconnectDelay = 2000;
        this.wsFailCount = 0;
        this.mode = 'ws'; // 'ws' or 'http'
        this.messageCount = 0;
        this.pollCount = 0;
        this.aisCountCache = 0;
    }

    start() {
        this.mode = 'ws';
        this.wsFailCount = 0;
        this.connect();
    }

    stop() {
        this.disconnect();
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    connect() {
        const apiKey = (typeof window !== 'undefined' && window.AISSTREAM_API_KEY) ? window.AISSTREAM_API_KEY : null;
        const PLACEHOLDER_KEY = 'GANTI_DENGAN_API_KEY_ANDA';

        if (!apiKey || apiKey.length < 10 || apiKey === PLACEHOLDER_KEY) {
            this.callbacks.updateKeyStatus('missing');
            console.warn('[AIS] API key not configured. Falling back to HTTP relay server...');
            this.mode = 'http';
            this.startPolling();
            return;
        }

        this.callbacks.updateKeyStatus('valid');

        if (this.mode === 'http' || this.wsFailCount >= this.config.WS_MAX_FAILURES) {
            this.mode = 'http';
            console.log('[AIS] 🚢 Using HTTP polling mode...');
            this.startPolling();
            return;
        }

        console.log(`[AIS] 🚢 Attempting WebSocket connection... (attempt ${this.wsFailCount + 1}/${this.config.WS_MAX_FAILURES})`);

        try {
            this.socket = new WebSocket(this.config.WS_URL);

            this.socket.onopen = () => {
                this.callbacks.updateKeyStatus('valid');
                console.log('[AIS] ✅ WebSocket CONNECTED!');
                this.state.stats.aisConnected = true;
                if (window.PerfMonitor) window.PerfMonitor.setAisState(true);
                this.reconnectDelay = 2000;
                this.wsFailCount = 0;
                this.messageCount = 0;

                const subscribeMsg = {
                    Apikey: apiKey,
                    BoundingBoxes: this.config.BOUNDING_BOXES,
                    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
                };
                this.socket.send(JSON.stringify(subscribeMsg));
                this.callbacks.updateStatusDot(true);
            };

            this.socket.onmessage = (event) => {
                this.messageCount++;
                if (window.PerfMonitor) window.PerfMonitor.recordAisMessage();
                try {
                    const msg = JSON.parse(event.data);
                    this.processMessage(msg);
                } catch (e) {
                    if (this.messageCount <= 3) {
                        console.warn('[AIS] ⚠️ Failed to parse message:', e.message);
                    }
                }
            };

            this.socket.onclose = (event) => {
                this.state.stats.aisConnected = false;
                if (window.PerfMonitor) window.PerfMonitor.setAisState(false);
                this.callbacks.updateStatusDot(false);
                
                if (this.mode === 'http') return;

                this.wsFailCount++;
                this.callbacks.updateKeyStatus('error', 'WS');
                console.warn(`[AIS] ❌ WebSocket CLOSED — code: ${event.code}`);

                if (this.wsFailCount >= this.config.WS_MAX_FAILURES) {
                    console.warn(`[AIS] WS failed ${this.wsFailCount} times. Switching to HTTP polling.`);
                    this.mode = 'http';
                    this.startPolling();
                } else {
                    this.scheduleReconnect();
                }
            };

            this.socket.onerror = (err) => {
                this.state.stats.aisConnected = false;
                this.callbacks.updateKeyStatus('error', 'WS');
                console.error('[AIS] ❌ WebSocket ERROR');
            };

        } catch (err) {
            console.error('[AIS] WebSocket creation failed:', err.message);
            this.wsFailCount++;
            this.scheduleReconnect();
        }
    }

    disconnect() {
        if (this.socket) {
            try {
                this.socket.onopen = null;
                this.socket.onmessage = null;
                this.socket.onclose = null;
                this.socket.onerror = null;
                this.socket.close();
            } catch (e) {}
            this.socket = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.state.stats.aisConnected = false;
        this.callbacks.updateStatusDot(false);
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        }, this.reconnectDelay);
    }

    startPolling() {
        if (this.pollTimer) return;
        this.pollHttp();
        this.pollTimer = setInterval(() => this.pollHttp(), this.config.POLL_INTERVAL);
        console.log('[AIS] HTTP polling started');
    }

    async pollHttp() {
        this.pollCount++;
        try {
            const res = await fetch(this.config.POLL_ENDPOINT);
            if (!res.ok) throw new Error(`AIS HTTP ${res.status}`);
            const data = await res.json();

            this.state.stats.aisConnected = !!data.connected;
            this.callbacks.updateStatusDot(this.state.stats.aisConnected);

            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msgStr => {
                    try {
                        const msg = JSON.parse(msgStr);
                        this.processMessage(msg);
                    } catch (e) {}
                });
            }
        } catch (err) {
            this.callbacks.updateKeyStatus('error', 'HTTP');
            if (this.pollCount <= 5) {
                console.warn(`[AIS-HTTP] Poll error: ${err.message}`);
            }
        }
    }

    processMessage(msg) {
        if (!msg || !msg.MetaData) return;

        const meta = msg.MetaData;
        const mmsi = meta.MMSI ? String(meta.MMSI) : null;
        if (!mmsi) return;

        const id = `ais-${mmsi}`;
        const now = Date.now();
        const prevAsset = this.state.liveAssets[id] || null;
        const msgType = msg.MessageType || '';

        if (msgType === 'PositionReport' && msg.Message && msg.Message.PositionReport) {
            const pos = msg.Message.PositionReport;
            const lat = meta.latitude || pos.Latitude;
            const lon = meta.longitude || pos.Longitude;

            if (lat == null || lon == null || (lat === 0 && lon === 0)) return;

            const normalized = {
                id, type: 'vessel',
                callsign: (meta.ShipName || `MMSI-${mmsi}`).trim().toUpperCase(),
                lat, lon, altitude: 0,
                speed: Math.round((pos.Sog || 0) * 10) / 10,
                heading: Math.round(pos.TrueHeading || pos.Cog || 0),
                source: 'ais',
                _seenSec: meta.time_utc ? (now - new Date(meta.time_utc).getTime()) / 1000 : 5,
                _timestamp: now,
                mmsi, moving: (pos.Sog || 0) > 0.5, cat: 'naval',
                color: '#2ed573',
                trail: prevAsset ? [...(prevAsset.trail || [])] : [],
                trailAlt: prevAsset ? [...(prevAsset.trailAlt || [])] : [],
                history: prevAsset ? [...(prevAsset.history || [])] : [],
                confidence: 50, spoofing: false, _live: true, _source: 'ais',
                vesselType: prevAsset ? prevAsset.vesselType : 0,
                vesselTypeName: prevAsset ? prevAsset.vesselTypeName : 'Vessel'
            };

            updateTrail(normalized, lat, lon, 0, this.config.MAX_TRAIL_POINTS);
            updateHistory(normalized, lat, lon, this.config.MAX_HISTORY_POINTS);

            const { confidence, spoofing } = computeConfidence(normalized, prevAsset);
            normalized.confidence = confidence;
            normalized.spoofing = spoofing;
            
            // Perform classification and threat assessment
            const assessment = assessThreatLevel(normalized);
            normalized.classification = assessment;
            normalized.color = assessment.color;
            normalized.vesselTypeName = assessment.category === 'TANKER' && assessment.subtype 
                ? assessment.subtype 
                : assessment.description;

            if (assessment.finalThreatLevel === 'high' || assessment.finalThreatLevel === 'critical') {
                normalized.priority = true;
                normalized.reason = assessment.threatReasons.length > 0 
                    ? assessment.threatReasons[0] 
                    : 'Tactical Interest Classified';
            }

            if (spoofing) {
                normalized.color = '#ff4757';
                this.state.stats.spoofAlerts++;
                console.warn(`[SPOOF ALERT] Vessel ${normalized.callsign} — impossible jump!`);
            }

            if (!prevAsset || prevAsset._source !== 'ais') this.aisCountCache++;
            this.state.liveAssets[id] = normalized;
            this.state.assetTimestampIndex.delete(id);
            this.state.assetTimestampIndex.set(id, now);
            this.state.stats.aisCount = this.aisCountCache;
            this.state.dirtyAssets.add(id);
            
            this.callbacks.onUpdateDebounced();
        }

        // Ship Static Data (type 5) — Enrich existing entry
        if (msgType === 'ShipStaticData' && msg.Message && msg.Message.ShipStaticData) {
            const sd = msg.Message.ShipStaticData;
            if (this.state.liveAssets[id]) {
                const asset = this.state.liveAssets[id];
                asset.callsign = (sd.Name || asset.callsign).trim().toUpperCase();
                asset.vesselType = sd.Type || asset.vesselType || 0;
                
                // Re-assess with updated type
                const assessment = assessThreatLevel(asset);
                asset.classification = assessment;
                asset.color = assessment.color;
                asset.vesselTypeName = assessment.category === 'TANKER' && assessment.subtype 
                    ? assessment.subtype 
                    : assessment.description;

                this.state.dirtyAssets.add(id);
                this.callbacks.onUpdateDebounced();
            }
        }
    }

    decrementAisCount() {
        this.aisCountCache = Math.max(0, this.aisCountCache - 1);
        this.state.stats.aisCount = this.aisCountCache;
    }
}
