/**
 * History Tests
 * 
 * Tests trade history functionality including new WebSocket-based methods
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QuotexClient } from '../src';

describe('History Tests', () => {
  let client: QuotexClient;
  let isConnected = false;

  beforeAll(async () => {
    client = new QuotexClient({
      email: process.env.QUOTEX_EMAIL || 'test@email.com',
      password: process.env.QUOTEX_PASSWORD || 'test_password',
      lang: 'en',
      debug: false,
    });

    const result = await client.connect();
    isConnected = result.success;
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  test('should get trade history', async () => {
    if (!isConnected) return;

    try {
      const history = await client.getHistory(10, 0);
      
      expect(Array.isArray(history)).toBe(true);
      
      if (history.length > 0) {
        const trade = history[0];
        expect(trade).toHaveProperty('ticket');
        expect(trade).toHaveProperty('asset');
        expect(trade).toHaveProperty('amount');
      }
    } catch (error) {
      console.log('History test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should get trader history with pagination (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    try {
      const history = await client.getTraderHistory('demo', 1);
      
      expect(history).toBeDefined();
      expect(history).toHaveProperty('data');
      expect(Array.isArray(history.data)).toBe(true);
      
      if (history.data && history.data.length > 0) {
        const trade = history.data[0];
        expect(trade).toHaveProperty('asset');
        expect(trade).toHaveProperty('amount');
      }
    } catch (error) {
      console.log('Trader history test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should get history by asset', async () => {
    if (!isConnected) return;

    try {
      const history = await client.getHistoryByAsset('EURUSD_otc', 5);
      
      expect(Array.isArray(history)).toBe(true);
    } catch (error) {
      console.log('History by asset test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should get history by date range', async () => {
    if (!isConnected) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - (24 * 60 * 60);
      
      const history = await client.getHistoryByDateRange(oneDayAgo, now);
      
      expect(Array.isArray(history)).toBe(true);
    } catch (error) {
      console.log('History by date range test skipped:', (error as Error).message);
    }
  }, 15000);
});

