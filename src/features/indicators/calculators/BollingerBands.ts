/**
 * Bollinger Bands Calculator
 */

import type { Candle, BollingerBandsResult } from '../../../types';

export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDev: number = 2,
  timeframe: number
): BollingerBandsResult {
  const closes = candles.map(c => c.close);
  const timestamps = candles.map(c => c.time);
  
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const std = calculateStdDev(slice, sma);
    
    middle.push(sma);
    upper.push(sma + (stdDev * std));
    lower.push(sma - (stdDev * std));
  }
  
  return {
    upper,
    middle,
    lower,
    current: {
      upper: upper[upper.length - 1] || 0,
      middle: middle[middle.length - 1] || 0,
      lower: lower[lower.length - 1] || 0,
    },
    timeframe,
    timestamps: timestamps.slice(period - 1),
    historySize: middle.length,
  };
}

function calculateStdDev(values: number[], mean: number): number {
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

