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

// Austin major corridors — multi-point polylines following actual road geometry.
// Each segment stores an array of [lon,lat] waypoints so polylines hug the road.
const AUSTIN_CORRIDORS = [
    { id: 'I35_N', name: 'I-35 Northbound', segments: [
        { path: [[-97.7530,30.2100],[-97.7500,30.2180],[-97.7462,30.2270],[-97.7420,30.2350],[-97.7395,30.2440],[-97.7380,30.2520]] },
        { path: [[-97.7380,30.2520],[-97.7370,30.2600],[-97.7350,30.2680],[-97.7330,30.2750],[-97.7280,30.2850],[-97.7235,30.2930],[-97.7190,30.3030]] },
        { path: [[-97.7190,30.3030],[-97.7150,30.3100],[-97.7120,30.3170],[-97.7080,30.3250],[-97.7020,30.3350],[-97.6970,30.3430],[-97.6920,30.3510]] },
        { path: [[-97.6920,30.3510],[-97.6890,30.3600],[-97.6860,30.3690],[-97.6845,30.3780],[-97.6830,30.3900]] }
    ]},
    { id: 'I35_S', name: 'I-35 Southbound', segments: [
        { path: [[-97.6825,30.3900],[-97.6840,30.3780],[-97.6855,30.3690],[-97.6885,30.3600],[-97.6915,30.3510]] },
        { path: [[-97.6915,30.3510],[-97.6965,30.3430],[-97.7015,30.3350],[-97.7075,30.3250],[-97.7115,30.3170],[-97.7145,30.3100],[-97.7185,30.3030]] },
        { path: [[-97.7185,30.3030],[-97.7230,30.2930],[-97.7275,30.2850],[-97.7325,30.2750],[-97.7345,30.2680],[-97.7365,30.2600],[-97.7375,30.2520]] },
        { path: [[-97.7375,30.2520],[-97.7390,30.2440],[-97.7415,30.2350],[-97.7457,30.2270],[-97.7495,30.2180],[-97.7525,30.2100]] }
    ]},
    { id: 'MOPAC_N', name: 'MoPac Northbound', segments: [
        { path: [[-97.7960,30.2200],[-97.7975,30.2300],[-97.7985,30.2400],[-97.7990,30.2500],[-97.7985,30.2600]] },
        { path: [[-97.7985,30.2600],[-97.7960,30.2700],[-97.7920,30.2800],[-97.7870,30.2900],[-97.7820,30.2980],[-97.7760,30.3050],[-97.7700,30.3100]] },
        { path: [[-97.7700,30.3100],[-97.7640,30.3180],[-97.7580,30.3260],[-97.7520,30.3350],[-97.7470,30.3440],[-97.7430,30.3530],[-97.7400,30.3600]] }
    ]},
    { id: 'US183', name: 'US 183', segments: [
        { path: [[-97.7630,30.3200],[-97.7580,30.3260],[-97.7520,30.3320],[-97.7460,30.3380],[-97.7400,30.3430],[-97.7340,30.3470],[-97.7300,30.3500]] },
        { path: [[-97.7300,30.3500],[-97.7260,30.3550],[-97.7220,30.3600],[-97.7200,30.3650],[-97.7185,30.3700]] },
        { path: [[-97.7185,30.3700],[-97.7140,30.3730],[-97.7080,30.3750],[-97.7010,30.3770],[-97.6920,30.3785],[-97.6840,30.3800]] }
    ]},
    { id: 'CONGRESS', name: 'Congress Ave', segments: [
        { path: [[-97.7480,30.2450],[-97.7478,30.2500],[-97.7475,30.2550],[-97.7470,30.2600],[-97.7460,30.2640],[-97.7450,30.2672]] },
        { path: [[-97.7450,30.2672],[-97.7445,30.2710],[-97.7440,30.2750],[-97.7435,30.2780],[-97.7430,30.2820]] }
    ]},
    { id: 'LAMAR', name: 'Lamar Blvd', segments: [
        { path: [[-97.7565,30.2500],[-97.7558,30.2560],[-97.7550,30.2620],[-97.7540,30.2680],[-97.7530,30.2740],[-97.7520,30.2800]] },
        { path: [[-97.7520,30.2800],[-97.7515,30.2870],[-97.7510,30.2940],[-97.7508,30.3010],[-97.7505,30.3100]] }
    ]},
    { id: 'BEN_WHITE', name: 'Ben White Blvd / SH 71', segments: [
        { path: [[-97.8100,30.2310],[-97.8000,30.2305],[-97.7900,30.2300],[-97.7800,30.2298],[-97.7700,30.2296],[-97.7600,30.2295],[-97.7550,30.2295]] },
        { path: [[-97.7550,30.2295],[-97.7450,30.2293],[-97.7350,30.2290],[-97.7250,30.2288],[-97.7150,30.2286],[-97.7050,30.2285],[-97.6900,30.2283]] }
    ]},
    { id: 'PARMER', name: 'Parmer Ln', segments: [
        { path: [[-97.7900,30.4195],[-97.7800,30.4193],[-97.7700,30.4192],[-97.7600,30.4191],[-97.7525,30.4190]] },
        { path: [[-97.7525,30.4190],[-97.7400,30.4188],[-97.7280,30.4186],[-97.7150,30.4184],[-97.7000,30.4182],[-97.6900,30.4180],[-97.6800,30.4178]] }
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
