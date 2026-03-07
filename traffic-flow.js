// traffic-flow.js — Real-Time Traffic Flow Analysis System
// Simulates traffic congestion analysis with heatmap overlays on Cesium

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

// Austin major corridor segments for traffic simulation
const AUSTIN_CORRIDORS = [
    { id: 'I35_N', name: 'I-35 Northbound', segments: [
        { lat1: 30.2100, lon1: -97.7530, lat2: 30.2520, lon2: -97.7380 },
        { lat1: 30.2520, lon1: -97.7380, lat2: 30.3030, lon2: -97.7190 },
        { lat1: 30.3030, lon1: -97.7190, lat2: 30.3510, lon2: -97.6920 },
        { lat1: 30.3510, lon1: -97.6920, lat2: 30.3900, lon2: -97.6830 }
    ]},
    { id: 'I35_S', name: 'I-35 Southbound', segments: [
        { lat1: 30.3900, lon1: -97.6830, lat2: 30.3510, lon2: -97.6920 },
        { lat1: 30.3510, lon1: -97.6920, lat2: 30.3030, lon2: -97.7190 },
        { lat1: 30.3030, lon1: -97.7190, lat2: 30.2520, lon2: -97.7380 },
        { lat1: 30.2520, lon1: -97.7380, lat2: 30.2100, lon2: -97.7530 }
    ]},
    { id: 'MOPAC_N', name: 'MoPac Northbound', segments: [
        { lat1: 30.2200, lon1: -97.7900, lat2: 30.2600, lon2: -97.7950 },
        { lat1: 30.2600, lon1: -97.7950, lat2: 30.3100, lon2: -97.7700 },
        { lat1: 30.3100, lon1: -97.7700, lat2: 30.3600, lon2: -97.7400 }
    ]},
    { id: 'US183', name: 'US 183', segments: [
        { lat1: 30.3200, lon1: -97.7600, lat2: 30.3500, lon2: -97.7300 },
        { lat1: 30.3500, lon1: -97.7300, lat2: 30.3700, lon2: -97.7180 },
        { lat1: 30.3700, lon1: -97.7180, lat2: 30.3800, lon2: -97.6800 }
    ]},
    { id: 'CONGRESS', name: 'Congress Ave', segments: [
        { lat1: 30.2450, lon1: -97.7485, lat2: 30.2672, lon2: -97.7431 },
        { lat1: 30.2672, lon1: -97.7431, lat2: 30.2820, lon2: -97.7420 }
    ]},
    { id: 'LAMAR', name: 'Lamar Blvd', segments: [
        { lat1: 30.2500, lon1: -97.7540, lat2: 30.2800, lon2: -97.7505 },
        { lat1: 30.2800, lon1: -97.7505, lat2: 30.3100, lon2: -97.7505 }
    ]},
    { id: 'BEN_WHITE', name: 'Ben White Blvd / SH 71', segments: [
        { lat1: 30.2295, lon1: -97.8100, lat2: 30.2295, lon2: -97.7550 },
        { lat1: 30.2295, lon1: -97.7550, lat2: 30.2295, lon2: -97.6900 }
    ]},
    { id: 'PARMER', name: 'Parmer Ln', segments: [
        { lat1: 30.4190, lon1: -97.7900, lat2: 30.4190, lon2: -97.7525 },
        { lat1: 30.4190, lon1: -97.7525, lat2: 30.4190, lon2: -97.6800 }
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

                const positions = Cesium.Cartesian3.fromDegreesArray([
                    seg.lon1, seg.lat1, seg.lon2, seg.lat2
                ]);

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
