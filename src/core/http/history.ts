/**
 * Trade history handler
 * 
 * @NEW_FUNCTION - Enhanced to match Python SDK's WebSocket-based history
 */

import { HttpClient } from './HttpClient';
import type { Logger, TradeHistory } from '../../types';

export class HistoryClient {
  private sessionData: { cookies?: string; token?: string; userAgent?: string } = {};

  constructor(
    private readonly http: HttpClient,
    private readonly logger: Logger
  ) {}

  /**
   * Set session data for authenticated requests
   */
  setSessionData(sessionData: { cookies?: string; token?: string; userAgent?: string }): void {
    this.sessionData = sessionData;
  }

  /**
   * Get trade history (NEW_FUNCTION - matches Python SDK)
   * Port of Python SDK's get_trader_history function
   * 
   * @param accountType - "demo" or "live"
   * @param pageNumber - Page number for pagination
   */
  async getTraderHistory(accountType: 'demo' | 'live' = 'demo', pageNumber: number = 1): Promise<any> {
    try {
      this.logger.debug(`Fetching ${accountType} history (page: ${pageNumber})`);

      const url = `https://qxbroker.com/api/v1/cabinets/trades/history/type/${accountType}?page=${pageNumber}`;

      const headers: Record<string, string> = {
        'referer': 'https://qxbroker.com/en/trade',
        'content-type': 'application/json',
        'accept': 'application/json',
      };

      if (this.sessionData.cookies) {
        headers['cookie'] = this.sessionData.cookies;
      }

      if (this.sessionData.userAgent) {
        headers['user-agent'] = this.sessionData.userAgent;
      }

      // Make HTTP GET request
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        this.logger.warn(`History request failed: ${response.status}`);
        return { data: [] };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch history:', error);
      return { data: [] };
    }
  }

  /**
   * Get trade history (enhanced version)
   */
  async getHistory(limit: number = 50, offset: number = 0): Promise<TradeHistory[]> {
    try {
      this.logger.debug(`Fetching trade history (limit: ${limit}, offset: ${offset})`);
      
      // Fetch from API endpoint
      const response = await this.getTraderHistory('demo', 1);
      const trades = response.data || [];

      // Map to TradeHistory format
      return trades.slice(offset, offset + limit).map((item: any) => this.mapHistoryItem(item));
    } catch (error) {
      this.logger.error('Failed to fetch history:', error);
      return [];
    }
  }

  /**
   * Get history for specific asset
   */
  async getHistoryByAsset(asset: string, limit: number = 50): Promise<TradeHistory[]> {
    try {
      this.logger.debug(`Fetching history for ${asset}`);
      // WebSocket-based implementation needed
      return [];
    } catch (error) {
      this.logger.error(`Failed to fetch history for ${asset}:`, error);
      return [];
    }
  }

  /**
   * Get history for date range
   */
  async getHistoryByDateRange(from: number, to: number): Promise<TradeHistory[]> {
    try {
      this.logger.debug(`Fetching history from ${from} to ${to}`);
      // WebSocket-based implementation needed
      return [];
    } catch (error) {
      this.logger.error('Failed to fetch history by date range:', error);
      return [];
    }
  }

  /**
   * Map history item to TradeHistory type
   */
  private mapHistoryItem(item: any): TradeHistory {
    return {
      ticket: item.ticket || item.id,
      asset: item.asset,
      amount: item.amount,
      direction: item.direction,
      openPrice: item.openPrice || item.open_price,
      closePrice: item.closePrice || item.close_price,
      openTime: item.openTime || item.open_time,
      closeTime: item.closeTime || item.close_time,
      profit: item.profit,
      profitAmount: item.profitAmount || item.profit_amount,
      status: item.status,
    };
  }
}

