/**
 * MACD (Moving Average Convergence Divergence) Calculator
 */

import type { Candle, MACDResult } from '../../../types';

export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
  timeframe: number
): MACDResult {
  const closes = candles.map(c => c.close);
  const timestamps = candles.map(c => c.time);

  // Guard: ensure we have enough data to compute EMAs
  if (closes.length === 0) {
    return {
      macd: [],
      signal: [],
      histogram: [],
      current: { macd: 0, signal: 0, histogram: 0 },
      timeframe,
      timestamps: [],
      historySize: 0,
    };
  }

  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  // Make sure emaFast and emaSlow have the same length, otherwise pad with first value or trim
  const minLength = Math.min(emaFast.length, emaSlow.length);
  const macdLine: number[] = [];
  for (let i = 0; i < minLength; i++) {
    const fastVal = emaFast[i] ?? 0;
    const slowVal = emaSlow[i] ?? 0;
    macdLine.push(fastVal - slowVal);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const histogram: number[] = [];
  // Align signalLine with macdLine's "tail" (rightmost values)
  for (let i = 0; i < signalLine.length; i++) {
    // corresponding MACD index, counting from the end
    const macdIdx = i + (macdLine.length - signalLine.length);
    const macdVal = macdLine[macdIdx] ?? 0;
    const signalVal = signalLine[i] ?? 0;
    histogram.push(macdVal - signalVal);
  }

  const current = {
    macd: macdLine[macdLine.length - 1] ?? 0,
    signal: signalLine[signalLine.length - 1] ?? 0,
    histogram: histogram[histogram.length - 1] ?? 0,
  };

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
    current,
    timeframe,
    timestamps: timestamps.slice(-macdLine.length),
    historySize: macdLine.length,
  };
}

// Defensive EMA: returns [] if not enough prices; always starts EMA with the first *defined* value.
function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0) return [];

  // Seed with first defined price, else 0
  const firstDefined = prices.find((v) => typeof v === 'number' && !isNaN(v));
  const start = (typeof firstDefined === 'number') ? firstDefined : 0;
  const emaArray: number[] = [start];
  const k = 2 / (period + 1);

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i] ?? 0;
    const prevEma = emaArray[i - 1] ?? start;
    const ema = price * k + prevEma * (1 - k);
    emaArray.push(ema);
  }

  return emaArray;
}

