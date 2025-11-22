/**
 * Market data type definitions
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  volume?: number;
}

export interface CandleOptions {
  asset: string;
  endTime?: number;
  offset: number; // in seconds
  period: number; // in seconds (60, 300, 900, 1800, 3600, etc.)
}

export interface RealtimePrice {
  asset: string;
  price: number;
  time: number;
}

export interface MarketSentiment {
  asset: string;
  sentiment: {
    buy: number;
    sell: number;
  };
  timestamp: number;
}

export interface TradingSignal {
  asset: string;
  direction: 'call' | 'put';
  strength: number;
  timestamp: number;
  timeframe: number;
}

export type CandleCallback = (candle: Candle) => void;
export type PriceCallback = (price: RealtimePrice) => void;
export type SentimentCallback = (sentiment: MarketSentiment) => void;

export const TIMEFRAMES = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H2: 7200,
  H4: 14400,
  D1: 86400,
} as const;

export type TimeframeName = keyof typeof TIMEFRAMES;
export type TimeframeValue = typeof TIMEFRAMES[TimeframeName];

