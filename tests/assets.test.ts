/**
 * Asset Management Tests
 * 
 * Tests asset-related functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QuotexClient } from '../src';

describe('Asset Management Tests', () => {
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

  test('should get all instruments', async () => {
    if (!isConnected) return;

    const instruments = await client.getInstruments();
    
    expect(Array.isArray(instruments)).toBe(true);
    
    if (instruments.length > 0) {
      const firstInstrument = instruments[0];
      expect(firstInstrument).toHaveProperty('id');
      expect(firstInstrument).toHaveProperty('symbol');
      expect(firstInstrument).toHaveProperty('name');
    }
  }, 10000);

  test('should get all asset names', async () => {
    if (!isConnected) return;

    const assetNames = await client.getAllAssetNames();
    
    expect(Array.isArray(assetNames)).toBe(true);
    expect(assetNames.length).toBeGreaterThan(0);
  }, 10000);

  test('should check if asset is open', async () => {
    if (!isConnected) return;

    const assetInfo = await client.checkAssetOpen('EURUSD_otc');
    
    if (assetInfo) {
      expect(assetInfo).toHaveProperty('name');
      expect(assetInfo).toHaveProperty('isOpen');
      expect(assetInfo).toHaveProperty('payout');
    }
  }, 10000);

  test('should get payout info for asset', async () => {
    if (!isConnected) return;

    // Wait for instruments to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const payoutInfo = client.getPayoutInfo('EURUSD_otc');
    
    if (payoutInfo) {
      expect(payoutInfo).toHaveProperty('asset');
      expect(payoutInfo).toHaveProperty('payout');
      expect(typeof payoutInfo.payout).toBe('number');
    }
  }, 10000);

  test('should get all payouts', async () => {
    if (!isConnected) return;

    // Wait for instruments to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const payouts = client.getAllPayouts();
    
    expect(payouts).toBeInstanceOf(Map);
  }, 10000);

  test('should search assets', async () => {
    if (!isConnected) return;

    const results = await client.searchAssets('EUR');
    
    expect(Array.isArray(results)).toBe(true);
    
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('name');
      expect(results[0].name).toContain('EUR');
    }
  }, 10000);

  test('should get open assets', async () => {
    if (!isConnected) return;

    const openAssets = await client.getOpenAssets();
    
    expect(Array.isArray(openAssets)).toBe(true);
    
    if (openAssets.length > 0) {
      expect(openAssets[0]).toHaveProperty('isOpen');
      expect(openAssets[0].isOpen).toBe(true);
    }
  }, 10000);
});

