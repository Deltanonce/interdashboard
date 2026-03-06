/**
 * @file adsb-validator.js
 * @description Comprehensive validation layer for ADS-B telemetry data.
 */

const VALIDATION_RULES = {
    MAX_ALTITUDE: 60000,        // feet (Standard military ceiling)
    MAX_SPEED: 2000,            // knots (~Mach 3)
    MAX_VERTICAL_RATE: 20000,   // ft/min
    MAX_DISTANCE_PER_POLL: 500, // km (based on 15s poll interval)
    EMERGENCY_SQUAWKS: ['7500', '7600', '7700']
};

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Validates incoming ADS-B flight data against sanity rules and previous state.
 * @param {Object} flight - Current normalized flight data
 * @param {Object|null} previousData - Previous data for this hex ID
 * @returns {Object} Validation result
 */
function validateFlightData(flight, previousData = null) {
    const issues = [];
    const warnings = [];

    // 1. Altitude Sanity Check
    if (flight.altitude > VALIDATION_RULES.MAX_ALTITUDE) {
        issues.push({
            type: 'altitude_unrealistic',
            value: flight.altitude,
            limit: VALIDATION_RULES.MAX_ALTITUDE,
            desc: 'Altitude exceeds standard military ceiling'
        });
    }

    // 2. Speed Sanity Check
    if (flight.speed > VALIDATION_RULES.MAX_SPEED) {
        issues.push({
            type: 'speed_impossible',
            value: flight.speed,
            limit: VALIDATION_RULES.MAX_SPEED,
            desc: 'Recorded speed exceeds physics limits (~Mach 3+)'
        });
    }

    // 3. Teleportation / Coordinate Jump Detection
    if (previousData && typeof previousData.lat === 'number' && typeof previousData.lon === 'number') {
        const dist = haversineDistance(
            previousData.lat, previousData.lon,
            flight.lat, flight.lon
        );
        const timeDelta = (flight._timestamp - previousData._timestamp) / 1000; // seconds

        // If distance is huge (>500km) in a short window (<60s)
        if (dist > VALIDATION_RULES.MAX_DISTANCE_PER_POLL && timeDelta < 60) {
            issues.push({
                type: 'coordinate_jump',
                value: Math.round(dist),
                timeDelta: Math.round(timeDelta),
                desc: `Impossible displacement detected: ${Math.round(dist)}km in ${Math.round(timeDelta)}s`
            });
        }
    }

    // 4. Emergency Squawk Detection
    if (flight.squawk && VALIDATION_RULES.EMERGENCY_SQUAWKS.includes(String(flight.squawk))) {
        warnings.push({
            type: 'emergency_squawk',
            value: flight.squawk,
            meaning: getSquawkMeaning(flight.squawk)
        });
    }

    return {
        valid: issues.length === 0,
        issues: issues,
        warnings: warnings,
        severity: issues.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'ok')
    };
}

function getSquawkMeaning(squawk) {
    const meanings = {
        '7500': 'HIJACKING / UNLAWFUL INTERFERENCE',
        '7600': 'RADIO FAILURE / LOST COMMS',
        '7700': 'GENERAL EMERGENCY'
    };
    return meanings[squawk] || 'UNKNOWN EMERGENCY';
}

export { validateFlightData, VALIDATION_RULES };
