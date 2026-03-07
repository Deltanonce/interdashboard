/**
 * @file confidence-engine.js
 * @description Spoofing detection and confidence scoring engine.
 */

import { haversineKm } from './trail-manager.js';

const SPOOFING_DISTANCE_KM = 100;
const SPOOFING_TIME_SEC = 60;

/**
 * Computes the confidence score and spoofing status of an asset.
 * @param {Object} asset - The current asset data
 * @param {Object|null} prevAsset - The previous asset data for comparison
 * @returns {Object} { confidence: number, spoofing: boolean }
 */
export function computeConfidence(asset, prevAsset) {
    let score = 0;
    let spoofing = false;

    // ── Factor 1: Data Age (0-40 pts) ──
    const ageSec = asset._seenSec || 999;
    if (ageSec < 5) score += 40;
    else if (ageSec < 30) score += 30;
    else if (ageSec < 120) score += 15;
    else score += 5;

    // ── Factor 2: Source Quality (0-30 pts) ──
    const src = (asset.source || '').toLowerCase();
    if (src === 'adsb_icao') score += 30;
    else if (src === 'ais') score += 25;
    else if (src === 'adsb_icao_nt' || src === 'adsr_icao') score += 25;
    else if (src === 'mlat') score += 15;
    else if (src === 'tisb' || src === 'tisb_icao') score += 10;
    else score += 10; // unknown source

    // ── Factor 3: Speed Consistency / Spoofing Detection (0-30 pts) ──
    if (prevAsset && typeof prevAsset.lat === 'number' && typeof prevAsset.lon === 'number' && prevAsset._timestamp) {
        const distKm = haversineKm(prevAsset.lat, prevAsset.lon, asset.lat, asset.lon);
        const dtSec = (asset._timestamp - prevAsset._timestamp) / 1000;

        if (dtSec > 0 && dtSec < SPOOFING_TIME_SEC && distKm > SPOOFING_DISTANCE_KM) {
            // SPOOFING ALERT: impossible jump
            spoofing = true;
            score = 10; // Cap at low value if spoofing suspected
        } else if (distKm < 0.01 && asset.speed > 50) {
            // Stationary but claims high speed — suspicious
            score += 10;
        } else {
            score += 30;
        }
    } else {
        score += 20; // No previous data to compare — neutral
    }

    return { 
        confidence: Math.min(100, Math.max(0, score)), 
        spoofing 
    };
}
