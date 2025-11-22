/**
 * Common types used across the SDK
 */

export interface ConnectionResult {
  success: boolean;
  message?: string;
}

export interface QuotexConfig {
  email: string;
  password: string;
  lang?: 'en' | 'pt' | 'es';
  userAgent?: string;
  debug?: boolean;
}

export type Direction = 'call' | 'put';
export type AccountMode = 'PRACTICE' | 'REAL';
export type TimeMode = 'TIME' | 'TIMESTAMP';

export interface TimeRange {
  from: number;
  to: number;
}

export interface Pagination {
  offset: number;
  limit: number;
}

export type Unsubscribe = () => void;

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

