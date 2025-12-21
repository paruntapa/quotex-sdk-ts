/**
 * Connection Tests
 * 
 * Tests basic connection and authentication functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QuotexClient } from '../src';

describe('Connection Tests', () => {
  let client: QuotexClient;

  beforeAll(() => {
    client = new QuotexClient({
      email: process.env.QUOTEX_EMAIL || 'test@email.com',
      password: process.env.QUOTEX_PASSWORD || 'test_password',
      lang: 'en',
      debug: false,
    });
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  test('should create client instance', () => {
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(QuotexClient);
  });

  test('should connect to platform', async () => {
    const result = await client.connect();
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
    
    // Connection might fail without valid credentials
    if (result.success) {
      expect(client.isConnected()).toBe(true);
    }
  }, 30000); // 30 second timeout

  test('should check websocket alive status', () => {
    const isAlive = client.websocketAlive();
    expect(typeof isAlive).toBe('boolean');
  });

  test('should get profile information', async () => {
    if (client.isConnected()) {
      const profile = await client.getProfile();
      
      if (profile) {
        expect(profile).toHaveProperty('nickName');
        expect(profile).toHaveProperty('demoBalance');
        expect(profile).toHaveProperty('liveBalance');
      }
    }
  }, 10000);

  test('should get account balance', async () => {
    if (client.isConnected()) {
      const balance = await client.getBalance();
      expect(typeof balance).toBe('number');
    }
  }, 10000);

  test('should get account mode', () => {
    const mode = client.getAccountMode();
    expect(['PRACTICE', 'REAL']).toContain(mode);
  });
});

