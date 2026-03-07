/**
 * @file perf-monitor.js
 * @description Lightweight performance monitoring system for real-time telemetry.
 */

class PerfMonitor {
    constructor() {
        this.metrics = {
            adsb: { calls: 0, totalTime: 0, errors: 0, lastPoll: null, lastDuration: 0 },
            ais: { messages: 0, startTime: null, uptime: 0, reconnects: 0, connected: false },
            render: { frames: 0, drops: 0, lastFrame: Date.now(), fps: 0 },
            memory: { heapUsed: 0, heapTotal: 0, limit: 0 },
            modules: { trafficCams: false, trafficFlow: false, panoptic: false, imageryMode: 'STANDARD' }
        };
        this.startTime = Date.now();
        this.frameCounter = 0;
        this.fpsUpdateInterval = 1000; // 1s
        this.lastFpsUpdate = Date.now();
    }

    /**
     * Records ADS-B polling performance.
     * @param {number} duration - Time in MS
     * @param {boolean} success - Whether poll succeeded
     */
    recordAdsbPoll(duration, success) {
        this.metrics.adsb.calls++;
        this.metrics.adsb.totalTime += duration;
        this.metrics.adsb.lastDuration = duration;
        if (!success) this.metrics.adsb.errors++;
        this.metrics.adsb.lastPoll = new Date().toISOString();
    }

    /**
     * Records an AIS message received.
     */
    recordAisMessage() {
        this.metrics.ais.messages++;
    }

    /**
     * Tracks AIS connection state and uptime.
     * @param {boolean} isConnected 
     */
    setAisState(isConnected) {
        if (isConnected && !this.metrics.ais.connected) {
            this.metrics.ais.startTime = Date.now();
        } else if (!isConnected && this.metrics.ais.connected) {
            this.metrics.ais.uptime += (Date.now() - this.metrics.ais.startTime);
            this.metrics.ais.startTime = null;
            this.metrics.ais.reconnects++;
        }
        this.metrics.ais.connected = isConnected;
    }

    /**
     * Records a render frame and estimates FPS.
     */
    recordFrame() {
        const now = Date.now();
        const delta = now - this.metrics.render.lastFrame;
        
        if (delta > 100) { // If frame took > 100ms, consider it a drop
            this.metrics.render.drops++;
        }

        this.frameCounter++;
        if (now - this.lastFpsUpdate > this.fpsUpdateInterval) {
            this.metrics.render.fps = Math.round((this.frameCounter * 1000) / (now - this.lastFpsUpdate));
            this.frameCounter = 0;
            this.lastFpsUpdate = now;
            this.updateMemory();
        }

        this.metrics.render.lastFrame = now;
    }

    /**
     * Updates memory usage from performance API.
     */
    updateMemory() {
        if (window.performance && window.performance.memory) {
            const mem = window.performance.memory;
            this.metrics.memory.heapUsed = Math.round(mem.usedJSHeapSize / (1024 * 1024));
            this.metrics.memory.heapTotal = Math.round(mem.totalJSHeapSize / (1024 * 1024));
            this.metrics.memory.limit = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
        }
    }

    /**
     * Returns a summary of performance metrics.
     */
    getStats() {
        // Snapshot module states from globals
        this.metrics.modules.trafficCams = !!(window.TrafficCams && window.TrafficCams.active);
        this.metrics.modules.trafficFlow = !!(window.TrafficFlow && window.TrafficFlow.active);
        this.metrics.modules.panoptic = !!(window.PanopticEngine && window.PanopticEngine.enabled);
        this.metrics.modules.imageryMode = (window.ImageryModes && window.ImageryModes.currentMode) || 'STANDARD';

        const adsb = this.metrics.adsb;
        const ais = this.metrics.ais;
        const currentAisUptime = ais.startTime ? (ais.uptime + (Date.now() - ais.startTime)) : ais.uptime;

        return {
            sessionUptime: Math.round((Date.now() - this.startTime) / 1000),
            adsb: {
                totalPolls: adsb.calls,
                avgResponseTimeMs: Math.round(adsb.totalTime / (adsb.calls || 1)),
                lastResponseTimeMs: adsb.lastDuration,
                errorRate: ((adsb.errors / (adsb.calls || 1)) * 100).toFixed(2) + '%',
                lastPoll: adsb.lastPoll
            },
            ais: {
                totalMessages: ais.messages,
                uptimeSec: Math.round(currentAisUptime / 1000),
                reconnectCount: ais.reconnects,
                status: ais.connected ? 'CONNECTED' : 'DISCONNECTED'
            },
            render: {
                fps: this.metrics.render.fps,
                frameDrops: this.metrics.render.drops
            },
            memory: {
                usedMb: this.metrics.memory.heapUsed,
                totalMb: this.metrics.memory.heapTotal,
                limitMb: this.metrics.memory.limit
            },
            modules: { ...this.metrics.modules }
        };
    }

    /**
     * Starts periodic logging to console.
     * @param {number} intervalMs 
     */
    startAutoLog(intervalMs = 30000) {
        setInterval(() => {
            const s = this.getStats();
            console.log(`%c[PERF-MONITOR] %cFPS: ${s.render.fps} | MEM: ${s.memory.usedMb}MB / ${s.memory.totalMb}MB | ADS-B Avg: ${s.adsb.avgResponseTimeMs}ms | AIS Msg: ${s.ais.totalMessages} | IMG: ${s.modules.imageryMode}`, 
                "color: #00ff41; font-weight: bold;", "color: #ffb000;");
            this._updateSystemPanel(s);
        }, intervalMs);

        // Also update the panel more frequently (every 3s) for real-time feel
        setInterval(() => this._updateSystemPanel(this.getStats()), 3000);
    }

    _updateSystemPanel(s) {
        const el = document.getElementById('system-monitor-stats');
        if (!el) return;
        el.innerHTML = `<span style="color:#00ff41">FPS</span> ${s.render.fps} <span style="color:#ffb000">DROP</span> ${s.render.frameDrops}<br>`
            + `<span style="color:#00ff41">MEM</span> ${s.memory.usedMb}/${s.memory.totalMb} MB<br>`
            + `<span style="color:#00ff41">ADSB</span> ${s.adsb.totalPolls} polls (${s.adsb.avgResponseTimeMs}ms avg)<br>`
            + `<span style="color:#00ff41">AIS</span> ${s.ais.status} | ${s.ais.totalMessages} msg<br>`
            + `<span style="color:#00ff41">IMG</span> ${s.modules.imageryMode} | <span style="color:#0ff">PAN</span> ${s.modules.panoptic ? 'ON' : 'OFF'}`;
    }
}

// Global Instance
window.PerfMonitor = new PerfMonitor();
window.PerfMonitor.startAutoLog();

export default window.PerfMonitor;
