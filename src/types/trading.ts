/**
 * Trading-related type definitions
 */

import type { Direction, TimeMode } from './common';

export interface BuyOptions {
  amount: number;
  asset: string;
  direction: Direction;
  duration: number; // in seconds
  timeMode?: TimeMode;
}

export interface TradeResult {
  success: boolean;
  data?: TradeInfo;
  error?: string;
}

export interface TradeInfo {
  id: string;
  asset: string;
  amount: number;
  direction: Direction;
  openPrice?: number;
  closePrice?: number;
  openTime: number;
  closeTime?: number;
  duration: number;
  profit?: number;
  status?: 'pending' | 'open' | 'closed' | 'win' | 'loss';
}

export interface PendingOrderOptions extends BuyOptions {
  openTime: string; // Format: "dd/mm HH:MM"
}

export interface SellOptionResult {
  success: boolean;
  message?: string;
}

export interface TradeHistory {
  ticket: string;
  asset: string;
  amount: number;
  direction: Direction;
  openPrice: number;
  closePrice: number;
  openTime: number;
  closeTime: number;
  profit: number;
  profitAmount: number;
  status: string;
}

