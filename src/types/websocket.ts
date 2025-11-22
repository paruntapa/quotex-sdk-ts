/**
 * WebSocket-related type definitions
 */

export interface WebSocketConfig {
  url: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  debug?: boolean;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export type WebSocketEventType = 
  | 'open'
  | 'close'
  | 'error'
  | 'message'
  | 'ping'
  | 'pong';

export type WebSocketEventHandler = (data?: any) => void;

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error?: Error;
}

export interface SubscriptionOptions {
  channel: string;
  params?: Record<string, any>;
  callback?: (data: any) => void;
}

