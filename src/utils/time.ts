/**
 * Time utility functions
 */

/**
 * Get current timestamp in seconds (UTC)
 * Python SDK: calendar.timegm(time.gmtime())
 */
export function getTimestamp(): number {
  // Date.now() is always UTC, just convert to seconds
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp in milliseconds
 */
export function getTimestampMs(): number {
  return Date.now();
}

/**
 * Convert Date to timestamp in seconds
 */
export function dateToTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert timestamp in seconds to Date
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Get timestamp from X days ago
 */
export function getTimestampDaysAgo(days: number): number {
  const now = getTimestamp();
  const secondsInDay = 86400;
  return now - (days * secondsInDay);
}

/**
 * Get timestamp from X hours ago
 */
export function getTimestampHoursAgo(hours: number): number {
  const now = getTimestamp();
  const secondsInHour = 3600;
  return now - (hours * secondsInHour);
}

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(timestamp: number, includeSeconds: boolean = true): string {
  const date = timestampToDate(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  if (includeSeconds) {
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
}

/**
/**
 * Parse time string to timestamp
 * Format: "dd/mm HH:MM"
 */
export function parseTimeString(timeStr: string): number {
  if (typeof timeStr !== 'string') {
    throw new Error('Invalid input: timeStr must be a string');
  }
  const [datePart, timePart] = timeStr.split(' ');
  if (!datePart || !timePart) {
    throw new Error('Invalid format: expected "dd/mm HH:MM"');
  }
  const [dayStr, monthStr] = datePart.split('/');
  const [hourStr, minStr] = timePart.split(':');
  if (
    dayStr === undefined ||
    monthStr === undefined ||
    hourStr === undefined ||
    minStr === undefined
  ) {
    throw new Error('Invalid format: expected "dd/mm HH:MM"');
  }
  const day = Number(dayStr);
  const month = Number(monthStr); // 1-based
  const hours = Number(hourStr);
  const minutes = Number(minStr);

  if (
    isNaN(day) || isNaN(month) || isNaN(hours) || isNaN(minutes) ||
    day < 1 || month < 1 || month > 12 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59
  ) {
    throw new Error(`Invalid numbers in date string: "dd/mm HH:MM"`);
  }

  const now = new Date();
  const targetDate = new Date(
    now.getFullYear(),
    month - 1,
    day,
    hours,
    minutes,
    0
  );

  return dateToTimestamp(targetDate);
}

