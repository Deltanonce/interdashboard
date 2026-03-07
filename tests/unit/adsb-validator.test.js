import { describe, test, expect } from '@jest/globals';
import { validateFlightData } from '../../asset-tracker/adsb-validator.js';

describe('ADS-B Validator', () => {
  test('should pass validation for normal flight', () => {
    const flight = {
      hex: 'ABC123',
      altitude: 35000,
      speed: 450,
      lat: 0,
      lon: 0,
      _timestamp: Date.now()
    };
    
    const result = validateFlightData(flight);
    
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
    expect(result.severity).toBe('ok');
  });
  
  test('should fail validation for excessive altitude', () => {
    const flight = {
      hex: 'ABC123',
      altitude: 70000, // Above ceiling
      speed: 450,
      lat: 0,
      lon: 0,
      _timestamp: Date.now()
    };
    
    const result = validateFlightData(flight);
    
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].type).toBe('altitude_unrealistic');
    expect(result.severity).toBe('error');
  });
  
  test('should detect coordinate jumps', () => {
    const previousData = {
      lat: 0,
      lon: 0,
      _timestamp: Date.now() - 15000 // 15 seconds ago
    };
    
    const flight = {
      hex: 'ABC123',
      altitude: 35000,
      speed: 450,
      lat: 10, // Huge jump
      lon: 10,
      _timestamp: Date.now()
    };
    
    const result = validateFlightData(flight, previousData);
    
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.type === 'coordinate_jump')).toBe(true);
  });
  
  test('should warn on emergency squawk codes', () => {
    const flight = {
      hex: 'ABC123',
      altitude: 35000,
      speed: 450,
      lat: 0,
      lon: 0,
      squawk: '7700', // Emergency
      _timestamp: Date.now()
    };
    
    const result = validateFlightData(flight);
    
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].type).toBe('emergency_squawk');
    expect(result.severity).toBe('warning');
  });
});
