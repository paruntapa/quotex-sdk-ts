/**
 * Ichimoku Cloud Calculator
 * Ported from Python SDK - pyquotex/utils/indicators.py
 * 
 * @NEW_FUNCTION - Added in latest update to match Python SDK
 */

export interface IchimokuData {
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

/**
 * Calculate Donchian Channel (used for Ichimoku lines)
 */
function donchian(
  highs: number[],
  lows: number[],
  period: number
): number[] {
  const result: number[] = [];

  for (let i = 0; i <= highs.length - period; i++) {
    const highSlice = highs.slice(i, i + period);
    const lowSlice = lows.slice(i, i + period);

    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);

    result.push((highest + lowest) / 2);
  }

  return result;
}

/**
 * Calculate Ichimoku Cloud
 * Port of Python SDK's calculate_ichimoku function
 */
export function calculateIchimoku(
  highs: number[],
  lows: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): IchimokuData {
  if (highs.length < senkouBPeriod) {
    return {
      tenkan: [],
      kijun: [],
      senkouA: [],
      senkouB: [],
      chikou: [],
      current: {
        tenkan: 0,
        kijun: 0,
        senkouA: 0,
        senkouB: 0,
        chikou: 0,
      },
    };
  }

  // Calculate lines using Donchian Channel
  const tenkan = donchian(highs, lows, tenkanPeriod);
  const kijun = donchian(highs, lows, kijunPeriod);
  const senkouB = donchian(highs, lows, senkouBPeriod);

  // Senkou Span A (average of Tenkan and Kijun)
  const senkouA: number[] = [];
  const minLength = Math.min(tenkan.length, kijun.length);
  for (let i = 0; i < minLength; i++) {
    senkouA.push((tenkan[i]! + kijun[i]!) / 2);
  }

  // Chikou Span (closing prices shifted back by kijun period)
  const chikou = lows.slice(kijunPeriod);

  // Round all values to 2 decimal places
  const roundValues = (arr: number[]) => arr.map(v => Math.round(v * 100) / 100);

  return {
    tenkan: roundValues(tenkan),
    kijun: roundValues(kijun),
    senkouA: roundValues(senkouA),
    senkouB: roundValues(senkouB),
    chikou: roundValues(chikou),
    current: {
      tenkan: tenkan[tenkan.length - 1] || 0,
      kijun: kijun[kijun.length - 1] || 0,
      senkouA: senkouA[senkouA.length - 1] || 0,
      senkouB: senkouB[senkouB.length - 1] || 0,
      chikou: chikou[chikou.length - 1] || 0,
    },
  };
}

