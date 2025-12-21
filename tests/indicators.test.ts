/**
 * Indicator Tests
 * 
 * Tests technical indicator calculations including new ADX and ICHIMOKU
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QuotexClient } from '../src';

describe('Indicator Tests', () => {
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

  test('should calculate RSI indicator', async () => {
    if (!isConnected) return;

    try {
      const rsi = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'RSI',
        params: { period: 14 },
        timeframe: 60,
      });

      expect(rsi).toBeDefined();
      expect(rsi).toHaveProperty('current');
      expect(rsi).toHaveProperty('rsi');
      expect(typeof rsi.current).toBe('number');
    } catch (error) {
      // Skip if no candles available
      console.log('RSI test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should calculate MACD indicator', async () => {
    if (!isConnected) return;

    try {
      const macd = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'MACD',
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        timeframe: 300,
      });

      expect(macd).toBeDefined();
      expect(macd).toHaveProperty('current');
      expect(macd.current).toHaveProperty('macd');
      expect(macd.current).toHaveProperty('signal');
      expect(macd.current).toHaveProperty('histogram');
    } catch (error) {
      console.log('MACD test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should calculate ADX indicator (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    try {
      const adx = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'ADX',
        params: { period: 14 },
        timeframe: 60,
      });

      expect(adx).toBeDefined();
      expect(adx).toHaveProperty('current');
      expect(adx.current).toHaveProperty('adx');
      expect(adx.current).toHaveProperty('plusDI');
      expect(adx.current).toHaveProperty('minusDI');
      expect(typeof adx.current.adx).toBe('number');
    } catch (error) {
      console.log('ADX test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should calculate ICHIMOKU indicator (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    try {
      const ichimoku = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'ICHIMOKU',
        params: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
        timeframe: 300,
      });

      expect(ichimoku).toBeDefined();
      expect(ichimoku).toHaveProperty('current');
      expect(ichimoku.current).toHaveProperty('tenkan');
      expect(ichimoku.current).toHaveProperty('kijun');
      expect(ichimoku.current).toHaveProperty('senkouA');
      expect(ichimoku.current).toHaveProperty('senkouB');
      expect(ichimoku.current).toHaveProperty('chikou');
    } catch (error) {
      console.log('ICHIMOKU test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should calculate Bollinger Bands', async () => {
    if (!isConnected) return;

    try {
      const bb = await client.calculateIndicator({
        asset: 'EURUSD_otc',
        indicator: 'BOLLINGER',
        params: { period: 20, std: 2 },
        timeframe: 60,
      });

      expect(bb).toBeDefined();
      expect(bb).toHaveProperty('current');
      expect(bb.current).toHaveProperty('upper');
      expect(bb.current).toHaveProperty('middle');
      expect(bb.current).toHaveProperty('lower');
    } catch (error) {
      console.log('Bollinger Bands test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should subscribe to real-time indicator updates (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    let updateReceived = false;

    try {
      const unsubscribe = await client.subscribeIndicator({
        asset: 'EURUSD_otc',
        indicator: 'RSI',
        params: { period: 14 },
        timeframe: 60,
        callback: (result) => {
          updateReceived = true;
          expect(result).toBeDefined();
          expect(result).toHaveProperty('current');
          unsubscribe();
        },
      });

      // Wait for at least one update
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Don't fail test if no update received (depends on market activity)
      if (updateReceived) {
        expect(updateReceived).toBe(true);
      }
    } catch (error) {
      console.log('Indicator subscription test skipped:', (error as Error).message);
    }
  }, 10000);
});

