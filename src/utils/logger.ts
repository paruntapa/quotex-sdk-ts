/**
 * Logger utility using Bun's native console
 */

import type { Logger } from '../types';

export class ConsoleLogger implements Logger {
  constructor(private readonly isDebugEnabled: boolean = false) {}

  debug(message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

export function createLogger(debug: boolean = false): Logger {
  return new ConsoleLogger(debug);
}

