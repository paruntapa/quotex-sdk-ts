/**
 * ADX (Average Directional Index) Calculator
 * Ported from Python SDK - pyquotex/utils/indicators.py
 * 
 * @NEW_FUNCTION - Added in latest update to match Python SDK
 */

import { calculateSMA } from './index';

export interface ADXData {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  current: {
    adx: number;
    plusDI: number;
    minusDI: number;
  };
}

/**
 * Calculate Average Directional Index (ADX)
 * Port of Python SDK's calculate_adx function
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXData {
  if (highs.length < period + 1) {
    return {
      adx: [],
      plusDI: [],
      minusDI: [],
      current: { adx: 0, plusDI: 0, minusDI: 0 },
    };
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  // Calculate True Range and Directional Movement
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i]!;
    const low = lows[i]!;
    const prevHigh = highs[i - 1]!;
    const prevLow = lows[i - 1]!;
    const prevClose = closes[i - 1]!;

    // True Range
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    tr.push(Math.max(tr1, tr2, tr3));

    // Directional Movement
    const plusDM1 = high - prevHigh;
    const minusDM1 = prevLow - low;

    if (plusDM1 > minusDM1 && plusDM1 > 0) {
      plusDM.push(plusDM1);
    } else {
      plusDM.push(0);
    }

    if (minusDM1 > plusDM1 && minusDM1 > 0) {
      minusDM.push(minusDM1);
    } else {
      minusDM.push(0);
    }
  }

  // Calculate smoothed averages
  let trAvg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let plusDMAvg = plusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let minusDMAvg = minusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const trAvgs: number[] = [trAvg];
  const plusDIValues: number[] = [(plusDMAvg * 100) / trAvg];
  const minusDIValues: number[] = [(minusDMAvg * 100) / trAvg];

  // Calculate smoothed DI values
  for (let i = period; i < tr.length; i++) {
    trAvg = (trAvg * (period - 1) + tr[i]!) / period;
    plusDMAvg = (plusDMAvg * (period - 1) + plusDM[i]!) / period;
    minusDMAvg = (minusDMAvg * (period - 1) + minusDM[i]!) / period;

    trAvgs.push(trAvg);
    plusDIValues.push((plusDMAvg * 100) / trAvg);
    minusDIValues.push((minusDMAvg * 100) / trAvg);
  }

  // Calculate DX values
  const dxValues: number[] = [];
  for (let i = 0; i < plusDIValues.length; i++) {
    const plusDI = plusDIValues[i]!;
    const minusDI = minusDIValues[i]!;
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    dxValues.push(dx);
  }

  // Calculate ADX (smoothed DX)
  let adxValue = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const adxValues: number[] = [adxValue];

  for (let i = period; i < dxValues.length; i++) {
    adxValue = (adxValue * (period - 1) + dxValues[i]!) / period;
    adxValues.push(Math.round(adxValue * 100) / 100);
  }

  return {
    adx: adxValues,
    plusDI: plusDIValues.map(v => Math.round(v * 100) / 100),
    minusDI: minusDIValues.map(v => Math.round(v * 100) / 100),
    current: {
      adx: adxValues[adxValues.length - 1] || 0,
      plusDI: plusDIValues[plusDIValues.length - 1] || 0,
      minusDI: minusDIValues[minusDIValues.length - 1] || 0,
    },
  };
}

