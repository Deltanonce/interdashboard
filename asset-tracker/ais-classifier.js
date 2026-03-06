/**
 * @file ais-classifier.js
 * @description IMO AIS Ship Type classification and threat assessment engine.
 */

const VESSEL_CATEGORIES = {
    MILITARY: {
        types: [35],
        threatLevel: 'high',
        icon: '⚔️',
        color: '#ff4757',
        description: 'Military operations vessel'
    },
    LAW_ENFORCEMENT: {
        types: [55],
        threatLevel: 'high',
        icon: '🛡️',
        color: '#ff4757',
        description: 'Law enforcement vessel'
    },
    TANKER: {
        types: [80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
        threatLevel: 'medium',
        icon: '🛢️',
        color: '#ffa502',
        description: 'Oil/Chemical/Gas tanker',
        subtypes: {
            80: 'All tankers',
            81: 'Hazardous category A',
            82: 'Hazardous category B',
            83: 'Hazardous category C',
            84: 'Hazardous category D',
            89: 'No additional information'
        }
    },
    CARGO: {
        types: [70, 71, 72, 73, 74, 75, 76, 77, 78, 79],
        threatLevel: 'low',
        icon: '📦',
        color: '#2ed573',
        description: 'Cargo vessel',
        subtypes: {
            70: 'All cargo ships',
            71: 'Hazardous category A',
            72: 'Hazardous category B',
            73: 'Hazardous category C',
            74: 'Hazardous category D',
            79: 'No additional information'
        }
    },
    PASSENGER: {
        types: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
        threatLevel: 'low',
        icon: '🚢',
        color: '#1e90ff',
        description: 'Passenger vessel'
    },
    HIGH_SPEED: {
        types: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
        threatLevel: 'medium',
        icon: '⚡',
        color: '#fffa65',
        description: 'High speed craft'
    },
    FISHING: {
        types: [30],
        threatLevel: 'low',
        icon: '🎣',
        color: '#26de81',
        description: 'Fishing vessel'
    },
    SPECIAL: {
        types: [31, 32, 33, 34, 50, 51, 52, 53, 54, 58],
        threatLevel: 'low',
        icon: '🛠️',
        color: '#7bed9f',
        description: 'Special purpose vessel',
        subtypes: {
            31: 'Towing',
            32: 'Towing (large)',
            33: 'Dredging',
            34: 'Diving ops',
            50: 'Pilot',
            51: 'Search and Rescue',
            52: 'Tug',
            53: 'Port Tender',
            54: 'Anti-pollution',
            58: 'Medical'
        }
    },
    WIG: {
        types: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        threatLevel: 'medium',
        icon: '🦅',
        color: '#70a1ff',
        description: 'Wing in Ground craft'
    },
    SAILING: {
        types: [36, 37],
        threatLevel: 'low',
        icon: '⛵',
        color: '#1e90ff',
        description: 'Sailing/Pleasure craft'
    },
    OTHER: {
        types: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99],
        threatLevel: 'low',
        icon: '🚢',
        color: '#95a5a6',
        description: 'Other type of vessel'
    }
};

/**
 * Classifies a vessel based on its AIS Ship Type code.
 * @param {number} typeCode 
 * @returns {Object} Classification metadata
 */
export function classifyVessel(typeCode) {
    if (!typeCode) {
        return {
            category: 'UNKNOWN',
            threatLevel: 'low',
            icon: '🚢',
            color: '#2ed573',
            description: 'Unclassified vessel',
            typeCode: null
        };
    }

    for (const [category, data] of Object.entries(VESSEL_CATEGORIES)) {
        if (data.types.includes(typeCode)) {
            return {
                category: category,
                threatLevel: data.threatLevel,
                icon: data.icon,
                color: data.color,
                description: data.description,
                subtype: data.subtypes ? data.subtypes[typeCode] : null,
                typeCode: typeCode
            };
        }
    }

    return {
        category: 'OTHER',
        threatLevel: 'low',
        icon: '🚢',
        color: '#2ed573',
        description: `Type ${typeCode} vessel`,
        typeCode: typeCode
    };
}

/**
 * High-level restricted zones check (Chokepoints)
 */
function isInRestrictedZone(vessel) {
    // Simplified restricted zones (Strait of Hormuz, Bab el-Mandeb)
    const chokepoints = [
        { latMin: 26, latMax: 27, lonMin: 55, lonMax: 57 }, // Hormuz
        { latMin: 12, latMax: 13, lonMin: 43, lonMax: 44 }  // Bab el-Mandeb
    ];
    
    return chokepoints.some(z => 
        vessel.lat >= z.latMin && vessel.lat <= z.latMax && 
        vessel.lon >= z.lonMin && vessel.lon <= z.lonMax
    );
}

/**
 * Assesses threat level with dynamic modifiers.
 * @param {Object} vessel 
 * @returns {Object} Enhanced classification with final threat level
 */
export function assessThreatLevel(vessel) {
    const base = classifyVessel(vessel.vesselType);
    let modifier = 0;
    const reasons = [];

    // Modifier 1: High speed in chokepoints
    if (vessel.speed > 25 && isInRestrictedZone(vessel)) {
        modifier += 1;
        reasons.push('High speed maneuvering in restricted chokepoint');
    }

    // Modifier 2: Identity mismatch or missing MMSI (already handled by ID logic, but here for completeness)
    if (!vessel.mmsi || vessel.mmsi.length < 9) {
        modifier += 1;
        reasons.push('Incomplete identity broadcast');
    }

    // Modifier 3: Tankers/Cargo if speed is 0 in open water (potential hijacking or breakdown)
    if (vessel.speed < 0.1 && (base.category === 'TANKER' || base.category === 'CARGO') && !isInRestrictedZone(vessel)) {
        // Only if not near port - simplified check
        if (vessel.lat < 10 || vessel.lat > 35) { // broad open water check
            modifier += 1;
            reasons.push('Unexpected station-keeping in open water');
        }
    }

    const threatLevels = ['low', 'medium', 'high', 'critical'];
    let index = threatLevels.indexOf(base.threatLevel);
    if (index === -1) index = 0;
    
    const finalIndex = Math.min(index + modifier, threatLevels.length - 1);
    const finalLevel = threatLevels[finalIndex];

    return {
        ...base,
        finalThreatLevel: finalLevel,
        threatModifiers: modifier,
        threatReasons: reasons
    };
}
