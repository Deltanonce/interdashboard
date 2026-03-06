import { describe, test, expect } from '@jest/globals';
import { computeConfidence } from '../../asset-tracker/confidence-engine.js';

describe('Confidence Engine', () => {
  test('should return high confidence for fresh data from reliable source', () => {
    const asset = {
      source: 'adsb_icao',
      _seenSec: 2,
      lat: 0,
      lon: 0,
      speed: 400
    };
    
    const result = computeConfidence(asset, null);
    
    expect(result.confidence).toBeGreaterThan(60);
    expect(result.spoofing).toBe(false);
  });
  
  test('should detect spoofing for impossible jumps', () => {
    const prevAsset = {
      lat: 0,
      lon: 0,
      _timestamp: Date.now() - 10000 // 10s ago
    };
    
    const asset = {
      lat: 5, // ~550km jump in 10s
      lon: 5,
      _timestamp: Date.now(),
      _seenSec: 1,
      source: 'adsb_icao'
    };
    
    const result = computeConfidence(asset, prevAsset);
    
    expect(result.spoofing).toBe(true);
    expect(result.confidence).toBeLessThan(20);
  });
  
  test('should penalize old data', () => {
    const asset = {
      source: 'adsb_icao',
      _seenSec: 300, // 5 minutes old
      lat: 0,
      lon: 0
    };
    
    const result = computeConfidence(asset, null);
    // score = 5 (age) + 30 (source) + 20 (no prev) = 55
    expect(result.confidence).toBeLessThan(60);
  });
});
