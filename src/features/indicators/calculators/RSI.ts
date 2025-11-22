/**
 * RSI (Relative Strength Index) Calculator
 */

import type { Candle, RSIResult } from '../../../types';

export function calculateRSI(
  candles: Candle[],
  period: number = 14,
  timeframe: number
): RSIResult {
  const closes = candles.map(c => c.close);
  const timestamps = candles.map(c => c.time);
  
  const rsiValues: number[] = [];
  
  for (let i = period; i < closes.length; i++) {
    const slice = closes.slice(i - period, i + 1);
    const rsi = computeRSI(slice, period);
    rsiValues.push(rsi);
  }
  
  return {
    rsi: rsiValues,
    current: rsiValues[rsiValues.length - 1] || 50,
    timeframe,
    timestamps: timestamps.slice(period),
    historySize: rsiValues.length,
  };
}

function computeRSI(prices: number[] | undefined, period: number): number {
  if (!prices || prices.length < 2) {
    // Not enough data to compute RSI
    return 50;
  }
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1] ?? 0;
    const curr = prices[i] ?? 0;
    const difference = curr - prev;
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) {
    return 100;
  }
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

