/**
 * SDK Constants
 * URLs matching the Python SDK exactly
 */

export const QUOTEX_HOST = 'qxbroker.com';
export const QUOTEX_HTTPS_URL = `https://${QUOTEX_HOST}`;
export const QUOTEX_WSS_URL = `wss://ws2.${QUOTEX_HOST}/socket.io/?EIO=3&transport=websocket`;

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const TIMEFRAMES = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H2: 7200,
  H4: 14400,
  D1: 86400,
} as const;

export const VALID_PERIODS = [
  5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 86400
] as const;

export const DEFAULT_CONFIG = {
  lang: 'en',
  debug: false,
  reconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 5000,
  accountMode: 'PRACTICE',
} as const;

export const WEBSOCKET_EVENTS = {
  OPEN: 'open',
  CLOSE: 'close',
  ERROR: 'error',
  MESSAGE: 'message',
  PING: 'ping',
  PONG: 'pong',
} as const;

export const CHANNELS = {
  AUTHORIZATION: 'authorization',
  INSTRUMENTS: 'instruments',
  CANDLES: 'candles',
  DEPTH: 'depth',
  SETTINGS: 'settings',
  PENDING: 'pending',
  SELL_OPTION: 'sell_option',
  CHART_NOTIFICATION: 'chart_notification',
} as const;

