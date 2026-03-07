/**
 * @file trail-manager.js
 * @description Manages asset movement history and trail points.
 */

/**
 * Calculates the Haversine distance between two points in kilometers.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in KM
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Updates the short-term trail of an asset.
 * @param {Object} asset - The asset object to update
 * @param {number} newLat 
 * @param {number} newLon 
 * @param {number} newAlt 
 * @param {number} maxTrailPoints 
 */
export function updateTrail(asset, newLat, newLon, newAlt, maxTrailPoints) {
    if (!asset.trail) asset.trail = [];
    if (!asset.trailAlt) asset.trailAlt = [];

    // Only add if moved meaningfully (> ~10m)
    if (asset.trail.length > 0) {
        const last = asset.trail[asset.trail.length - 1];
        const dist = haversineKm(last[0], last[1], newLat, newLon);
        if (dist < 0.01) return; 
    }

    asset.trail.push([newLat, newLon]);
    asset.trailAlt.push(newAlt || 0);

    // Prune to max
    while (asset.trail.length > maxTrailPoints) {
        asset.trail.shift();
        asset.trailAlt.shift();
    }
}

/**
 * Updates the long-term history of an asset.
 * @param {Object} asset - The asset object to update
 * @param {number} newLat 
 * @param {number} newLon 
 * @param {number} maxHistoryPoints 
 */
export function updateHistory(asset, newLat, newLon, maxHistoryPoints) {
    if (!asset.history) asset.history = [];
    if (asset.history.length === 0) {
        asset.history.push([newLat, newLon]);
        return;
    }

    const last = asset.history[asset.history.length - 1];
    const dist = haversineKm(last[0], last[1], newLat, newLon);
    if (dist < 0.01) return;

    asset.history.push([newLat, newLon]);

    while (asset.history.length > maxHistoryPoints) {
        // Keep first seen origin point in index 0.
        asset.history.splice(1, 1);
    }
}
