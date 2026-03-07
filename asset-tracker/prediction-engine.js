/**
 * @file prediction-engine.js
 * @description Predictive path calculation using dead reckoning and haversine forward calculation.
 */

const EARTH_RADIUS = 6371000; // meters

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

/**
 * Calculates the predicted path of an asset based on current telemetry.
 * @param {Object} asset - Asset object with lat, lon, altitude, speed (knots), heading (degrees)
 * @param {number} minutes - How many minutes to project ahead
 * @returns {Array|null} Array of predicted positions
 */
export function calculateInterceptPath(asset, minutes = 15) {
    if (!asset.speed || asset.heading === undefined || asset.lat === undefined || asset.lon === undefined) {
        return null;
    }

    const predictions = [];
    const speedMetersPerSec = asset.speed * 0.514444; // knots to m/s
    const headingRad = toRadians(asset.heading);
    const startLat = toRadians(asset.lat);
    const startLon = toRadians(asset.lon);
    const startAlt = asset.altitude || 0;

    // Add current position as first point
    predictions.push({
        time: 0,
        lat: asset.lat,
        lon: asset.lon,
        altitude: startAlt,
        confidence: 1.0
    });

    for (let t = 1; t <= minutes; t++) {
        const distanceMeters = speedMetersPerSec * t * 60; // meters traveled in t minutes

        // Forward azimuth calculation (haversine)
        const lat2 = Math.asin(
            Math.sin(startLat) * Math.cos(distanceMeters / EARTH_RADIUS) +
            Math.cos(startLat) * Math.sin(distanceMeters / EARTH_RADIUS) * Math.cos(headingRad)
        );

        const lon2 = startLon + Math.atan2(
            Math.sin(headingRad) * Math.sin(distanceMeters / EARTH_RADIUS) * Math.cos(startLat),
            Math.cos(distanceMeters / EARTH_RADIUS) - Math.sin(startLat) * Math.sin(lat2)
        );

        // Simple altitude projection (assume level flight for now)
        const projectedAlt = startAlt;

        predictions.push({
            time: t,
            lat: toDegrees(lat2),
            lon: toDegrees(lon2),
            altitude: Math.max(0, projectedAlt),
            confidence: 1 - (t / minutes) * 0.5
        });
    }

    return predictions;
}

/**
 * Calculates the distance between two points in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Predicts if two assets will intercept.
 */
export function calculateInterceptPoint(asset1, asset2, maxMinutes = 30) {
    const path1 = calculateInterceptPath(asset1, maxMinutes);
    const path2 = calculateInterceptPath(asset2, maxMinutes);

    if (!path1 || !path2) return null;

    for (let i = 0; i < path1.length; i++) {
        const p1 = path1[i];
        const p2 = path2[i]; // Same time index

        const dist = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);

        if (dist < 10) { // 10km threshold
            return {
                willIntercept: true,
                time: i,
                point: p1,
                distance: dist
            };
        }
    }

    return { willIntercept: false };
}
