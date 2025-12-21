/**
 * Technical Indicator Calculators Export
 */

export { calculateRSI } from './RSI';
export { calculateMACD } from './MACD';
export { calculateBollingerBands } from './BollingerBands';
export { calculateADX } from './ADX';
export { calculateIchimoku } from './Ichimoku';

// Simple Moving Average
export function calculateSMA(values: number[], period: number): number[] {
  const sma: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  
  return sma;
}

// Exponential Moving Average
export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  // Defensive: first value is values[0] if a finite number, else 0
  const firstValue = typeof values[0] === 'number' && !isNaN(values[0]) ? values[0] : 0;
  const ema: number[] = [firstValue];
  
  for (let i = 1; i < values.length; i++) {
    const price = typeof values[i] === 'number' && !isNaN(values[i] || 0) ? values[i] : 0;
    const prevEma = ema[i - 1] !== undefined ? ema[i - 1] : firstValue;

    if (!price || !prevEma) {
      throw new Error("price or prevEma is undefined")
    }

    const value = price * k + prevEma * (1 - k);
    ema.push(value);
  }
  
  return ema;
}

// Average True Range
export function calculateATR(
  high: number[],
  low: number[],
  close: number[],
  period: number
): number[] {
  const tr: number[] = [];
  
  for (let i = 1; i < high.length; i++) {
    // Defensive: ensure indices are defined
    const hi = typeof high[i] === 'number' ? high[i]! : 0;
    const li = typeof low[i] === 'number' ? low[i]! : 0;
    const hiPrev = typeof high[i] === 'number' ? high[i]! : 0;
    const ciPrev = typeof close[i - 1] === 'number' ? close[i - 1]! : 0;
    const liPrev = typeof low[i] === 'number' ? low[i]! : 0;

    const hl = hi - li;
    const hc = Math.abs(hiPrev - ciPrev);
    const lc = Math.abs(liPrev - ciPrev);
    tr.push(Math.max(hl, hc, lc));
  }
  
  return calculateSMA(tr, period);
}

// Stochastic Oscillator
export function calculateStochastic(
  high: number[],
  low: number[],
  close: number[],
  kPeriod: number,
  dPeriod: number
): { k: number[]; d: number[] } {
  const k: number[] = [];
  
  for (let i = kPeriod - 1; i < close.length; i++) {
    // Defensive: slice may contain undefined if arrays are short or have gaps
    const highSlice = high.slice(i - kPeriod + 1, i + 1).filter(v => typeof v === 'number' && !isNaN(v));
    const lowSlice = low.slice(i - kPeriod + 1, i + 1).filter(v => typeof v === 'number' && !isNaN(v));
    const c = typeof close[i] === 'number' ? close[i]! : 0;

    const highestHigh = highSlice.length > 0 ? Math.max(...highSlice) : 0;
    const lowestLow = lowSlice.length > 0 ? Math.min(...lowSlice) : 0;

    if (highestHigh === lowestLow) {
      k.push(50);
    } else {
      const kValue = ((c - lowestLow) / (highestHigh - lowestLow)) * 100;
      k.push(kValue);
    }
  }
  
  const d = calculateSMA(k, dPeriod);
  
  return { k, d };
}

