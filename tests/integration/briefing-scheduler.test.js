import { describe, test, expect, beforeAll } from '@jest/globals';
import BriefingScheduler from '../../briefing-scheduler.js';
import fs from 'fs';
import path from 'path';

describe('Briefing Scheduler Integration', () => {
  let scheduler;
  let buffer;
  
  beforeAll(() => {
    buffer = new Map();
    // Add sample data to buffer
    buffer.set('AE123F', {
      hex: 'AE123F',
      callsign: 'RCH123',
      type: 'KC-135',
      priority: true,
      history: [
        { lat: 25.0, lon: 45.0, alt: 28000, spd: 420, ts: Date.now() }
      ]
    });
    
    scheduler = new BriefingScheduler(buffer);
  });
  
  test('should analyze assets correctly', () => {
    const assets = Array.from(buffer.values());
    const analysis = scheduler.analyzeAssets(assets);
    
    expect(analysis.totalAssets).toBe(1);
    expect(analysis.priorityCount).toBe(1);
    expect(analysis.threatLevel).toBeDefined();
  });
  
  test('should generate markdown report content', async () => {
    const result = await scheduler.generateBriefing();
    
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^briefing_/);
    expect(fs.existsSync(result.filepath)).toBe(true);
    
    const content = fs.readFileSync(result.filepath, 'utf8');
    expect(content).toContain('SENTINEL OMEGA');
    expect(content).toContain('RCH123');
    
    // Cleanup
    fs.unlinkSync(result.filepath);
  });
});
