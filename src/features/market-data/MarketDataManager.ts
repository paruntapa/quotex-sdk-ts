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

  async getCandles(options: CandleOptions): Promise<Candle[]> {
    const { asset, endTime = getTimestamp(), offset, period } = options;

    this.logger.debug(`Fetching candles for ${asset}, period: ${period}`);

    this.candleStreams.delete(asset);

    const subPayload = { asset, period };
    this.ws.send(`42["instruments/update",${JSON.stringify(subPayload)}]`);
    this.ws.send(`42["depth/follow","${asset}"]`);

    await Bun.sleep(200);

    const payload = {
      asset,
      index: getTimestamp(),
      time: endTime,
      offset,
      period,
    };

    const message = `42["history/load",${JSON.stringify(payload)}]`;
    this.ws.send(message);

    return this.waitForCandles(asset, period, 10000);
  }

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

    await new Promise(resolve => setTimeout(resolve, 1000));

    return {};
  }

  async getRealtimeCandles(asset: string): Promise<Candle[]> {
    const candles = this.candleStreams.get(asset);
    return candles ? [...candles] : [];
  }

  async getRealtimePrice(asset: string): Promise<RealtimePrice[]> {
    const prices = this.priceStreams.get(asset);
    return prices ? [...prices] : [];
  }

  async getRealtimeSentiment(asset: string): Promise<MarketSentiment | null> {
    return this.sentimentData.get(asset) || null;
  }

  getSignalData(): TradingSignal[] {
    const allSignals: TradingSignal[] = [];
    for (const signals of this.signalData.values()) {
      allSignals.push(...signals);
    }
    return allSignals;
  }

  subscribeToCandleStream(
    asset: string,
    period: number,
    callback: CandleCallback
  ): Unsubscribe {
    this.logger.debug(`Subscribing to candle stream: ${asset}, period: ${period}`);

    const payload = { asset, period };
    const message = `42["instruments/update",${JSON.stringify(payload)}]`;
    this.ws.send(message);

    const followMessage = `42["depth/follow","${asset}"]`;
    this.ws.send(followMessage);

    const key = `candles:${asset}:${period}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
      if (this.subscriptions.get(key)?.size === 0) {
        this.unsubscribeFromCandleStream(asset);
      }
    };
  }

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

  startSignalsData(): void {
    const message = '42["signal/subscribe"]';
    this.ws.send(message);
  }

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

    const timestamps = Object.keys(candlesData).map(Number).sort((a, b) => b - a);
    if (timestamps.length === 0) {
      return null;
    }

    const latestTimestamp = timestamps[0]!;
    const candleDict = candlesData[latestTimestamp];

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

  private unsubscribeFromCandleStream(asset: string): void {
    this.logger.debug(`Unsubscribing from candle stream: ${asset}`);
    const message = `42["depth/unfollow","${asset}"]`;
    this.ws.send(message);
  }

  async storeSettingsApply(
    asset: string = 'EURUSD',
    period: number = 0,
    timeMode: string = 'TIMER',
    deal: number = 5,
    percentMode: boolean = false,
    percentDeal: number = 1
  ): Promise<any> {
    const isFastOption = timeMode.toUpperCase() !== 'TIMER';
    
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = isFastOption ? currentTime : currentTime;

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

    await new Promise(resolve => setTimeout(resolve, 200));

    return settingsPayload.settings;
  }

  private setupMarketDataHandlers(): void {
    this.ws.subscribe('candles', (data) => {
      this.handleCandleUpdate(data);
    });

    this.ws.subscribe('tick', (data) => {
      this.handleTickUpdate(data);
    });

    this.ws.subscribe('price', (data) => {
      this.handlePriceUpdate(data);
    });

    this.ws.subscribe('sentiment', (data) => {
      this.handleSentimentUpdate(data);
    });

    this.ws.subscribe('signals', (data) => {
      this.handleSignalUpdate(data);
    });

    this.ws.subscribe('instruments/update', (data) => {
      this.handleCandleUpdate(data);
    });
  }

  private handleCandleUpdate(data: any): void {
    if (!data) return;

    try {
      if (data.candles !== undefined || data.history !== undefined) {
        this.handleHistoryResponse(data);
        return;
      }

      if (!data.asset) return;

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

      if (candles.length > 1000) {
        candles.shift();
      }

      const period = data.period || 0;
      const notified = new Set<Function>();

      const exactKey = `candles:${asset}:${period}`;
      const exactCallbacks = this.subscriptions.get(exactKey);
      if (exactCallbacks) {
        for (const callback of exactCallbacks) {
          callback(candle);
          notified.add(callback);
        }
      }

      for (const [key, callbacks] of this.subscriptions.entries()) {
        if (key.startsWith(`candles:${asset}:`) && key !== exactKey) {
          for (const callback of callbacks) {
            if (!notified.has(callback)) {
              callback(candle);
              notified.add(callback);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error handling candle update:', error);
    }
  }

  private handleHistoryResponse(data: any): void {
    const asset = data.asset;
    const period = data.period;
    
    if (!asset) {
      this.logger.debug('History response missing asset');
      return;
    }

    const candlesArray = data.candles;
    const historyArray = data.history;

    if (!this.candleStreams.has(asset)) {
      this.candleStreams.set(asset, []);
    }

    const candles = this.candleStreams.get(asset)!;

    if (Array.isArray(candlesArray) && candlesArray.length > 0) {
      this.logger.info(`📊 Processing ${candlesArray.length} OHLC candles for ${asset} (period: ${period})`);

      let parsed = 0;
      for (const entry of candlesArray) {
        let candle: Candle | null = null;

        if (Array.isArray(entry) && entry.length >= 5) {
          candle = {
            time: Math.floor(entry[0]),
            open: entry[1],
            close: entry[2],
            high: entry[3],
            low: entry[4],
            volume: entry.length > 5 ? entry[5] : undefined,
          };
        } else if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
          if (entry.open !== undefined && entry.close !== undefined) {
            candle = {
              open: entry.open,
              high: entry.high,
              low: entry.low,
              close: entry.close,
              time: entry.time || entry.timestamp || entry.at,
              volume: entry.volume,
            };
          }
        }

        if (candle && candle.time && !isNaN(candle.open) && !isNaN(candle.close)) {
          candles.push(candle);
          parsed++;
        }
      }

      this.logger.info(`📊 Parsed ${parsed}/${candlesArray.length} OHLC candles for ${asset}`);
      
    } else if (Array.isArray(historyArray) && historyArray.length > 0 && period > 0) {
      this.logger.info(`📊 Aggregating ${historyArray.length} ticks into ${period}s candles for ${asset}`);
      
      const buckets = new Map<number, { open: number; high: number; low: number; close: number; time: number; count: number }>();
      
      for (const tick of historyArray) {
        if (!Array.isArray(tick) || tick.length < 2) continue;
        const timestamp = tick[0];
        const price = tick[1];
        if (typeof timestamp !== 'number' || typeof price !== 'number') continue;
        
        const bucketTime = Math.floor(timestamp / period) * period;
        
        if (!buckets.has(bucketTime)) {
          buckets.set(bucketTime, {
            time: bucketTime,
            open: price,
            high: price,
            low: price,
            close: price,
            count: 1,
          });
        } else {
          const b = buckets.get(bucketTime)!;
          b.high = Math.max(b.high, price);
          b.low = Math.min(b.low, price);
          b.close = price;
          b.count++;
        }
      }

      const aggregated = Array.from(buckets.values()).sort((a, b) => a.time - b.time);
      for (const b of aggregated) {
        candles.push({
          time: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.count,
        });
      }

      this.logger.info(`📊 Aggregated into ${aggregated.length} candles for ${asset}`);
    } else {
      this.logger.debug(`📊 No usable candle data in history response for ${asset}`);
      return;
    }

    if (candles.length > 1000) {
      const excess = candles.length - 1000;
      candles.splice(0, excess);
    }

    candles.sort((a, b) => a.time - b.time);

    this.logger.info(`📊 Candle stream for ${asset} now has ${candles.length} candles`);

    if (candles.length > 0) {
      const latestCandle = candles[candles.length - 1]!;
      const key = `candles:${asset}:${period || 0}`;
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        for (const callback of callbacks) {
          callback(latestCandle);
        }
      }
    }
  }

  private handleTickUpdate(data: any): void {
    if (!Array.isArray(data) || data.length < 2) return;

    const asset = data[0];
    if (typeof asset !== 'string') return;

    if (data.length === 2 && typeof data[1] === 'number' && data[1] === Math.floor(data[1])) {
      return;
    }

    if (data.length < 3) return;
    const timestamp = data[1];
    const price = data[2];

    if (typeof timestamp !== 'number' || typeof price !== 'number') return;

    const syntheticCandle: Candle = {
      time: timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1,
    };

    const notified = new Set<Function>();
    for (const [key, callbacks] of this.subscriptions.entries()) {
      if (key.startsWith(`candles:${asset}:`)) {
        for (const callback of callbacks) {
          if (!notified.has(callback)) {
            callback(syntheticCandle);
            notified.add(callback);
          }
        }
      }
    }

    if (!this.priceStreams.has(asset)) {
      this.priceStreams.set(asset, []);
    }
    const prices = this.priceStreams.get(asset)!;
    prices.push({ asset, price, time: timestamp });
    if (prices.length > 100) {
      prices.shift();
    }
  }

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

    if (prices.length > 100) {
      prices.shift();
    }

    const key = `prices:${data.asset}`;
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(price);
      }
    }
  }

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

    const key = `sentiment:${data.asset}`;
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(sentiment);
      }
    }
  }

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

    if (signals.length > 10) {
      signals.shift();
    }
  }

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

