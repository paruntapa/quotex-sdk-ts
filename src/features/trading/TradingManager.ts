/**
 * Trading operations manager
 */

import type { Logger, BuyOptions, TradeResult, TradeInfo, PendingOrderOptions, SellOptionResult } from '../../types';
import { WebSocketManager } from '../../core/websocket/WebSocketManager';
import { getTimestamp } from '../../utils/time';
import { getExpirationTime } from '../../utils/expiration';

export class TradingManager {
  private activeTradesMap = new Map<string, TradeInfo>();
  private lastProfit: number = 0;

  constructor(
    private readonly ws: WebSocketManager,
    private readonly logger: Logger
  ) {
    this.setupTradeHandlers();
  }

  /**
   * Place a buy order
   */
  async buy(options: BuyOptions): Promise<TradeResult> {
    try {
      const { amount, asset, direction, duration, timeMode = 'TIME' } = options;

      this.logger.info(`Placing ${direction} order for ${asset}: ${amount}`);

      const timestamp = getTimestamp();
      const expirationTime = getExpirationTime(timestamp, duration);

      // Determine option type (Python SDK logic)
      let optionType = 1;
      let timeValue = expirationTime;

      if (asset.endsWith('_otc')) {
        optionType = 100;
        timeValue = duration;
      }
      
      this.logger.debug(`Time values: current=${getTimestamp()}, buffered=${timestamp}, expiration=${expirationTime}, timeValue=${timeValue}`);

      // Generate request ID (Python SDK: expiration.get_timestamp() = int(time.time()))
      // Must be 10 digits (seconds), not 13 digits (milliseconds)
      const requestId = Math.floor(Date.now() / 1000);

      // Match Python SDK payload exactly
      const payload = {
        asset,
        amount,
        time: timeValue,  // NOT "duration" or "expirationTime"
        action: direction,
        isDemo: 1,  // Will be updated based on account mode
        tournamentId: 0,
        requestId,
        optionType,
      };

      if (!this.ws.isConnected()) {
        return {
          success: false,
          error: 'WebSocket not connected',
        };
      }

      // Subscribe to candle stream (Python SDK does this BEFORE buying)
      this.ws.send(`42["instruments/update",${JSON.stringify({ asset, period: duration })}]`);
      this.ws.send(`42["chart_notification/get",${JSON.stringify({ asset, version: "1.0.0" })}]`);
      this.ws.send(`42["depth/follow",${JSON.stringify(asset)}]`);
      
      // Send settings/apply (Python SDK requirement)
      const settingsPayload = {
        chartId: "graph",
        settings: {
          chartId: "graph",
          chartType: 2,
          currentExpirationTime: timeMode === 'TIME' ? expirationTime : getTimestamp(),
          isFastOption: timeMode === 'TIME',
          isFastAmountOption: false,
          isIndicatorsMinimized: false,
          isIndicatorsShowing: true,
          isShortBetElement: false,
          chartPeriod: 4,
          currentAsset: { symbol: asset },
          dealValue: amount,
          dealPercentValue: 1,
          isVisible: true,
          timePeriod: duration,
          gridOpacity: 8,
          isAutoScrolling: 1,
        }
      };
      this.ws.send(`42["settings/store",${JSON.stringify(settingsPayload)}]`);
      
      // Send tick (Python SDK does this)
      this.ws.send('42["tick"]');

      // Send buy request through WebSocket
      const message = `42["orders/open",${JSON.stringify(payload)}]`;
      this.ws.send(message);
      this.logger.debug('Buy order sent:', payload);

      // Wait for buy response (Python SDK: message.get("id") and not message.get("ticket"))
      // Python SDK waits up to duration seconds for response
      const timeoutMs = duration * 1000;
      const result = await this.waitForBuyResponse(timeoutMs);

      if (result) {
        this.logger.info(`✅ Trade opened: ${result.id}`);
        const tradeInfo = {
          id: result.id,
          asset,
          amount,
          direction,
          duration,
          openTime: result.openTimestamp || timestamp,
          closeTime: result.closeTimestamp || expirationTime,
          status: 'open' as const,
        };
        this.activeTradesMap.set(result.id, tradeInfo as any);
        return {
          success: true,
          data: tradeInfo,
        };
      }

      return {
        success: false,
        error: 'Trade response timeout - no response received',
      };
    } catch (error) {
      this.logger.error('Buy order failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Place a pending order
   */
  async openPending(options: PendingOrderOptions): Promise<TradeResult> {
    try {
      const { amount, asset, direction, duration, openTime } = options;

      this.logger.info(`Placing pending ${direction} order for ${asset} at ${openTime}`);

      // Convert time string to ISO format if needed
      // Python SDK expects: "2025-04-01T20:09:00.000Z"
      const isoTime = this.formatOpenTime(openTime);

      const payload = {
        openType: 0,
        asset,
        openTime: isoTime,
        timeframe: duration,
        command: direction, // Python SDK uses "command" not "action"
        amount,
      };

      if (!this.ws.isConnected()) {
        return {
          success: false,
          error: 'WebSocket not connected',
        };
      }

      const message = `42["pending/create",${JSON.stringify(payload)}]`;
      this.ws.send(message);
      this.logger.debug('Pending order sent:', payload);

      // Wait for pending order response
      const result = await this.waitForPendingOrderResponse(5000);

      if (result) {
        this.logger.info(`✅ Pending order created: ${result.ticket}`);
        return {
          success: true,
          data: result,
        };
      }

      return {
        success: false,
        error: 'Pending order timeout - no response received',
      };
    } catch (error) {
      this.logger.error('Pending order failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sell/close an open position
   */
  async sellOption(optionId: string): Promise<SellOptionResult> {
    try {
      if (!this.ws.isConnected()) {
        return {
          success: false,
          message: 'WebSocket not connected',
        };
      }

      this.logger.info(`Selling option ${optionId}`);

      // Correct message format from Python SDK
      const message = `42["orders/cancel",${JSON.stringify({ id: optionId })}]`;
      this.ws.send(message);
      this.logger.debug('Sell order sent:', optionId);

      // Wait for sell response (Python SDK: message.get("ticket") and not message.get("id"))
      const result = await this.waitForSellResponse(5000);

      if (result) {
        this.logger.info(`✅ Option sold: ${result.ticket}`);
        // Remove from active trades
        this.activeTradesMap.delete(optionId);
        return {
          success: true,
          message: 'Sell order placed successfully',
        };
      }

      // Even if no response, still remove from active trades
      this.activeTradesMap.delete(optionId);
      return {
        success: true,
        message: 'Sell order placed (no confirmation received)',
      };
    } catch (error) {
      this.logger.error('Sell option failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a trade won
   */
  async checkWin(tradeId: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const trade = this.activeTradesMap.get(tradeId);

      if (trade && trade.status === 'closed') {
        return (trade.profit ?? 0) > 0;
      }

      await Bun.sleep(500);
    }

    return false;
  }

  /**
   * Get trade result
   */
  async getResult(tradeId: string): Promise<{ status: string; details?: TradeInfo }> {
    const trade = this.activeTradesMap.get(tradeId);

    if (!trade) {
      return { status: 'not_found' };
    }

    if (trade.status === 'closed') {
      const status = (trade.profit ?? 0) > 0 ? 'win' : 'loss';
      return { status, details: trade };
    }

    return { status: 'pending', details: trade };
  }

  /**
   * Get last profit/loss
   */
  getProfit(): number {
    return this.lastProfit;
  }

  /**
   * Get active trades
   */
  getActiveTrades(): TradeInfo[] {
    return Array.from(this.activeTradesMap.values());
  }

  /**
   * Setup WebSocket handlers for trade events
   */
  private setupTradeHandlers(): void {
    this.ws.subscribe('orders/open', (data) => {
      this.logger.debug('Trade opened:', data);
      this.handleTradeUpdate(data);
    });

    this.ws.subscribe('orders/close', (data) => {
      this.logger.debug('Trade closed:', data);
      this.handleTradeUpdate(data);
    });

    this.ws.subscribe('orders/update', (data) => {
      this.logger.debug('Trade updated:', data);
      this.handleTradeUpdate(data);
    });

    // Handle all trade responses
    // Python SDK checks for different response types
    this.ws.subscribe('message', (data: any) => {
      if (data && typeof data === 'object') {
        // Debug: Log all messages with id or ticket
        if (data.id || data.ticket) {
          this.logger.debug(`📨 Message with id/ticket:`, {
            hasId: !!data.id,
            hasTicket: !!data.ticket,
            id: data.id,
            ticket: data.ticket,
            keys: Object.keys(data).slice(0, 10).join(',')
          });
        }
        
        // Pending order response: message.get("pending")
        if (data.pending) {
          this.logger.info(`🎯 Pending order response received:`, data.pending.ticket);
          this.lastPendingOrder = {
            ticket: data.pending.ticket,
            ...data.pending,
          };
        }
        
        // Buy response: message.get("id") and not message.get("ticket")
        if (data.id && !data.ticket) {
          this.logger.info(`🎯 Buy response received:`, data.id);
          this.lastBuyOrder = data;
        }
        
        // Sell response: message.get("ticket") and not message.get("id")
        if (data.ticket && !data.id) {
          this.logger.info(`🎯 Sell response received:`, data.ticket);
          this.lastSellOrder = data;
        }
      }
    });
  }

  private lastPendingOrder: any = null;
  private lastBuyOrder: any = null;
  private lastSellOrder: any = null;

  /**
   * Wait for pending order response
   * Python SDK: checks for api.pending_successful and api.pending_id
   */
  private async waitForPendingOrderResponse(timeout: number): Promise<any> {
    const startTime = Date.now();
    this.lastPendingOrder = null;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.lastPendingOrder) {
          clearInterval(checkInterval);
          resolve(this.lastPendingOrder);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
  }

  /**
   * Wait for buy order response
   * Python SDK: checks for api.buy_successful and api.buy_id
   * Response format: message.get("id") and not message.get("ticket")
   */
  private async waitForBuyResponse(timeout: number): Promise<any> {
    const startTime = Date.now();
    this.lastBuyOrder = null;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.lastBuyOrder) {
          clearInterval(checkInterval);
          resolve(this.lastBuyOrder);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
  }

  /**
   * Wait for sell order response
   * Python SDK: checks for api.sold_options_respond
   * Response format: message.get("ticket") and not message.get("id")
   */
  private async waitForSellResponse(timeout: number): Promise<any> {
    const startTime = Date.now();
    this.lastSellOrder = null;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.lastSellOrder) {
          clearInterval(checkInterval);
          resolve(this.lastSellOrder);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
  }

  /**
   * Handle trade update from WebSocket
   */
  private handleTradeUpdate(data: any): void {
    if (!data || !data.id) return;

    const tradeInfo: TradeInfo = {
      id: data.id,
      asset: data.asset,
      amount: data.amount,
      direction: data.action || data.direction,
      openPrice: data.openPrice || data.open_price,
      closePrice: data.closePrice || data.close_price,
      openTime: data.openTime || data.open_time,
      closeTime: data.closeTime || data.close_time,
      duration: data.duration,
      profit: data.profit,
      status: data.status,
    };

    this.activeTradesMap.set(tradeInfo.id, tradeInfo);

    if (tradeInfo.profit !== undefined) {
      this.lastProfit = tradeInfo.profit;
    }
  }

  /**
   * Wait for trade response
   */
  private async waitForTradeResponse(asset: string, timeout: number): Promise<TradeInfo | null> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check for recent trades matching the asset
        for (const trade of this.activeTradesMap.values()) {
          if (trade.asset === asset && trade.openTime > startTime / 1000 - 5) {
            clearInterval(checkInterval);
            resolve(trade);
            return;
          }
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
  }

  /**
   * Format open time to ISO format expected by Quotex (UTC)
   * Format: "dd/mm HH:MM" -> "2025-04-01T20:09:00.000Z"
   * User inputs local time, we convert to UTC for API
   */
  private formatOpenTime(timeStr: string): string {
    // Parse "dd/mm HH:MM" format
    const parts = timeStr.split(' ');
    if (parts.length !== 2) {
      throw new Error(`Invalid time format: ${timeStr}. Expected format: "dd/mm HH:MM"`);
    }
    
    const [datePart, timePart] = parts;
    const dateParts = datePart!.split('/').map(Number);
    const timeParts = timePart!.split(':').map(Number);
    
    if (dateParts.length !== 2 || timeParts.length !== 2) {
      throw new Error(`Invalid time format: ${timeStr}. Expected format: "dd/mm HH:MM"`);
    }
    
    const [day, month] = dateParts;
    const [hours, minutes] = timeParts;
    
    // User inputs local time, so create date in LOCAL timezone first
    const year = new Date().getFullYear();
    const localDate = new Date(year, month! - 1, day, hours, minutes, 0, 0);
    
    // toISOString() automatically converts to UTC
    return localDate.toISOString();
  }

  /**
   * Follow instruments for pending orders (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's instruments_follow function
   * This is called after a pending order is created to track it
   */
  instrumentsFollow(
    amount: number,
    asset: string,
    direction: string,
    duration: number,
    openTime: string,
    pendingId: string,
    profileId: string,
    currencyCode: string
  ): void {
    const payload = {
      amount,
      command: direction === 'call' ? 0 : 1,
      currency: currencyCode,
      min_payout: 0,
      open_time: openTime,
      open_type: 0,
      symbol: asset,
      ticket: pendingId,
      timeframe: duration,
      uid: profileId,
    };

    const message = `42["instruments/follow",${JSON.stringify(payload)}]`;
    this.ws.send(message);
    this.logger.debug('Instruments follow sent:', payload);
  }
}

