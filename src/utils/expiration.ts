/**
 * Expiration time calculation utilities
 */

import { timestampToDate } from './time';

/**
 * Calculate expiration time for a Quotex operation (UTC)
 * Python SDK: get_expiration_time_quotex with UTC time
 */
export function getExpirationTime(timestamp: number, duration: number): number {
  // Work with UTC time only
  const date = new Date(timestamp * 1000);
  
  // For durations < 60s
  if (duration < 60) {
    const shift = date.getUTCSeconds() >= 30 ? 1 : 0;
    date.setUTCSeconds(0, 0);
    date.setUTCMinutes(date.getUTCMinutes() + shift + 1);
    return Math.floor(date.getTime() / 1000);
  }
  
  // For durations >= 60s
  const midnight = new Date(date);
  midnight.setUTCHours(0, 0, 0, 0);
  
  const secondsSinceMidnight = Math.floor((date.getTime() - midnight.getTime()) / 1000);
  const remainder = secondsSinceMidnight % duration;
  const step = remainder > (duration / 2) ? 2 : 1;
  const nextValid = (Math.floor(secondsSinceMidnight / duration) + step) * duration;
  
  const expirationTime = new Date(midnight.getTime() + nextValid * 1000);
  return Math.floor(expirationTime.getTime() / 1000);
}

/**
 * Get next timeframe based on current time
 */
export function getNextTimeframe(
  timestamp: number,
  timeframe: number,
  openTime?: string
): string {
  const date = timestampToDate(timestamp);
  
  if (openTime) {
    return openTime;
  }
  
  // Calculate next timeframe boundary
  const timeframeMinutes = timeframe / 60;
  const currentMinutes = date.getMinutes();
  const nextMinutes = Math.ceil((currentMinutes + 1) / timeframeMinutes) * timeframeMinutes;
  
  date.setMinutes(nextMinutes, 0, 0);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * Check if time is within trading hours
 */
export function isWithinTradingHours(timestamp: number): boolean {
  const date = timestampToDate(timestamp);
  const dayOfWeek = date.getDay();
  const hours = date.getHours();
  
  // Monday-Friday, 00:00-23:59
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return true;
  }
  
  // Weekend - limited hours or closed depending on asset
  return false;
}

/**
 * Calculate remaining time until expiration
 */
export function getRemainingTime(expirationTime: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, expirationTime - now);
}

