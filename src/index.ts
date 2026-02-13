export { QuotexClient } from './client/QuotexClient';

export type {
  ConnectionResult,
  QuotexConfig,
  Direction,
  AccountMode,
  TimeMode,
  Unsubscribe,
  Logger,
  BuyOptions,
  TradeResult,
  TradeInfo,
  PendingOrderOptions,
  SellOptionResult,
  TradeHistory,
  Candle,
  CandleOptions,
  RealtimePrice,
  MarketSentiment,
  TradingSignal,
  CandleCallback,
  PriceCallback,
  SentimentCallback,
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
  Profile,
  BalanceInfo,
  AccountSettings,
  Asset,
  AssetInfo,
  PayoutInfo,
  InstrumentData,
} from './types';

export { TIMEFRAMES, VALID_PERIODS } from './config/constants';

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

