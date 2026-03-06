/**
 * @file input-validator.js
 * @description Input sanitization and validation for strategic telemetry.
 */

class InputValidator {
  static sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') return '';
    
    // Remove potentially dangerous characters
    let sanitized = input
      .replace(/[<>\"']/g, '') // Remove HTML/script chars
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }
  
  static validateCoordinates(lat, lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return { valid: false, error: 'Invalid coordinate format' };
    }
    
    if (latitude < -90 || latitude > 90) {
      return { valid: false, error: 'Latitude out of range' };
    }
    
    if (longitude < -180 || longitude > 180) {
      return { valid: false, error: 'Longitude out of range' };
    }
    
    return { valid: true, lat: latitude, lon: longitude };
  }
  
  static validateAltitude(altitude) {
    const alt = parseInt(altitude);
    
    if (isNaN(alt)) {
      return { valid: false, error: 'Invalid altitude format' };
    }
    
    if (alt < -1000 || alt > 100000) {
      return { valid: false, error: 'Altitude out of reasonable range' };
    }
    
    return { valid: true, altitude: alt };
  }
  
  static validateSpeed(speed) {
    const spd = parseFloat(speed);
    
    if (isNaN(spd)) {
      return { valid: false, error: 'Invalid speed format' };
    }
    
    if (spd < 0 || spd > 3000) {
      return { valid: false, error: 'Speed out of range' };
    }
    
    return { valid: true, speed: spd };
  }
  
  static validateHexCode(hex) {
    if (typeof hex !== 'string') {
      return { valid: false, error: 'Hex must be string' };
    }
    
    // Hex code should be 6 characters, alphanumeric
    const hexPattern = /^[A-Fa-f0-9]{6}$/;
    
    if (!hexPattern.test(hex)) {
      return { valid: false, error: 'Invalid hex format' };
    }
    
    return { valid: true, hex: hex.toUpperCase() };
  }
  
  static sanitizeFlightData(data) {
    const sanitized = {};
    
    // Validate coordinates
    const coords = this.validateCoordinates(data.lat, data.lon);
    if (!coords.valid) {
      throw new Error(coords.error);
    }
    sanitized.lat = coords.lat;
    sanitized.lon = coords.lon;
    
    // Validate altitude
    if (data.altitude !== undefined) {
      const alt = this.validateAltitude(data.altitude);
      if (alt.valid) {
        sanitized.altitude = alt.altitude;
      }
    }
    
    // Validate speed
    if (data.speed !== undefined) {
      const spd = this.validateSpeed(data.speed);
      if (spd.valid) {
        sanitized.speed = spd.speed;
      }
    }
    
    // Sanitize string fields
    if (data.callsign) {
      sanitized.callsign = this.sanitizeString(data.callsign, 10);
    }
    
    if (data.hex) {
      const hex = this.validateHexCode(data.hex);
      if (hex.valid) {
        sanitized.hex = hex.hex;
      }
    }
    
    return sanitized;
  }
}

module.exports = InputValidator;
