/**
 * Market data operations manager
 */

import type {
  Logger,
  Candle,
  CandleOptions,
  RealtimePrice,
  MarketSentiment,
  TradingSignal,
  Unsubscribe,
  CandleCallback,
  PriceCallback,
  SentimentCallback,
} from '../../types';
import { WebSocketManager } from '../../core/websocket/WebSocketManager';
import { getTimestamp } from '../../utils/time';

export class MarketDataManager {
  private candleStreams = new Map<string, Candle[]>();
  private priceStreams = new Map<string, RealtimePrice[]>();
  private sentimentData = new Map<string, MarketSentiment>();
  private signalData = new Map<string, TradingSignal[]>();
  private subscriptions = new Map<string, Set<(...args: any[]) => void>>();

  constructor(
    private readonly ws: WebSocketManager,
    private readonly logger: Logger
  ) {
    this.setupMarketDataHandlers();
  }

  /**
   * Get historical candles
   */
  async getCandles(options: CandleOptions): Promise<Candle[]> {
    const { asset, endTime = getTimestamp(), offset, period } = options;

    this.logger.debug(`Fetching candles for ${asset}, period: ${period}`);

    // Request candles through WebSocket (matches Python SDK)
    const payload = {
      asset,
      index: getTimestamp(),
      time: endTime,
      offset,
      period,
    };

    const message = `42["history/load",${JSON.stringify(payload)}]`;
    this.ws.send(message);

    // Wait for candles data
    return this.waitForCandles(asset, period, 5000);
  }

  /**
   * Get history line data (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's get_history_line function
   * 
   * @param assetId - Asset ID (not symbol)
   * @param endTime - End time for history
   * @param offset - Offset in seconds
   */
  async getHistoryLine(assetId: string, endTime?: number, offset: number = 3600): Promise<any> {
    const endFromTime = endTime || getTimestamp();
    const index = getTimestamp();

    this.logger.debug(`Fetching history line for asset ID ${assetId}`);

    const payload = {
      id: assetId,
      index,
      time: endFromTime,
      offset,
    };

    const message = `42["history/load/line",${JSON.stringify(payload)}]`;
    this.ws.send(message);

    // Wait for history line data
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return empty for now - needs WebSocket handler implementation
    return {};
  }

  /**
   * Get realtime candles for an asset
   */
  async getRealtimeCandles(asset: string): Promise<Candle[]> {
    const candles = this.candleStreams.get(asset);
    return candles ? [...candles] : [];
  }

  /**
   * Get realtime price for an asset
   */
  async getRealtimePrice(asset: string): Promise<RealtimePrice[]> {
    const prices = this.priceStreams.get(asset);
    return prices ? [...prices] : [];
  }

  /**
   * Get realtime sentiment for an asset
   */
  async getRealtimeSentiment(asset: string): Promise<MarketSentiment | null> {
    return this.sentimentData.get(asset) || null;
  }

  /**
   * Get trading signals
   */
  getSignalData(): TradingSignal[] {
    const allSignals: TradingSignal[] = [];
    for (const signals of this.signalData.values()) {
      allSignals.push(...signals);
    }
    return allSignals;
  }

  /**
   * Subscribe to candle stream
   */
  subscribeToCandleStream(
    asset: string,
    period: number,
    callback: CandleCallback
  ): Unsubscribe {
    this.logger.debug(`Subscribing to candle stream: ${asset}, period: ${period}`);

    // Subscribe through WebSocket
    const payload = { asset, period };
    const message = `42["instruments/update",${JSON.stringify(payload)}]`;
    this.ws.send(message);

    // Follow candle (Python SDK passes asset as string directly, not in object)
    const followMessage = `42["depth/follow","${asset}"]`;
    this.ws.send(followMessage);

    // Store callback
    const key = `candles:${asset}:${period}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(key)?.delete(callback);
      if (this.subscriptions.get(key)?.size === 0) {
        this.unsubscribeFromCandleStream(asset);
      }
    };
  }

  /**
   * Subscribe to price stream
   */
  subscribeToPriceStream(asset: string, period: number, callback: PriceCallback): Unsubscribe {
    this.subscribeToCandleStream(asset, period, (candle) => {
      const price: RealtimePrice = {
        asset,
        price: candle.close,
        time: candle.time,
      };
      callback(price);
    });

    const key = `prices:${asset}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  /**
   * Subscribe to sentiment stream
   */
  subscribeToSentimentStream(
    asset: string,
    callback: SentimentCallback
  ): Unsubscribe {
    this.subscribeToCandleStream(asset, 0, () => {
      const sentiment = this.sentimentData.get(asset);
      if (sentiment) {
        callback(sentiment);
      }
    });

    const key = `sentiment:${asset}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  /**
   * Start signal data stream
   */
  startSignalsData(): void {
    // Correct format from Python SDK
    const message = '42["signal/subscribe"]';
    this.ws.send(message);
  }

  /**
   * Get opening/closing info for current candle (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's opening_closing_current_candle function
   */
  async openingClosingCurrentCandle(asset: string, period: number = 0): Promise<{
    symbol: string;
    open: number;
    close: number;
    high: number;
    low: number;
    timestamp: number;
    opening: number;
    closing: number;
    remaining: number;
  } | null> {
    const candleTick = await this.getRealtimeCandles(asset);
    
    if (!candleTick || candleTick.length === 0) {
      return null;
    }

    // Aggregate candle data
    const candlesData: Record<number, any> = {};
    for (const candle of candleTick) {
      const timestamp = candle.time;
      if (!candlesData[timestamp]) {
        candlesData[timestamp] = {
          symbol: asset,
          open: candle.open,
          close: candle.close,
          high: candle.high,
          low: candle.low,
          timestamp,
        };
      } else {
        candlesData[timestamp].close = candle.close;
        candlesData[timestamp].high = Math.max(candlesData[timestamp].high, candle.high);
        candlesData[timestamp].low = Math.min(candlesData[timestamp].low, candle.low);
      }
    }

    // Get the most recent candle
    const timestamps = Object.keys(candlesData).map(Number).sort((a, b) => b - a);
    if (timestamps.length === 0) {
      return null;
    }

    const latestTimestamp = timestamps[0]!;
    const candleDict = candlesData[latestTimestamp];

    // Calculate opening, closing, and remaining time
    const opening = candleDict.timestamp;
    const closing = opening + period;
    const remaining = closing - Math.floor(Date.now() / 1000);

    return {
      symbol: candleDict.symbol,
      open: candleDict.open,
      close: candleDict.close,
      high: candleDict.high,
      low: candleDict.low,
      timestamp: candleDict.timestamp,
      opening,
      closing,
      remaining,
    };
  }

  /**
   * Unsubscribe from candle stream
   */
  private unsubscribeFromCandleStream(asset: string): void {
    this.logger.debug(`Unsubscribing from candle stream: ${asset}`);
    // Python SDK passes asset as string directly
    const message = `42["depth/unfollow","${asset}"]`;
    this.ws.send(message);
  }

  /**
   * Store and apply trading settings (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's store_settings_apply function
   * 
   * @param asset - Asset symbol
   * @param period - Trading period in seconds
   * @param timeMode - "TIMER" or "TIME" mode
   * @param deal - Deal amount
   * @param percentMode - Whether to use percentage mode
   * @param percentDeal - Percentage value if percentMode is true
   */
  async storeSettingsApply(
    asset: string = 'EURUSD',
    period: number = 0,
    timeMode: string = 'TIMER',
    deal: number = 5,
    percentMode: boolean = false,
    percentDeal: number = 1
  ): Promise<any> {
    const isFastOption = timeMode.toUpperCase() !== 'TIMER';
    
    // Get current timestamp for expiration
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = isFastOption ? currentTime : currentTime;

    // Apply settings (matches Python SDK format)
    const settingsPayload = {
      chartId: 'graph',
      settings: {
        chartId: 'graph',
        chartType: 2,
        currentExpirationTime: expirationTime,
        isFastOption,
        isFastAmountOption: percentMode,
        isIndicatorsMinimized: false,
        isIndicatorsShowing: true,
        isShortBetElement: false,
        chartPeriod: 4,
        currentAsset: { symbol: asset },
        dealValue: deal,
        dealPercentValue: percentDeal,
        isVisible: true,
        timePeriod: period,
        gridOpacity: 8,
        isAutoScrolling: 1,
        isOneClickTrade: true,
        upColor: '#0FAF59',
        downColor: '#FF6251',
      },
    };

    const message = `42["settings/store",${JSON.stringify(settingsPayload)}]`;
    this.ws.send(message);

    // Wait for settings to be applied
    await new Promise(resolve => setTimeout(resolve, 200));

    // In Python SDK, this would refresh settings and return investment settings
    // For now, return the payload as confirmation
    return settingsPayload.settings;
  }

  /**
   * Setup WebSocket handlers for market data
   */
  private setupMarketDataHandlers(): void {
    // Candle updates
    this.ws.subscribe('candles', (data) => {
      this.handleCandleUpdate(data);
    });

    // Price updates
    this.ws.subscribe('price', (data) => {
      this.handlePriceUpdate(data);
    });

    // Sentiment updates
    this.ws.subscribe('sentiment', (data) => {
      this.handleSentimentUpdate(data);
    });

    // Signal updates
    this.ws.subscribe('signals', (data) => {
      this.handleSignalUpdate(data);
    });

    // Instruments update (includes candles)
    this.ws.subscribe('instruments/update', (data) => {
      this.handleCandleUpdate(data);
    });
  }

  /**
   * Handle candle update
   */
  private handleCandleUpdate(data: any): void {
    if (!data || !data.asset) return;

    try {
      const candle: Candle = {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        time: data.time || data.timestamp,
        volume: data.volume,
      };

      const asset = data.asset;
      if (!this.candleStreams.has(asset)) {
        this.candleStreams.set(asset, []);
      }

      const candles = this.candleStreams.get(asset)!;
      candles.push(candle);

      // Keep only last 1000 candles
      if (candles.length > 1000) {
        candles.shift();
      }

      // Notify subscribers
      const key = `candles:${asset}:${data.period || 0}`;
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        for (const callback of callbacks) {
          callback(candle);
        }
      }
    } catch (error) {
      this.logger.error('Error handling candle update:', error);
    }
  }

  /**
   * Handle price update
   */
  private handlePriceUpdate(data: any): void {
    if (!data || !data.asset) return;

    const price: RealtimePrice = {
      asset: data.asset,
      price: data.price,
      time: data.time || getTimestamp(),
    };

    if (!this.priceStreams.has(data.asset)) {
      this.priceStreams.set(data.asset, []);
    }

    const prices = this.priceStreams.get(data.asset)!;
    prices.push(price);

    // Keep only last 100 prices
    if (prices.length > 100) {
      prices.shift();
    }

    // Notify subscribers
    const key = `prices:${data.asset}`;
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(price);
      }
    }
  }

  /**
   * Handle sentiment update
   */
  private handleSentimentUpdate(data: any): void {
    if (!data || !data.asset) return;

    const sentiment: MarketSentiment = {
      asset: data.asset,
      sentiment: {
        buy: data.buy || data.sentiment?.buy || 0,
        sell: data.sell || data.sentiment?.sell || 0,
      },
      timestamp: getTimestamp(),
    };

    this.sentimentData.set(data.asset, sentiment);

    // Notify subscribers
    const key = `sentiment:${data.asset}`;
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(sentiment);
      }
    }
  }

  /**
   * Handle signal update
   */
  private handleSignalUpdate(data: any): void {
    if (!data || !data.asset) return;

    const signal: TradingSignal = {
      asset: data.asset,
      direction: data.direction,
      strength: data.strength || 0,
      timestamp: getTimestamp(),
      timeframe: data.timeframe || 60,
    };

    if (!this.signalData.has(data.asset)) {
      this.signalData.set(data.asset, []);
    }

    const signals = this.signalData.get(data.asset)!;
    signals.push(signal);

    // Keep only last 10 signals per asset
    if (signals.length > 10) {
      signals.shift();
    }
  }

  /**
   * Wait for candles data
   */
  private async waitForCandles(asset: string, period: number, timeout: number): Promise<Candle[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const candles = this.candleStreams.get(asset);
      if (candles && candles.length > 0) {
        return [...candles];
      }
      await Bun.sleep(100);
    }

    return [];
  }
}

