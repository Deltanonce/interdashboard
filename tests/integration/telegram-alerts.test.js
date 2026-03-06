import { describe, test, expect, beforeAll } from '@jest/globals';
import { sendTelegramMessage, sendPriorityTargetAlert } from '../../telegram-alerts.js';

describe('Telegram Integration', () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.TELEGRAM_BOT_TOKEN = 'test_token';
    process.env.TELEGRAM_CHAT_ID = 'test_chat';
    process.env.ENABLE_TELEGRAM = 'false'; // Disable for testing
  });
  
  test('should handle disabled telegram gracefully', async () => {
    const result = await sendTelegramMessage('Test message');
    
    expect(result.success).toBe(false);
    expect(result.reason).toBe('disabled_or_unconfigured');
  });
  
  test('should format priority target alert correctly', async () => {
    const asset = {
      id: 'TEST123',
      callsign: 'TEST01',
      aircraftType: 'KC-135',
      hex: 'ABC123',
      lat: 1.234,
      lon: 103.456,
      altitude: 35000,
      speed: 450,
      heading: 180,
      squawk: '1234'
    };
    
    // This will not send but should not throw errors
    const result = await sendPriorityTargetAlert(asset);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });
});
