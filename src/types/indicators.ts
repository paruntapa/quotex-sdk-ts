/**
 * Technical indicators type definitions
 */

export type IndicatorType = 
  | 'RSI' 
  | 'MACD' 
  | 'BOLLINGER' 
  | 'STOCHASTIC' 
  | 'ADX' 
  | 'ATR' 
  | 'SMA' 
  | 'EMA' 
  | 'ICHIMOKU';

export interface IndicatorOptions {
  asset: string;
  indicator: IndicatorType;
  params?: Record<string, number>;
  timeframe: number;
}

export interface BaseIndicatorResult {
  timeframe: number;
  timestamps: number[];
  historySize: number;
}

export interface RSIResult extends BaseIndicatorResult {
  rsi: number[];
  current: number;
}

export interface MACDResult extends BaseIndicatorResult {
  macd: number[];
  signal: number[];
  histogram: number[];
  current: {
    macd: number;
    signal: number;
    histogram: number;
  };
}

export interface BollingerBandsResult extends BaseIndicatorResult {
  upper: number[];
  middle: number[];
  lower: number[];
  current: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface StochasticResult extends BaseIndicatorResult {
  k: number[];
  d: number[];
  current: {
    k: number;
    d: number;
  };
}

export interface ADXResult extends BaseIndicatorResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  current: {
    adx: number;
    plusDI: number;
    minusDI: number;
  };
}

export interface ATRResult extends BaseIndicatorResult {
  atr: number[];
  current: number;
}

export interface SMAResult extends BaseIndicatorResult {
  sma: number[];
  current: number;
}

export interface EMAResult extends BaseIndicatorResult {
  ema: number[];
  current: number;
}

export interface IchimokuResult extends BaseIndicatorResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
  current: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
  };
}

export type IndicatorResult = 
  | RSIResult 
  | MACDResult 
  | BollingerBandsResult 
  | StochasticResult 
  | ADXResult 
  | ATRResult 
  | SMAResult 
  | EMAResult 
  | IchimokuResult;

export type IndicatorCallback = (result: IndicatorResult) => void;

