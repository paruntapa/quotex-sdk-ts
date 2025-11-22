/**
 * Technical Indicators Manager
 */

import type {
  Logger,
  Candle,
  IndicatorOptions,
  IndicatorResult,
  RSIResult,
  MACDResult,
  BollingerBandsResult,
  SMAResult,
  EMAResult,
  ATRResult,
  StochasticResult,
} from '../../types';
import { DEFAULT_INDICATOR_PARAMS } from '../../config/defaults';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateSMA,
  calculateEMA,
  calculateATR,
  calculateStochastic,
} from './calculators';

// Define a stricter mapping for indicator params types
type IndicatorParamsMap = {
  RSI: { period: number };
  MACD: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
  BOLLINGER: { period: number; std: number };
  SMA: { period: number };
  EMA: { period: number };
  ATR: { period: number };
  STOCHASTIC: { kPeriod: number; dPeriod: number };
};

export class IndicatorManager {
  constructor(private readonly logger: Logger) {}

  /**
   * Calculate indicator based on type
   */
  async calculate(candles: Candle[], options: IndicatorOptions): Promise<IndicatorResult> {
    const { indicator, params = {}, timeframe } = options;

    this.logger.debug(`Calculating ${indicator} for timeframe ${timeframe}`);

    // Get default params and merge with provided params
    const defaultParams = DEFAULT_INDICATOR_PARAMS[indicator] || {};
    const finalParams = { ...defaultParams, ...params };

    switch (indicator) {
      case 'RSI': {
        const { period } = finalParams as IndicatorParamsMap['RSI'];
        return this.calculateRSI(candles, period, timeframe);
      }
      case 'MACD': {
        const { fastPeriod, slowPeriod, signalPeriod } = finalParams as IndicatorParamsMap['MACD'];
        return this.calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod, timeframe);
      }
      case 'BOLLINGER': {
        const { period, std } = finalParams as IndicatorParamsMap['BOLLINGER'];
        return this.calculateBollingerBands(candles, period, std, timeframe);
      }
      case 'SMA': {
        const { period } = finalParams as IndicatorParamsMap['SMA'];
        return this.calculateSMA(candles, period, timeframe);
      }
      case 'EMA': {
        const { period } = finalParams as IndicatorParamsMap['EMA'];
        return this.calculateEMA(candles, period, timeframe);
      }
      case 'ATR': {
        const { period } = finalParams as IndicatorParamsMap['ATR'];
        return this.calculateATR(candles, period, timeframe);
      }
      case 'STOCHASTIC': {
        const { kPeriod, dPeriod } = finalParams as IndicatorParamsMap['STOCHASTIC'];
        return this.calculateStochastic(candles, kPeriod, dPeriod, timeframe);
      }
      default:
        throw new Error(`Unsupported indicator: ${indicator}`);
    }
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(
    candles: Candle[],
    period: number,
    timeframe: number
  ): RSIResult {
    return calculateRSI(candles, period, timeframe);
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(
    candles: Candle[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
    timeframe: number
  ): MACDResult {
    return calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod, timeframe);
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    candles: Candle[],
    period: number,
    std: number,
    timeframe: number
  ): BollingerBandsResult {
    return calculateBollingerBands(candles, period, std, timeframe);
  }

  /**
   * Calculate SMA
   */
  private calculateSMA(
    candles: Candle[],
    period: number,
    timeframe: number
  ): SMAResult {
    const closes = candles.map(c => c.close);
    const timestamps = candles.map(c => c.time);
    const sma = calculateSMA(closes, period);

    return {
      sma,
      current: sma[sma.length - 1] || 0,
      timeframe,
      timestamps: timestamps.slice(period - 1),
      historySize: sma.length,
    };
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(
    candles: Candle[],
    period: number,
    timeframe: number
  ): EMAResult {
    const closes = candles.map(c => c.close);
    const timestamps = candles.map(c => c.time);
    const ema = calculateEMA(closes, period);

    return {
      ema,
      current: ema[ema.length - 1] || 0,
      timeframe,
      timestamps,
      historySize: ema.length,
    };
  }

  /**
   * Calculate ATR
   */
  private calculateATR(
    candles: Candle[],
    period: number,
    timeframe: number
  ): ATRResult {
    const high = candles.map(c => c.high);
    const low = candles.map(c => c.low);
    const close = candles.map(c => c.close);
    const timestamps = candles.map(c => c.time);

    const atr = calculateATR(high, low, close, period);

    return {
      atr,
      current: atr[atr.length - 1] || 0,
      timeframe,
      timestamps: timestamps.slice(period),
      historySize: atr.length,
    };
  }

  /**
   * Calculate Stochastic
   */
  private calculateStochastic(
    candles: Candle[],
    kPeriod: number,
    dPeriod: number,
    timeframe: number
  ): StochasticResult {
    const high = candles.map(c => c.high);
    const low = candles.map(c => c.low);
    const close = candles.map(c => c.close);
    const timestamps = candles.map(c => c.time);

    const { k, d } = calculateStochastic(high, low, close, kPeriod, dPeriod);

    return {
      k,
      d,
      current: {
        k: k[k.length - 1] || 50,
        d: d[d.length - 1] || 50,
      },
      timeframe,
      timestamps: timestamps.slice(kPeriod - 1),
      historySize: k.length,
    };
  }
}
