/**
 * @file adiz-zones.js
 * @description Defines Air Defense Identification Zones and incursion detection logic.
 */

const ADIZ_ZONES = {
    indonesia: {
        name: 'Indonesia ADIZ',
        bounds: { latMin: -11, latMax: 6, lonMin: 95, lonMax: 141 },
        priority: 'high'
    },
    south_china_sea: {
        name: 'South China Sea',
        bounds: { latMin: 0, latMax: 23, lonMin: 105, lonMax: 121 },
        priority: 'critical'
    },
    strait_of_malacca: {
        name: 'Strait of Malacca',
        bounds: { latMin: 1, latMax: 6, lonMin: 98, lonMax: 104 },
        priority: 'high'
    },
    persian_gulf: {
        name: 'Persian Gulf / Hormuz',
        bounds: { latMin: 24, latMax: 30, lonMin: 48, lonMax: 57 },
        priority: 'critical'
    }
};

/**
 * Checks if a point is inside a zone's bounds.
 */
function isInsideZone(lat, lon, zoneBounds) {
    return (
        lat >= zoneBounds.latMin &&
        lat <= zoneBounds.latMax &&
        lon >= zoneBounds.lonMin &&
        lon <= zoneBounds.lonMax
    );
}

/**
 * Checks which ADIZ zones an asset has entered.
 * @param {Object} asset - Object with lat and lon
 * @returns {Array} List of entered zones
 */
function checkADIZEntry(asset) {
    const enteredZones = [];
    if (asset.lat == null || asset.lon == null) return enteredZones;

    for (const [zoneId, zone] of Object.entries(ADIZ_ZONES)) {
        if (isInsideZone(asset.lat, asset.lon, zone.bounds)) {
            enteredZones.push({
                id: zoneId,
                name: zone.name,
                priority: zone.priority
            });
        }
    }
    return enteredZones;
}

module.exports = { ADIZ_ZONES, isInsideZone, checkADIZEntry };
