// traffic-flow.js — Middle East Strategic Corridor Traffic Analysis
// Simulates traffic congestion on critical ME routes with heatmap overlays on Cesium

const TRAFFIC_COLORS = {
    free: '#00ff41',      // Green - Free flow
    moderate: '#ffe132',   // Yellow - Moderate
    heavy: '#ff9100',      // Orange - Heavy
    gridlock: '#ff2244',   // Red - Gridlock
    unknown: '#666666'     // Gray - No data
};

const CONGESTION_LEVELS = {
    FREE: { label: 'FREE FLOW', color: TRAFFIC_COLORS.free, min: 0, max: 25 },
    MODERATE: { label: 'MODERATE', color: TRAFFIC_COLORS.moderate, min: 25, max: 50 },
    HEAVY: { label: 'HEAVY', color: TRAFFIC_COLORS.heavy, min: 50, max: 75 },
    GRIDLOCK: { label: 'GRIDLOCK', color: TRAFFIC_COLORS.gridlock, min: 75, max: 100 }
};

// Middle East strategic corridors — multi-point polylines following actual road/route geometry.
// Each segment stores an array of [lon,lat] waypoints so polylines hug the road.
const AUSTIN_CORRIDORS = [
    // ── IRAQ: Baghdad – Fallujah – Ramadi (Highway 1 / Route IRISH) ──
    { id: 'IRQ_HWY1', name: 'Iraq Hwy 1: Baghdad–Ramadi', segments: [
        { path: [[44.3660,33.3120],[44.3200,33.3050],[44.2600,33.2900],[44.2000,33.2700],[44.1400,33.2500],[44.0800,33.2400]] },
        { path: [[44.0800,33.2400],[44.0200,33.2350],[43.9500,33.2300],[43.8800,33.2300],[43.8100,33.2350],[43.7800,33.2400]] },
        { path: [[43.7800,33.2400],[43.7200,33.2500],[43.6600,33.2700],[43.6000,33.3000],[43.5500,33.3400],[43.5100,33.3500]] }
    ]},
    // ── IRAQ: Baghdad – Basra (Highway 6) ──
    { id: 'IRQ_HWY6', name: 'Iraq Hwy 6: Baghdad–Basra', segments: [
        { path: [[44.3660,33.3120],[44.4200,33.2600],[44.4500,33.1800],[44.5000,33.0500],[44.5500,32.9000],[44.5700,32.7500]] },
        { path: [[44.5700,32.7500],[44.5600,32.5500],[44.5500,32.3500],[44.5300,32.1500],[44.5000,31.9500],[44.4800,31.7500]] },
        { path: [[44.4800,31.7500],[44.5200,31.5000],[44.6000,31.2500],[44.7500,31.0000],[44.9500,30.8000],[47.7800,30.5200]] }
    ]},
    // ── SYRIA: M5 Damascus – Homs – Hama – Aleppo ──
    { id: 'SYR_M5', name: 'Syria M5: Damascus–Aleppo', segments: [
        { path: [[36.2765,33.5138],[36.3200,33.6000],[36.3500,33.7200],[36.3600,33.8500],[36.3500,33.9800],[36.3200,34.1000]] },
        { path: [[36.3200,34.1000],[36.3000,34.2500],[36.2800,34.4000],[36.2700,34.5500],[36.3200,34.7200],[36.3500,34.8500]] },
        { path: [[36.3500,34.8500],[36.3800,35.0000],[36.4000,35.1500],[36.5200,35.3000],[36.7000,35.5000],[36.8500,35.8000]] },
        { path: [[36.8500,35.8000],[36.9500,35.9500],[37.0000,36.0500],[37.0500,36.1200],[37.1200,36.1800],[37.1620,36.1990]] }
    ]},
    // ── SAUDI: Route 40 Riyadh – Jeddah ──
    { id: 'KSA_R40', name: 'Saudi Route 40: Riyadh–Jeddah', segments: [
        { path: [[46.6753,24.7136],[46.3000,24.7000],[45.8000,24.6000],[45.3000,24.4500],[44.8000,24.2500],[44.4000,24.0500]] },
        { path: [[44.4000,24.0500],[44.0000,23.8500],[43.5000,23.6000],[43.0000,23.3500],[42.5000,23.1000],[42.0000,22.8000]] },
        { path: [[42.0000,22.8000],[41.6000,22.5000],[41.2000,22.2000],[40.8000,21.9000],[40.2000,21.7000],[39.1925,21.4858]] }
    ]},
    // ── UAE: E11 Sheikh Zayed Road Abu Dhabi – Dubai ──
    { id: 'UAE_E11', name: 'UAE E11: Abu Dhabi–Dubai', segments: [
        { path: [[54.3670,24.4539],[54.5000,24.4800],[54.7000,24.5200],[54.8500,24.5500],[55.0000,24.5800],[55.0640,25.0145]] },
        { path: [[55.0640,25.0145],[55.1200,25.0800],[55.1700,25.1200],[55.2000,25.1600],[55.2400,25.1900],[55.2708,25.2048]] }
    ]},
    // ── TURKEY: O-1 Istanbul Bosphorus Crossing ──
    { id: 'TUR_O1', name: 'Turkey O-1: Istanbul E-W', segments: [
        { path: [[28.8500,41.0100],[28.9000,41.0200],[28.9500,41.0300],[28.9744,41.0256],[29.0000,41.0350],[29.0343,41.0451]] },
        { path: [[29.0343,41.0451],[29.0700,41.0500],[29.1100,41.0450],[29.1500,41.0400],[29.2000,41.0350],[29.2500,41.0300]] }
    ]},
    // ── IRAN: Tehran – Isfahan (Route 65) ──
    { id: 'IRN_R65', name: 'Iran Route 65: Tehran–Isfahan', segments: [
        { path: [[51.3381,35.6997],[51.3000,35.5000],[51.2500,35.3000],[51.2000,35.1000],[51.1500,34.9000],[51.1000,34.7000]] },
        { path: [[51.1000,34.7000],[51.1500,34.4000],[51.2000,34.1000],[51.3000,33.8000],[51.4000,33.5000],[51.5000,33.2000]] },
        { path: [[51.5000,33.2000],[51.5500,33.0000],[51.6000,32.8500],[51.6680,32.6546]] }
    ]},
    // ── ISRAEL: Route 6 (Cross-Israel Highway) N-S ──
    { id: 'ISR_R6', name: 'Israel Route 6: N-S Corridor', segments: [
        { path: [[34.9500,32.5000],[34.9200,32.3500],[34.9000,32.2000],[34.8800,32.0500],[34.8500,31.9000],[34.8300,31.7500]] },
        { path: [[34.8300,31.7500],[34.8500,31.6000],[34.8700,31.4500],[34.8900,31.3000],[34.9000,31.1500]] }
    ]},
    // ── EGYPT: Suez Canal Road (Port Said – Suez) ──
    { id: 'EGY_SUEZ', name: 'Egypt: Suez Canal Road', segments: [
        { path: [[32.3019,31.2653],[32.3200,31.1500],[32.3400,31.0000],[32.3500,30.8500],[32.3600,30.7000],[32.3700,30.5500]] },
        { path: [[32.3700,30.5500],[32.4000,30.4000],[32.4300,30.2500],[32.5400,29.9800]] }
    ]},
    // ── JORDAN: Highway 65 Amman – Aqaba (Desert Highway) ──
    { id: 'JOR_H65', name: 'Jordan: Amman–Aqaba', segments: [
        { path: [[35.9340,31.9539],[35.9500,31.8000],[35.9800,31.6000],[36.0000,31.4000],[36.0200,31.2000],[36.0500,31.0000]] },
        { path: [[36.0500,31.0000],[36.0300,30.8000],[35.9800,30.6000],[35.9500,30.4000],[35.9200,30.2000],[35.0063,29.5267]] }
    ]}
];

class TrafficFlowSystem {
    constructor() {
        this.corridors = AUSTIN_CORRIDORS.map(c => ({
            ...c,
            segments: c.segments.map(s => ({
                ...s,
                congestion: Math.random() * 100,
                speed: 30 + Math.random() * 40,
                volume: Math.floor(Math.random() * 3000)
            }))
        }));
        this.entities = {};
        this.visible = false;
        this.updateTimer = null;
        this.heatmapEnabled = false;
    }

    start() {
        this._simulateTraffic();
        if (this.updateTimer) clearInterval(this.updateTimer);
        this.updateTimer = setInterval(() => this._simulateTraffic(), 10000);
    }

    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    _simulateTraffic() {
        const hour = new Date().getHours();
        // Rush hour bias
        const rushMultiplier = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18) ? 1.6 : 
                              (hour >= 11 && hour <= 13) ? 1.2 : 0.7;

        this.corridors.forEach(corridor => {
            corridor.segments.forEach(seg => {
                // Evolve congestion with some noise
                const drift = (Math.random() - 0.48) * 15 * rushMultiplier;
                seg.congestion = Math.max(0, Math.min(100, seg.congestion + drift));
                seg.speed = Math.max(5, 65 - (seg.congestion * 0.55));
                seg.volume = Math.floor(500 + seg.congestion * 25 + Math.random() * 200);
            });
        });

        if (this.visible && window.viewer) {
            this._renderTrafficOverlay(window.viewer);
        }
    }

    _getCongestionLevel(value) {
        if (value < 25) return CONGESTION_LEVELS.FREE;
        if (value < 50) return CONGESTION_LEVELS.MODERATE;
        if (value < 75) return CONGESTION_LEVELS.HEAVY;
        return CONGESTION_LEVELS.GRIDLOCK;
    }

    _renderTrafficOverlay(viewer) {
        // Remove old entities
        this.removeOverlay(viewer);

        this.corridors.forEach(corridor => {
            corridor.segments.forEach((seg, i) => {
                const level = this._getCongestionLevel(seg.congestion);
                const entityId = `traffic_${corridor.id}_${i}`;

                // Build flat [lon,lat,lon,lat,...] array from path waypoints
                const flat = [];
                for (const pt of seg.path) {
                    flat.push(pt[0], pt[1]);
                }
                const positions = Cesium.Cartesian3.fromDegreesArray(flat);

                const entity = viewer.entities.add({
                    id: entityId,
                    polyline: {
                        positions: positions,
                        width: 6 + (seg.congestion / 20),
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.25,
                            color: Cesium.Color.fromCssColorString(level.color).withAlpha(0.8)
                        }),
                        clampToGround: true
                    }
                });

                this.entities[entityId] = entity;
            });
        });
    }

    removeOverlay(viewer) {
        if (!viewer) return;
        Object.keys(this.entities).forEach(id => {
            viewer.entities.remove(this.entities[id]);
        });
        this.entities = {};
    }

    toggle(viewer) {
        this.visible = !this.visible;
        if (this.visible) {
            this.start();
            this._renderTrafficOverlay(viewer);
        } else {
            this.removeOverlay(viewer);
        }
        return this.visible;
    }

    getCorridorStats() {
        return this.corridors.map(c => {
            const avgCongestion = c.segments.reduce((sum, s) => sum + s.congestion, 0) / c.segments.length;
            const avgSpeed = c.segments.reduce((sum, s) => sum + s.speed, 0) / c.segments.length;
            const totalVolume = c.segments.reduce((sum, s) => sum + s.volume, 0);
            const level = this._getCongestionLevel(avgCongestion);

            return {
                id: c.id,
                name: c.name,
                congestion: Math.round(avgCongestion),
                speed: Math.round(avgSpeed),
                volume: totalVolume,
                level: level.label,
                color: level.color
            };
        });
    }

    getOverallStats() {
        const allSegments = this.corridors.flatMap(c => c.segments);
        const avgCongestion = allSegments.reduce((sum, s) => sum + s.congestion, 0) / allSegments.length;
        const avgSpeed = allSegments.reduce((sum, s) => sum + s.speed, 0) / allSegments.length;
        const gridlockCount = allSegments.filter(s => s.congestion >= 75).length;

        return {
            avgCongestion: Math.round(avgCongestion),
            avgSpeed: Math.round(avgSpeed),
            totalSegments: allSegments.length,
            gridlockSegments: gridlockCount,
            corridorCount: this.corridors.length,
            level: this._getCongestionLevel(avgCongestion)
        };
    }

    renderStatsPanel() {
        const panel = document.getElementById('traffic-stats-panel');
        if (!panel) return;

        const stats = this.getOverallStats();
        const corridors = this.getCorridorStats();

        panel.innerHTML = `
            <div class="traffic-overview">
                <div class="traffic-metric">
                    <span class="traffic-metric-label">AVG CONGESTION</span>
                    <span class="traffic-metric-value" style="color:${stats.level.color}">${stats.avgCongestion}%</span>
                </div>
                <div class="traffic-metric">
                    <span class="traffic-metric-label">AVG SPEED</span>
                    <span class="traffic-metric-value">${stats.avgSpeed} mph</span>
                </div>
                <div class="traffic-metric">
                    <span class="traffic-metric-label">GRIDLOCK</span>
                    <span class="traffic-metric-value" style="color:${stats.gridlockSegments > 0 ? '#ff2244' : '#00ff41'}">${stats.gridlockSegments}/${stats.totalSegments}</span>
                </div>
            </div>
            <div class="traffic-corridors">
                ${corridors.map(c => `
                    <div class="traffic-corridor-item">
                        <div class="corridor-header">
                            <span class="corridor-name">${c.name}</span>
                            <span class="corridor-level" style="color:${c.color}">${c.level}</span>
                        </div>
                        <div class="corridor-bar">
                            <div class="corridor-bar-fill" style="width:${c.congestion}%; background:${c.color}"></div>
                        </div>
                        <div class="corridor-details">
                            <span>${c.speed} mph</span>
                            <span>${c.volume} veh/hr</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

window.TrafficFlow = new TrafficFlowSystem();
export default window.TrafficFlow;
