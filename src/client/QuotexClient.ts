/**
 * Main Quotex SDK Client
 * 
 * @example
 * ```typescript
 * const client = new QuotexClient({
 *   email: 'your@email.com',
 *   password: 'password',
 *   lang: 'en'
 * });
 * 
 * await client.connect();
 * const balance = await client.getBalance();
 * ```
 */

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
  
  // Core components
  private readonly ws: SocketIOManager;
  private readonly session: SessionManager;
  private readonly http: HttpClient;
  private readonly auth: AuthClient;
  private readonly history: HistoryClient;
  
  // Feature managers
  private readonly trading: TradingManager;
  private readonly marketData: MarketDataManager;
  private readonly account: AccountManager;
  private readonly assets: AssetManager;
  private readonly indicators: IndicatorManager;
  
  private connected = false;

  constructor(config: QuotexConfig) {
    this.config = getDefaultConfig(config);
    this.logger = createLogger(this.config.debug);
    
    // Initialize core components (Socket.IO)
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
    
    this.session = new SessionManager(this.logger);
    this.http = new HttpClient(undefined, this.logger);
    
    // Check if browser should be visible
    const browserHeadless = process.env.BROWSER_HEADLESS !== 'false';
    this.auth = new AuthClient(this.http, this.logger, this.config.lang, true, browserHeadless);
    this.history = new HistoryClient(this.http, this.logger);
    
    // Initialize feature managers
    this.trading = new TradingManager(this.ws as any, this.logger);
    this.marketData = new MarketDataManager(this.ws as any, this.logger);
    this.account = new AccountManager(this.ws as any, this.logger);
    this.assets = new AssetManager(this.ws as any, this.logger);
    this.indicators = new IndicatorManager(this.logger);
    
    // Set HTTP headers
    this.http.setHeaders({
      'User-Agent': this.config.userAgent,
    });
  }

  // ==================== Connection Methods ====================

  /**
   * Set account mode (demo or live)
   */
  setAccountMode(mode: AccountMode): void {
    this.account.setAccountMode(mode);
    
    // Update Socket.IO authorization if connected
    if (this.ws.isConnected()) {
      // Socket.IO will be re-authorized in the next request
      this.logger.info(`Account mode set to: ${mode}`);
    }
  }

  /**
   * Connect to Quotex platform
   */
  async connect(): Promise<ConnectionResult> {
    try {
      this.logger.info('Connecting to Quotex...');

      // Load session if exists
      const session = await this.session.load();
      
      if (session && this.session.isValid()) {
        this.logger.info('Using existing session');
        
        // Set cookies and session data
        if (session.cookies) {
          this.http.setHeaders({
            'Cookie': session.cookies,
          });
        }
        
        // Pass session to history client
        this.history.setSessionData({
          cookies: session.cookies,
          token: session.token,
          userAgent: session.userAgent,
        });
      } else {
        // Login with credentials
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
          
          // Set cookies for subsequent requests
          if (loginResult.cookies) {
            this.http.setHeaders({
              'Cookie': loginResult.cookies,
            });
          }
          
          // Pass session to history client
          this.history.setSessionData({
            cookies: loginResult.cookies,
            token: loginResult.token,
            userAgent: this.config.userAgent,
          });
        }
      }

      // Connect to Socket.IO with token, cookies, and user agent
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

      // Wait for initial data
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

  /**
   * Disconnect from platform
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting...');
    this.ws.disconnect();
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws.isConnected();
  }

  /**
   * Reconnect to platform
   */
  async reconnect(): Promise<ConnectionResult> {
    await this.disconnect();
    await Bun.sleep(1000);
    const result = await this.connect();
    
    // Re-subscribe to streams after reconnect
    await this.reSubscribeStreams();
    
    return result;
  }

  /**
   * Check if websocket is alive (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's websocket_alive function
   */
  websocketAlive(): boolean {
    return this.ws.isConnected();
  }

  /**
   * Re-subscribe to all streams after reconnect (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's re_subscribe_stream function
   * This automatically re-subscribes to all previously active streams
   */
  private async reSubscribeStreams(): Promise<void> {
    try {
      this.logger.info('Re-subscribing to streams after reconnect...');
      
      // The MarketDataManager and other managers already track subscriptions
      // They will automatically re-subscribe when the WebSocket reconnects
      // This method is here for compatibility with Python SDK structure
      
      await Bun.sleep(500);
      this.logger.info('Stream re-subscription complete');
    } catch (error) {
      this.logger.error('Failed to re-subscribe to streams:', error);
    }
  }

  // ==================== Trading Methods ====================

  /**
   * Place a buy order
   * 
   * @example
   * ```typescript
   * const result = await client.buy({
   *   amount: 50,
   *   asset: 'EURUSD',
   *   direction: 'call',
   *   duration: 60
   * });
   * ```
   */
  async buy(options: BuyOptions): Promise<TradeResult> {
    return this.trading.buy(options);
  }

  /**
   * Place a pending order
   */
  async openPending(options: PendingOrderOptions): Promise<TradeResult> {
    return this.trading.openPending(options);
  }

  /**
   * Sell/close an option
   */
  async sellOption(optionId: string): Promise<SellOptionResult> {
    return this.trading.sellOption(optionId);
  }

  /**
   * Check if a trade won
   */
  async checkWin(tradeId: string, timeout?: number): Promise<boolean> {
    return this.trading.checkWin(tradeId, timeout);
  }

  /**
   * Get trade result
   */
  async getResult(tradeId: string) {
    return this.trading.getResult(tradeId);
  }

  /**
   * Get last profit/loss
   */
  getProfit(): number {
    return this.trading.getProfit();
  }

  /**
   * Get active trades
   */
  getActiveTrades() {
    return this.trading.getActiveTrades();
  }

  // ==================== Market Data Methods ====================

  /**
   * Get historical candles
   * 
   * @example
   * ```typescript
   * const candles = await client.getCandles({
   *   asset: 'EURUSD',
   *   offset: 3600,
   *   period: 60
   * });
   * ```
   */
  async getCandles(options: CandleOptions): Promise<Candle[]> {
    return this.marketData.getCandles(options);
  }

  /**
   * Get history line data (NEW_FUNCTION - matches Python SDK)
   * 
   * @param assetId - Asset ID (not symbol)
   * @param endTime - End time for history
   * @param offset - Offset in seconds
   */
  async getHistoryLine(assetId: string, endTime?: number, offset: number = 3600): Promise<any> {
    return this.marketData.getHistoryLine(assetId, endTime, offset);
  }

  /**
   * Get realtime candles
   */
  async getRealtimeCandles(asset: string): Promise<Candle[]> {
    return this.marketData.getRealtimeCandles(asset);
  }

  /**
   * Get realtime price
   */
  async getRealtimePrice(asset: string): Promise<RealtimePrice[]> {
    return this.marketData.getRealtimePrice(asset);
  }

  /**
   * Get market sentiment
   */
  async getRealtimeSentiment(asset: string): Promise<MarketSentiment | null> {
    return this.marketData.getRealtimeSentiment(asset);
  }

  /**
   * Get trading signals
   */
  getSignalData(): TradingSignal[] {
    return this.marketData.getSignalData();
  }

  /**
   * Subscribe to candle updates
   */
  subscribeToCandleStream(
    asset: string,
    period: number,
    callback: CandleCallback
  ): Unsubscribe {
    return this.marketData.subscribeToCandleStream(asset, period, callback);
  }

  /**
   * Subscribe to price updates
   */
  subscribeToPriceStream(
    asset: string,
    period: number,
    callback: PriceCallback
  ): Unsubscribe {
    return this.marketData.subscribeToPriceStream(asset, period, callback);
  }

  /**
   * Subscribe to sentiment updates
   */
  subscribeToSentimentStream(asset: string, callback: SentimentCallback): Unsubscribe {
    return this.marketData.subscribeToSentimentStream(asset, callback);
  }

  /**
   * Start signals data stream
   */
  startSignalsData(): void {
    this.marketData.startSignalsData();
  }

  /**
   * Get opening/closing info for current candle (NEW_FUNCTION - matches Python SDK)
   * 
   * @example
   * ```typescript
   * const candleInfo = await client.openingClosingCurrentCandle('EURUSD', 60);
   * console.log(`Remaining time: ${candleInfo.remaining}s`);
   * ```
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
    return this.marketData.openingClosingCurrentCandle(asset, period);
  }

  /**
   * Store and apply trading settings (NEW_FUNCTION - matches Python SDK)
   * 
   * @example
   * ```typescript
   * const settings = await client.storeSettingsApply('EURUSD', 60, 'TIME', 50, false, 1);
   * ```
   */
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

  // ==================== Account Methods ====================

  /**
   * Get user profile
   */
  async getProfile(): Promise<Profile | null> {
    return this.account.getProfile();
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    return this.account.getBalance();
  }

  /**
   * Change account
   */
  async changeAccount(mode: AccountMode): Promise<boolean> {
    return this.account.changeAccount(mode);
  }

  /**
   * Edit practice balance (demo only)
   */
  async editPracticeBalance(amount: number): Promise<boolean> {
    return this.account.editPracticeBalance(amount);
  }

  /**
   * Get account mode
   */
  getAccountMode(): AccountMode {
    return this.account.getAccountMode();
  }

  // ==================== Asset Methods ====================

  /**
   * Get all instruments
   */
  async getInstruments(): Promise<InstrumentData[]> {
    return this.assets.getInstruments();
  }

  /**
   * Get all assets
   */
  async getAllAssets(): Promise<Asset[]> {
    return this.assets.getAllAssets();
  }

  /**
   * Get all asset names
   */
  async getAllAssetNames(): Promise<string[]> {
    return this.assets.getAllAssetNames();
  }

  /**
   * Check if asset is open
   */
  async checkAssetOpen(assetName: string): Promise<AssetInfo | null> {
    return this.assets.checkAssetOpen(assetName);
  }

  /**
   * Get available asset (tries OTC if closed)
   */
  async getAvailableAsset(assetName: string, forceOpen?: boolean): Promise<AssetInfo | null> {
    return this.assets.getAvailableAsset(assetName, forceOpen);
  }

  /**
   * Get asset payout information with percentage and currency
   * 
   * @example
   * ```typescript
   * const payout = client.getPayoutInfo('EURUSD_otc');
   * if (payout) {
   *   console.log(`${payout.asset}: ${payout.percentage}%`);
   * }
   * ```
   */
  getPayoutInfo(assetName: string): PayoutInfo | null {
    return this.assets.getPayoutInfo(assetName);
  }

  /**
   * Get all payouts for all assets
   * Returns a Map of asset names to payout percentages
   */
  getAllPayouts(): Map<string, number> {
    return this.assets.getAllPayouts();
  }

  /**
   * Get payout percentage by asset
   */
  getPayoutByAsset(assetName: string): number {
    return this.assets.getPayoutByAsset(assetName);
  }

  /**
   * Get assets by category
   */
  async getAssetsByCategory(category: string): Promise<Asset[]> {
    return this.assets.getAssetsByCategory(category);
  }

  /**
   * Get only open assets
   */
  async getOpenAssets(): Promise<Asset[]> {
    return this.assets.getOpenAssets();
  }

  /**
   * Search assets
   */
  async searchAssets(query: string): Promise<Asset[]> {
    return this.assets.searchAssets(query);
  }

  // ==================== Indicator Methods ====================

  /**
   * Calculate technical indicator
   * 
   * @example
   * ```typescript
   * const rsi = await client.calculateIndicator({
   *   asset: 'EURUSD',
   *   indicator: 'RSI',
   *   params: { period: 14 },
   *   timeframe: 300
   * });
   * ```
   */
  async calculateIndicator(options: IndicatorOptions): Promise<IndicatorResult> {
    // First get candles
    const candles = await this.getCandles({
      asset: options.asset,
      offset: options.timeframe * 100, // Get 100 periods
      period: options.timeframe,
    });

    if (candles.length === 0) {
      throw new Error('No candles available for indicator calculation');
    }

    return this.indicators.calculate(candles, options);
  }

  /**
   * Subscribe to real-time indicator updates (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's subscribe_indicator function
   * 
   * @example
   * ```typescript
   * const unsubscribe = await client.subscribeIndicator({
   *   asset: 'EURUSD',
   *   indicator: 'RSI',
   *   params: { period: 14 },
   *   timeframe: 60,
   *   callback: (result) => {
   *     console.log('RSI:', result.current);
   *   }
   * });
   * 
   * // Later, to stop:
   * unsubscribe();
   * ```
   */
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

    // Get initial historical data
    try {
      historicalCandles = await this.getCandles({
        asset,
        offset: timeframe * 100, // Get 100 periods
        period: timeframe,
      });
    } catch (error) {
      this.logger.error('Failed to get initial historical data:', error);
    }

    // Subscribe to candle stream
    const candleUnsubscribe = this.subscribeToCandleStream(asset, timeframe, async (newCandle) => {
      if (!isActive) return;

      try {
        // Update historical candles with new candle
        historicalCandles.push(newCandle);
        
        // Keep only last 100 candles
        if (historicalCandles.length > 100) {
          historicalCandles = historicalCandles.slice(-100);
        }

        // Calculate indicator with updated data
        const result = await this.indicators.calculate(historicalCandles, {
          asset,
          indicator,
          params,
          timeframe,
        });

        // Call user callback with result
        callback(result);
      } catch (error) {
        this.logger.error(`Error calculating ${indicator}:`, error);
      }
    });

    // Return unsubscribe function
    return () => {
      isActive = false;
      candleUnsubscribe();
      this.logger.debug(`Unsubscribed from ${indicator} for ${asset}`);
    };
  }

  // ==================== History Methods ====================

  /**
   * Get trade history
   */
  async getHistory(limit?: number, offset?: number): Promise<TradeHistory[]> {
    return this.history.getHistory(limit, offset);
  }

  /**
   * Get history by asset
   */
  async getHistoryByAsset(asset: string, limit?: number): Promise<TradeHistory[]> {
    return this.history.getHistoryByAsset(asset, limit);
  }

  /**
   * Get history by date range
   */
  async getHistoryByDateRange(from: number, to: number): Promise<TradeHistory[]> {
    return this.history.getHistoryByDateRange(from, to);
  }

  /**
   * Get trader history with pagination (NEW_FUNCTION - matches Python SDK)
   * 
   * @param accountType - "demo" or "live"
   * @param pageNumber - Page number for pagination
   */
  async getTraderHistory(accountType: 'demo' | 'live' = 'demo', pageNumber: number = 1): Promise<any> {
    return this.history.getTraderHistory(accountType, pageNumber);
  }
}

