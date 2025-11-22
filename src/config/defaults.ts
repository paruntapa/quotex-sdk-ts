/**
 * Default configuration values
 */

import type { QuotexConfig } from '../types';
import { DEFAULT_CONFIG, DEFAULT_USER_AGENT } from './constants';

export function getDefaultConfig(partial: Partial<QuotexConfig>): Required<QuotexConfig> {
  return {
    email: partial.email || '',
    password: partial.password || '',
    lang: partial.lang || DEFAULT_CONFIG.lang,
    userAgent: partial.userAgent || DEFAULT_USER_AGENT,
    debug: partial.debug ?? DEFAULT_CONFIG.debug,
  };
}

export const DEFAULT_INDICATOR_PARAMS = {
  RSI: { period: 14 },
  MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  BOLLINGER: { period: 20, std: 2 },
  STOCHASTIC: { kPeriod: 14, dPeriod: 3 },
  ADX: { period: 14 },
  ATR: { period: 14 },
  SMA: { period: 20 },
  EMA: { period: 20 },
  ICHIMOKU: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
} as const;

