/**
 * QuotexSDK - TypeScript SDK for Quotex Trading Platform
 * 
 * @packageDocumentation
 */

// Main client
export { QuotexClient } from './client/QuotexClient';

// Type exports
export type {
  // Common
  ConnectionResult,
  QuotexConfig,
  Direction,
  AccountMode,
  TimeMode,
  Unsubscribe,
  Logger,
  
  // Trading
  BuyOptions,
  TradeResult,
  TradeInfo,
  PendingOrderOptions,
  SellOptionResult,
  TradeHistory,
  
  // Market Data
  Candle,
  CandleOptions,
  RealtimePrice,
  MarketSentiment,
  TradingSignal,
  CandleCallback,
  PriceCallback,
  SentimentCallback,
  
  // Indicators
  IndicatorType,
  IndicatorOptions,
  IndicatorResult,
  RSIResult,
  MACDResult,
  BollingerBandsResult,
  StochasticResult,
  ADXResult,
  ATRResult,
  SMAResult,
  EMAResult,
  IchimokuResult,
  
  // Account
  Profile,
  BalanceInfo,
  AccountSettings,
  
  // Assets
  Asset,
  AssetInfo,
  PayoutInfo,
  InstrumentData,
} from './types';

// Constants
export { TIMEFRAMES, VALID_PERIODS } from './config/constants';

// Utilities
export {
  getTimestamp,
  getTimestampMs,
  dateToTimestamp,
  timestampToDate,
  getTimestampDaysAgo,
  getTimestampHoursAgo,
  formatTimestamp,
} from './utils/time';

export {
  getExpirationTime,
  getNextTimeframe,
  isWithinTradingHours,
  getRemainingTime,
} from './utils/expiration';

export {
  getCandleColor,
  getCandleBodySize,
  getCandleRange,
  isBullish,
  isBearish,
  isDoji,
  getUpperShadow,
  getLowerShadow,
} from './utils/candle-processor';

