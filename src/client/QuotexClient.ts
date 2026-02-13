import type {
  QuotexConfig,
  ConnectionResult,
  Logger,
  BuyOptions,
  TradeResult,
  PendingOrderOptions,
  SellOptionResult,
  Profile,
  AccountMode,
  Candle,
  CandleOptions,
  RealtimePrice,
  MarketSentiment,
  TradingSignal,
  Asset,
  AssetInfo,
  InstrumentData,
  PayoutInfo,
  IndicatorOptions,
  IndicatorResult,
  IndicatorType,
  IndicatorCallback,
  TradeHistory,
  Unsubscribe,
  CandleCallback,
  PriceCallback,
  SentimentCallback,
} from '../types';
import { getDefaultConfig } from '../config/defaults';
import { QUOTEX_WSS_URL } from '../config/constants';
import { createLogger } from '../utils/logger';
import { SocketIOManager } from '../core/websocket/SocketIOManager';
import { SessionManager } from '../core/session/SessionManager';
import { HttpClient } from '../core/http/HttpClient';
import { AuthClient } from '../core/http/auth';
import { HistoryClient } from '../core/http/history';
import { TradingManager } from '../features/trading/TradingManager';
import { MarketDataManager } from '../features/market-data/MarketDataManager';
import { AccountManager } from '../features/account/AccountManager';
import { AssetManager } from '../features/assets/AssetManager';
import { IndicatorManager } from '../features/indicators/IndicatorManager';

export class QuotexClient {
  private readonly config: Required<QuotexConfig>;
  private readonly logger: Logger;
  
  private readonly ws: SocketIOManager;
  private readonly session: SessionManager;
  private readonly http: HttpClient;
  private readonly auth: AuthClient;
  private readonly history: HistoryClient;
  
  private readonly trading: TradingManager;
  private readonly marketData: MarketDataManager;
  private readonly account: AccountManager;
  private readonly assets: AssetManager;
  private readonly indicators: IndicatorManager;
  
  private connected = false;

  constructor(config: QuotexConfig) {
    this.config = getDefaultConfig(config);
    this.logger = createLogger(this.config.debug);
    
    this.ws = new SocketIOManager(
      {
        url: QUOTEX_WSS_URL,
        reconnect: true,
        reconnectAttempts: 5,
        reconnectDelay: 5000,
        debug: this.config.debug,
      },
      this.logger
    );
    
    this.session = new SessionManager(this.logger, this.config.sessionPath);
    this.http = new HttpClient(undefined, this.logger);
    
    const browserHeadless = process.env.BROWSER_HEADLESS !== 'false';
    this.auth = new AuthClient(this.http, this.logger, this.config.lang, true, browserHeadless);
    this.history = new HistoryClient(this.http, this.logger);
    
    this.trading = new TradingManager(this.ws as any, this.logger);
    this.marketData = new MarketDataManager(this.ws as any, this.logger);
    this.account = new AccountManager(this.ws as any, this.logger);
    this.assets = new AssetManager(this.ws as any, this.logger);
    this.indicators = new IndicatorManager(this.logger);
    
    this.http.setHeaders({
      'User-Agent': this.config.userAgent,
    });
  }

  setAccountMode(mode: AccountMode): void {
    this.account.setAccountMode(mode);
    
    if (this.ws.isConnected()) {
      this.logger.info(`Account mode set to: ${mode}`);
    }
  }

  async connect(): Promise<ConnectionResult> {
    try {
      this.logger.info('Connecting to Quotex...');

      const session = await this.session.load();
      
      if (session && this.session.isValid()) {
        this.logger.info('Using existing session');
        
        if (session.cookies) {
          this.http.setHeaders({
            'Cookie': session.cookies,
          });
        }
        
        this.history.setSessionData({
          cookies: session.cookies,
          token: session.token,
          userAgent: session.userAgent,
        });
      } else {
        
        const loginResult = await this.auth.login({
          email: this.config.email,
          password: this.config.password,
          lang: this.config.lang,
        });

        if (!loginResult.success) {
          return {
            success: false,
            message: loginResult.message || 'Login failed',
          };
        }

        if (loginResult.token) {
          await this.session.save({
            token: loginResult.token,
            cookies: loginResult.cookies,
            userAgent: this.config.userAgent,
            timestamp: Date.now(),
          });
          
          if (loginResult.cookies) {
            this.http.setHeaders({
              'Cookie': loginResult.cookies,
            });
          }
          
          this.history.setSessionData({
            cookies: loginResult.cookies,
            token: loginResult.token,
            userAgent: this.config.userAgent,
          });
        }
      }

      this.logger.info('Connecting to WebSocket (Socket.IO protocol)...');
      const wsConnected = await this.ws.connect(
        session?.token,
        session?.cookies,
        session?.userAgent || this.config.userAgent
      );
      
      if (wsConnected) {
        this.logger.info('Socket.IO connected successfully! ✅');
      } else {
        this.logger.warn('Socket.IO unavailable - using HTTP API only');
      }

      this.connected = true;
      this.logger.info('Successfully connected to Quotex');

      await Bun.sleep(500);

      return {
        success: true,
        message: 'Connected successfully',
      };
    } catch (error) {
      this.logger.error('Connection error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting...');
    this.ws.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws.isConnected();
  }

  async reconnect(): Promise<ConnectionResult> {
    await this.disconnect();
    await Bun.sleep(1000);
    const result = await this.connect();
    
    await this.reSubscribeStreams();
    
    return result;
  }

  websocketAlive(): boolean {
    return this.ws.isConnected();
  }

  private async reSubscribeStreams(): Promise<void> {
    try {
      this.logger.info('Re-subscribing to streams after reconnect...');
      
      await Bun.sleep(500);
      this.logger.info('Stream re-subscription complete');
    } catch (error) {
      this.logger.error('Failed to re-subscribe to streams:', error);
    }
  }

  async buy(options: BuyOptions): Promise<TradeResult> {
    return this.trading.buy(options);
  }

  async openPending(options: PendingOrderOptions): Promise<TradeResult> {
    return this.trading.openPending(options);
  }

  async sellOption(optionId: string): Promise<SellOptionResult> {
    return this.trading.sellOption(optionId);
  }

  async checkWin(tradeId: string, timeout?: number): Promise<boolean> {
    return this.trading.checkWin(tradeId, timeout);
  }

  async getResult(tradeId: string) {
    return this.trading.getResult(tradeId);
  }

  getProfit(): number {
    return this.trading.getProfit();
  }

  getActiveTrades() {
    return this.trading.getActiveTrades();
  }

  async getCandles(options: CandleOptions): Promise<Candle[]> {
    return this.marketData.getCandles(options);
  }

  async getHistoryLine(assetId: string, endTime?: number, offset: number = 3600): Promise<any> {
    return this.marketData.getHistoryLine(assetId, endTime, offset);
  }

  async getRealtimeCandles(asset: string): Promise<Candle[]> {
    return this.marketData.getRealtimeCandles(asset);
  }

  async getRealtimePrice(asset: string): Promise<RealtimePrice[]> {
    return this.marketData.getRealtimePrice(asset);
  }

  async getRealtimeSentiment(asset: string): Promise<MarketSentiment | null> {
    return this.marketData.getRealtimeSentiment(asset);
  }

  getSignalData(): TradingSignal[] {
    return this.marketData.getSignalData();
  }

  subscribeToCandleStream(
    asset: string,
    period: number,
    callback: CandleCallback
  ): Unsubscribe {
    return this.marketData.subscribeToCandleStream(asset, period, callback);
  }

  subscribeToPriceStream(
    asset: string,
    period: number,
    callback: PriceCallback
  ): Unsubscribe {
    return this.marketData.subscribeToPriceStream(asset, period, callback);
  }

  subscribeToSentimentStream(asset: string, callback: SentimentCallback): Unsubscribe {
    return this.marketData.subscribeToSentimentStream(asset, callback);
  }

  startSignalsData(): void {
    this.marketData.startSignalsData();
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
    return this.marketData.openingClosingCurrentCandle(asset, period);
  }

  async storeSettingsApply(
    asset: string = 'EURUSD',
    period: number = 0,
    timeMode: string = 'TIMER',
    deal: number = 5,
    percentMode: boolean = false,
    percentDeal: number = 1
  ): Promise<any> {
    return this.marketData.storeSettingsApply(asset, period, timeMode, deal, percentMode, percentDeal);
  }

  async getProfile(): Promise<Profile | null> {
    return this.account.getProfile();
  }

  async getBalance(): Promise<number> {
    return this.account.getBalance();
  }

  async changeAccount(mode: AccountMode): Promise<boolean> {
    return this.account.changeAccount(mode);
  }

  async editPracticeBalance(amount: number): Promise<boolean> {
    return this.account.editPracticeBalance(amount);
  }

  getAccountMode(): AccountMode {
    return this.account.getAccountMode();
  }

  async getInstruments(): Promise<InstrumentData[]> {
    return this.assets.getInstruments();
  }

  async getAllAssets(): Promise<Asset[]> {
    return this.assets.getAllAssets();
  }

  async getAllAssetNames(): Promise<string[]> {
    return this.assets.getAllAssetNames();
  }

  async checkAssetOpen(assetName: string): Promise<AssetInfo | null> {
    return this.assets.checkAssetOpen(assetName);
  }

  async getAvailableAsset(assetName: string, forceOpen?: boolean): Promise<AssetInfo | null> {
    return this.assets.getAvailableAsset(assetName, forceOpen);
  }

  getPayoutInfo(assetName: string): PayoutInfo | null {
    return this.assets.getPayoutInfo(assetName);
  }

  getAllPayouts(): Map<string, number> {
    return this.assets.getAllPayouts();
  }

  getPayoutByAsset(assetName: string): number {
    return this.assets.getPayoutByAsset(assetName);
  }

  async getAssetsByCategory(category: string): Promise<Asset[]> {
    return this.assets.getAssetsByCategory(category);
  }

  async getOpenAssets(): Promise<Asset[]> {
    return this.assets.getOpenAssets();
  }

  async searchAssets(query: string): Promise<Asset[]> {
    return this.assets.searchAssets(query);
  }

  async calculateIndicator(options: IndicatorOptions): Promise<IndicatorResult> {
    const candles = await this.getCandles({
      asset: options.asset,
      offset: options.timeframe * 100,
      period: options.timeframe,
    });

    if (candles.length === 0) {
      throw new Error('No candles available for indicator calculation');
    }

    return this.indicators.calculate(candles, options);
  }

  async subscribeIndicator(options: {
    asset: string;
    indicator: IndicatorType;
    params?: Record<string, number>;
    timeframe: number;
    callback: IndicatorCallback;
  }): Promise<Unsubscribe> {
    const { asset, indicator, params = {}, timeframe, callback } = options;

    if (!callback) {
      throw new Error('Callback function is required for indicator subscription');
    }

    this.logger.debug(`Subscribing to ${indicator} for ${asset} at ${timeframe}s timeframe`);

    let isActive = true;
    let historicalCandles: Candle[] = [];

    try {
      historicalCandles = await this.getCandles({
        asset,
        offset: timeframe * 100,
        period: timeframe,
      });
    } catch (error) {
      this.logger.error('Failed to get initial historical data:', error);
    }

    const candleUnsubscribe = this.subscribeToCandleStream(asset, timeframe, async (newCandle) => {
      if (!isActive) return;

      try {
        historicalCandles.push(newCandle);
        
        if (historicalCandles.length > 100) {
          historicalCandles = historicalCandles.slice(-100);
        }

        const result = await this.indicators.calculate(historicalCandles, {
          asset,
          indicator,
          params,
          timeframe,
        });

        callback(result);
      } catch (error) {
        this.logger.error(`Error calculating ${indicator}:`, error);
      }
    });

    return () => {
      isActive = false;
      candleUnsubscribe();
      this.logger.debug(`Unsubscribed from ${indicator} for ${asset}`);
    };
  }

  async getHistory(limit?: number, offset?: number): Promise<TradeHistory[]> {
    return this.history.getHistory(limit, offset);
  }

  async getHistoryByAsset(asset: string, limit?: number): Promise<TradeHistory[]> {
    return this.history.getHistoryByAsset(asset, limit);
  }

  async getHistoryByDateRange(from: number, to: number): Promise<TradeHistory[]> {
    return this.history.getHistoryByDateRange(from, to);
  }

  async getTraderHistory(accountType: 'demo' | 'live' = 'demo', pageNumber: number = 1): Promise<any> {
    return this.history.getTraderHistory(accountType, pageNumber);
  }
}

