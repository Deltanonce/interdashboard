import { describe, test, expect } from '@jest/globals';
import { classifyVessel, assessThreatLevel } from '../../asset-tracker/ais-classifier.js';

describe('AIS Classifier', () => {
  test('should classify military vessel correctly', () => {
    const result = classifyVessel(35);
    
    expect(result.category).toBe('MILITARY');
    expect(result.threatLevel).toBe('high');
    expect(result.typeCode).toBe(35);
  });
  
  test('should classify tanker correctly', () => {
    const result = classifyVessel(80);
    
    expect(result.category).toBe('TANKER');
    expect(result.threatLevel).toBe('medium');
  });
  
  test('should classify cargo vessel correctly', () => {
    const result = classifyVessel(70);
    
    expect(result.category).toBe('CARGO');
    expect(result.threatLevel).toBe('low');
  });
  
  test('should handle unknown vessel types', () => {
    const result = classifyVessel(null);
    
    expect(result.category).toBe('UNKNOWN');
    expect(result.threatLevel).toBe('low');
  });
  
  test('should assess elevated threat for high-speed vessels in restricted zones', () => {
    const vessel = {
      vesselType: 80, // Tanker
      speed: 30, // High speed
      lat: 26.5, // Strait of Hormuz
      lon: 56.0,
      mmsi: '123456789'
    };
    
    const result = assessThreatLevel(vessel);
    
    // Tanker is medium, +1 for speed/zone = high
    expect(result.finalThreatLevel).toBe('high');
    expect(result.threatReasons).toContain('High speed maneuvering in restricted chokepoint');
  });
});
