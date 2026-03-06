import { jest, describe, test, expect } from '@jest/globals';
import { calculateInterceptPath, calculateInterceptPoint } from '../../asset-tracker/prediction-engine.js';

describe('Prediction Engine', () => {
  describe('calculateInterceptPath', () => {
    test('should calculate path for valid aircraft data', () => {
      const asset = {
        id: 'test-1',
        lat: 0,
        lon: 0,
        altitude: 30000,
        speed: 400, // knots
        heading: 90 // east
      };
      
      const path = calculateInterceptPath(asset, 15);
      
      expect(path).toBeTruthy();
      expect(path.length).toBe(16); // 0 + 15 points
      expect(path[0].time).toBe(0);
      expect(path[15].time).toBe(15);
      
      // Check that longitude increases (heading east)
      expect(path[15].lon).toBeGreaterThan(path[0].lon);
    });
    
    test('should return null for insufficient data', () => {
      const asset = {
        id: 'test-2',
        lat: 0,
        lon: 0
        // missing speed and heading
      };
      
      const path = calculateInterceptPath(asset, 15);
      expect(path).toBeNull();
    });
    
    test('should calculate correct distance for known speed/time', () => {
      const asset = {
        id: 'test-3',
        lat: 0,
        lon: 0,
        altitude: 35000,
        speed: 480, // knots = 8 nautical miles per minute
        heading: 0 // north
      };
      
      const path = calculateInterceptPath(asset, 10);
      
      // After 10 minutes at 480 knots, should travel ~80 nautical miles north
      // 1 degree latitude ≈ 60 nautical miles
      // So expect ~1.33 degrees latitude change
      expect(path[10].lat).toBeGreaterThan(1.0);
      expect(path[10].lat).toBeLessThan(1.5);
    });
    
    test('should decrease confidence over time', () => {
      const asset = {
        id: 'test-5',
        lat: 0,
        lon: 0,
        altitude: 30000,
        speed: 400,
        heading: 45
      };
      
      const path = calculateInterceptPath(asset, 15);
      
      // First point should have higher confidence than last
      expect(path[0].confidence).toBeGreaterThan(path[15].confidence);
      
      // Confidence should decrease monotonically
      for (let i = 0; i < path.length - 1; i++) {
        expect(path[i].confidence).toBeGreaterThanOrEqual(path[i + 1].confidence);
      }
    });
  });
  
  describe('calculateInterceptPoint', () => {
    test('should return no intercept for parallel paths', () => {
      const asset1 = {
        id: 'a1',
        lat: 0,
        lon: 0,
        altitude: 30000,
        speed: 400,
        heading: 90 // east
      };
      
      const asset2 = {
        id: 'a2',
        lat: 1,
        lon: 0,
        altitude: 30000,
        speed: 400,
        heading: 90 // east (parallel)
      };
      
      const result = calculateInterceptPoint(asset1, asset2, 30);
      
      expect(result.willIntercept).toBe(false);
    });
  });
});
