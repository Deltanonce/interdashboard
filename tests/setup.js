// Global test setup for Jest
import { jest } from '@jest/globals';

// Mock fetch for API calls
global.fetch = jest.fn();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_TELEGRAM = 'false';
process.env.ENABLE_AIS = 'false';
process.env.CESIUM_ACCESS_TOKEN = 'test_token';
