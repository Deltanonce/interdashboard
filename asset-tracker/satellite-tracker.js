/**
 * @file satellite-tracker.js
 * @description Multi-constellation satellite tracking using TLE data and SGP4 algorithm.
 */

const CELESTRAK_URLS = {
    reconnaissance: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle',
    communication: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
    navigation: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle',
    weather: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle'
};

const SATELLITE_CATEGORIES = {
    reconnaissance: {
        keywords: ['USA-245', 'USA-290', 'USA-224', 'COSMOS-2542', 'YAOGAN', 'IGS', 'NROL'],
        color: '#ff4757', // Red
        icon: '🛰️',
        threatLevel: 'high',
        description: 'Intelligence & Surveillance'
    },
    communication: {
        keywords: ['STARLINK', 'IRIDIUM', 'INTELSAT', 'INMARSAT', 'ONEWEB'],
        color: '#00d2ff', // Cyan
        icon: '📡',
        threatLevel: 'low',
        description: 'Communication Hubs'
    },
    earlyWarning: {
        keywords: ['DSP', 'SBIRS', 'USA-230', 'TRUMPET', 'TUNDRA'],
        color: '#ffa502', // Orange
        icon: '⚠️',
        threatLevel: 'critical',
        description: 'Early Warning Systems'
    },
    navigation: {
        keywords: ['GPS', 'GLONASS', 'GALILEO', 'BEIDOU', 'NAVIC'],
        color: '#26de81', // Green
        icon: '🧭',
        threatLevel: 'low',
        description: 'Global Navigation'
    }
};

class SatelliteTracker {
    constructor() {
        this.satellites = new Map(); // noradId -> { name, tle1, tle2, satrec, category, entity }
        this.updateInterval = null;
        this.enabled = false;
        this.visibleCategories = new Set(['reconnaissance', 'earlyWarning']);
        this.viewer = null;
    }

    async fetchTLEData(category) {
        const url = CELESTRAK_URLS[category];
        if (!url) return [];

        try {
            // Using a CORS proxy if necessary, but CelesTrak often allows direct requests now
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            return this.parseTLE(text);
        } catch (error) {
            console.warn(`[SATELLITE] Failed to fetch ${category} from CelesTrak:`, error.message);
            return [];
        }
    }

    parseTLE(tleText) {
        const lines = tleText.trim().split('\n');
        const results = [];

        for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 >= lines.length) break;

            const name = lines[i].trim();
            const line1 = lines[i + 1].trim();
            const line2 = lines[i + 2].trim();

            const category = this.categorize(name);
            if (!category) continue;

            try {
                // 'satellite' is available globally via CDN in index.html
                const satrec = window.satellite.twoline2satrec(line1, line2);
                results.push({
                    name,
                    line1,
                    line2,
                    satrec,
                    category,
                    noradId: satrec.satnum
                });
            } catch (e) {
                // skip invalid TLEs
            }
        }
        return results;
    }

    categorize(name) {
        const upperName = name.toUpperCase();
        for (const [cat, data] of Object.entries(SATELLITE_CATEGORIES)) {
            if (data.keywords.some(k => upperName.includes(k))) {
                return cat;
            }
        }
        return null;
    }

    calculatePosition(satrec, date = new Date()) {
        if (!window.satellite) return null;
        const pAndV = window.satellite.propagate(satrec, date);
        if (!pAndV.position) return null;

        const gmst = window.satellite.gstime(date);
        const posGd = window.satellite.eciToGeodetic(pAndV.position, gmst);

        return {
            lon: window.satellite.degreesLong(posGd.longitude),
            lat: window.satellite.degreesLat(posGd.latitude),
            alt: posGd.height * 1000 // km to meters
        };
    }

    async loadAllSatellites() {
        console.log('[SATELLITE] Synchronizing orbital database...');
        const loaders = Object.keys(CELESTRAK_URLS).map(cat => this.fetchTLEData(cat));
        const results = await Promise.all(loaders);

        results.forEach(sats => {
            sats.forEach(sat => {
                if (!this.satellites.has(sat.noradId)) {
                    this.satellites.set(sat.noradId, sat);
                }
            });
        });

        console.log(`[SATELLITE] Database synchronized. ${this.satellites.size} active assets indexed.`);
        this.updateStatsUI();
    }

    render(viewer) {
        if (!viewer) return;
        this.viewer = viewer;

        for (const [id, sat] of this.satellites) {
            const isVisible = this.enabled && this.visibleCategories.has(sat.category);

            if (!isVisible) {
                if (sat.entity) {
                    viewer.entities.remove(sat.entity);
                    sat.entity = null;
                }
                continue;
            }

            if (!sat.entity) {
                const catData = SATELLITE_CATEGORIES[sat.category];
                const cesiumColor = Cesium.Color.fromCssColorString(catData.color);

                sat.entity = viewer.entities.add({
                    id: `sat-${id}`,
                    name: sat.name,
                    position: new Cesium.CallbackProperty((time) => {
                        const jsDate = Cesium.JulianDate.toDate(time);
                        const pos = this.calculatePosition(sat.satrec, jsDate);
                        if (!pos) return Cesium.Cartesian3.ZERO;
                        return Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt);
                    }, false),
                    point: {
                        pixelSize: 5,
                        color: cesiumColor,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 1
                    },
                    label: {
                        text: sat.name,
                        font: '10pt Share Tech Mono, monospace',
                        fillColor: cesiumColor,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000000)
                    },
                    path: {
                        show: true,
                        leadTime: 2700, // 45 min
                        trailTime: 2700,
                        width: 1,
                        material: cesiumColor.withAlpha(0.2),
                        resolution: 120
                    },
                    description: `
                        <div class="sat-infobox">
                            <strong>${sat.name}</strong><br>
                            Type: ${catData.description}<br>
                            NORAD ID: ${id}<br>
                            Threat: ${catData.threatLevel.toUpperCase()}
                        </div>
                    `
                });
            }
        }
    }

    start(viewer) {
        this.enabled = true;
        this.render(viewer);
        this.updateStatsUI();
    }

    stop(viewer) {
        this.enabled = false;
        this.render(viewer);
        this.updateStatsUI();
    }

    toggleCategory(category, visible, viewer) {
        if (visible) this.visibleCategories.add(category);
        else this.visibleCategories.delete(category);
        this.render(viewer);
        this.updateStatsUI();
    }

    updateStatsUI() {
        const statsEl = document.getElementById('satellite-stats');
        if (!statsEl) return;

        let html = `<div style="margin-top:10px; border-top:1px solid rgba(0,255,65,0.2); padding-top:10px;">`;
        html += `ACTIVE ASSETS: ${this.satellites.size}<br>`;
        
        for (const [cat, data] of Object.entries(SATELLITE_CATEGORIES)) {
            const count = Array.from(this.satellites.values()).filter(s => s.category === cat).length;
            const isVis = this.visibleCategories.has(cat);
            html += `<span style="color:${data.color}; opacity:${isVis ? 1 : 0.4}">●</span> ${cat.toUpperCase()}: ${count}<br>`;
        }
        html += `</div>`;
        statsEl.innerHTML = html;
    }
}

const tracker = new SatelliteTracker();
window.SatelliteTracker = tracker;
export default tracker;
export { SATELLITE_CATEGORIES };
