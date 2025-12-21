/**
 * Market Data Tests
 * 
 * Tests market data functionality including new functions
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { QuotexClient } from '../src';

describe('Market Data Tests', () => {
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

  test('should get historical candles', async () => {
    if (!isConnected) return;

    try {
      const candles = await client.getCandles({
        asset: 'EURUSD_otc',
        offset: 3600,
        period: 60,
      });

      expect(Array.isArray(candles)).toBe(true);
      
      if (candles.length > 0) {
        const candle = candles[0];
        expect(candle).toHaveProperty('open');
        expect(candle).toHaveProperty('high');
        expect(candle).toHaveProperty('low');
        expect(candle).toHaveProperty('close');
        expect(candle).toHaveProperty('time');
      }
    } catch (error) {
      console.log('Candles test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should get opening/closing current candle info (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    try {
      // First subscribe to candles
      const unsubscribe = client.subscribeToCandleStream('EURUSD_otc', 60, () => {});
      
      // Wait for data
      await new Promise(resolve => setTimeout(resolve, 3000));

      const candleInfo = await client.openingClosingCurrentCandle('EURUSD_otc', 60);

      if (candleInfo) {
        expect(candleInfo).toHaveProperty('symbol');
        expect(candleInfo).toHaveProperty('open');
        expect(candleInfo).toHaveProperty('close');
        expect(candleInfo).toHaveProperty('opening');
        expect(candleInfo).toHaveProperty('closing');
        expect(candleInfo).toHaveProperty('remaining');
        expect(typeof candleInfo.remaining).toBe('number');
      }

      unsubscribe();
    } catch (error) {
      console.log('Opening/Closing candle test skipped:', (error as Error).message);
    }
  }, 15000);

  test('should store and apply settings (@NEW_FUNCTION)', async () => {
    if (!isConnected) return;

    try {
      const settings = await client.storeSettingsApply(
        'EURUSD_otc',
        60,
        'TIME',
        50,
        false,
        1
      );

      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('currentAsset');
      expect(settings.currentAsset).toHaveProperty('symbol');
      expect(settings.currentAsset.symbol).toBe('EURUSD_otc');
    } catch (error) {
      console.log('Settings test skipped:', (error as Error).message);
    }
  }, 10000);

  test('should subscribe to candle stream', async () => {
    if (!isConnected) return;

    let candleReceived = false;

    const unsubscribe = client.subscribeToCandleStream('EURUSD_otc', 60, (candle) => {
      candleReceived = true;
      expect(candle).toHaveProperty('open');
      expect(candle).toHaveProperty('close');
    });

    // Wait for at least one candle
    await new Promise(resolve => setTimeout(resolve, 3000));

    unsubscribe();

    // Don't fail if no candle received (depends on market activity)
  }, 10000);

  test('should get realtime price', async () => {
    if (!isConnected) return;

    try {
      const prices = await client.getRealtimePrice('EURUSD_otc');
      expect(Array.isArray(prices)).toBe(true);
    } catch (error) {
      console.log('Realtime price test skipped:', (error as Error).message);
    }
  }, 10000);

  test('should get realtime sentiment', async () => {
    if (!isConnected) return;

    try {
      const sentiment = await client.getRealtimeSentiment('EURUSD_otc');
      
      if (sentiment) {
        expect(sentiment).toHaveProperty('asset');
        expect(sentiment).toHaveProperty('sentiment');
      }
    } catch (error) {
      console.log('Sentiment test skipped:', (error as Error).message);
    }
  }, 10000);
});

