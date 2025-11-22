/**
 * HTTP client using Bun's native fetch
 */

import type { Logger } from '../../types';
import { QUOTEX_HTTPS_URL, DEFAULT_USER_AGENT } from '../../config/constants';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export class HttpClient {
  private defaultHeaders: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR,pt;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Ch-Ua': '"Chromium";v="120", "Google Chrome";v="120", "Not=A?Brand";v="8"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Dnt': '1',
    'Cache-Control': 'max-age=0',
  };

  private cookieJar: Map<string, string> = new Map();

  constructor(
    private readonly baseUrl: string = QUOTEX_HTTPS_URL,
    private readonly logger: Logger
  ) {}

  /**
   * Set default headers
   */
  setHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Parse and store cookies from Set-Cookie headers
   */
  private storeCookies(headers: Headers): void {
    // Use headers.getSetCookie() if available, otherwise fallback to extracting from raw headers (Bun)
    // @ts-ignore - getSetCookie is Bun-specific
    const setCookieHeaders: string[] = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie() || []
      : [];

    for (const cookie of setCookieHeaders) {
      if (!cookie) continue;
      // Only split at the first '=' in case value contains '='
      const firstSemi = cookie.indexOf(';');
      const cookieStr = firstSemi === -1 ? cookie : cookie.substring(0, firstSemi);
      const eqIdx = cookieStr.indexOf('=');
      if (eqIdx !== -1) {
        const name = cookieStr.substring(0, eqIdx).trim();
        const value = cookieStr.substring(eqIdx + 1).trim();
        if (name && value) {
          this.cookieJar.set(name, value);
        }
      }
    }
  }

  /**
   * Get all cookies as a Cookie header string
   */
  private getCookieHeader(): string {
    const cookies: string[] = [];
    this.cookieJar.forEach((value, name) => {
      // Only emit valid cookies
      if (name && value) cookies.push(`${name}=${value}`);
    });
    return cookies.join('; ');
  }

  /**
   * Make HTTP request using Bun's native fetch
   */
  async request<T = any>(
    endpoint: string,
    options: HttpRequestOptions = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const { method = 'GET', headers = {}, body, timeout = 30000 } = options;

    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Add cookies if we have any
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader && !requestHeaders['Cookie']) {
      requestHeaders['Cookie'] = cookieHeader;
    }

    this.logger.debug(`HTTP ${method} ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
      };

      if (body !== undefined && body !== null) {
        // Properly assign to valid BodyInit types
        if (
          typeof body === 'string' ||
          body instanceof Uint8Array ||
          body instanceof ArrayBuffer ||
          body instanceof Blob ||
          body instanceof FormData ||
          body instanceof URLSearchParams
        ) {
          fetchOptions.body = body as BodyInit;
        } else {
          fetchOptions.body = JSON.stringify(body);
          // If Content-Type is not set by user, default to JSON
          if (
            !Object.keys(requestHeaders)
              .map(k => k.toLowerCase())
              .includes('content-type')
          ) {
            fetchOptions.headers = {
              ...requestHeaders,
              'Content-Type': 'application/json',
            };
          }
        }
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // Store cookies from response
      this.storeCookies(response.headers);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // The type assertion below is necessary because TypeScript can't know what T is,
        // but since user asked to return T and APIs may return any JSON, this is reasonable.
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } catch (error: any) {
      this.logger.error(`HTTP request failed: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}
