/**
 * Authentication handler
 * Matches Python SDK endpoints exactly
 */

import { HttpClient } from './HttpClient';
import { BrowserAuth } from './BrowserAuth';
import type { Logger } from '../../types';
import { QUOTEX_HTTPS_URL } from '../../config/constants';

export interface LoginCredentials {
  email: string;
  password: string;
  lang?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  cookies?: string;
  message?: string;
}

export class AuthClient {
  private browserAuth: BrowserAuth | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly logger: Logger,
    private readonly lang: string = 'en',
    private readonly useBrowser: boolean = true,
    private readonly browserHeadless: boolean = true
  ) {
    if (this.useBrowser) {
      this.browserAuth = new BrowserAuth(this.logger, this.lang, {
        headless: this.browserHeadless,
        debug: !this.browserHeadless, // Show logs when visible
      });
    }
  }

  /**
   * Get CSRF token from login page
   * Matches: login.py get_token() method
   */
  async getToken(): Promise<string | null> {
    try {
      const response = await this.http.get(
        `/${this.lang}/sign-in/modal/`,
        {
          'Referer': `${QUOTEX_HTTPS_URL}/${this.lang}/sign-in`,
        }
      );
      
      // Parse HTML to extract _token
      if (typeof response === 'string') {
        const tokenMatch = response.match(/<input[^>]*name="_token"[^>]*value="([^"]*)"[^>]*>/);
        if (tokenMatch && tokenMatch[1]) {
          return tokenMatch[1];
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Login to Quotex platform
   * Tries HTTP first, falls back to browser automation if blocked
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Try HTTP login first
    const httpResult = await this.loginViaHTTP(credentials);
    
    if (httpResult.success) {
      return httpResult;
    }

    // If HTTP fails with 403 or similar, try browser automation
    if (this.browserAuth && (httpResult.message?.includes('403') || httpResult.message?.includes('Forbidden'))) {
      this.logger.warn('HTTP login blocked, trying browser automation...');
      return await this.loginViaBrowser(credentials);
    }

    return httpResult;
  }

  /**
   * Login via HTTP (direct requests)
   * Matches: login.py _post() and __call__() methods
   */
  private async loginViaHTTP(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      this.logger.info('Attempting HTTP login...');

      // Get CSRF token first
      const token = await this.getToken();
      if (!token) {
        this.logger.warn('Could not retrieve CSRF token, attempting login anyway...');
      }

      // Prepare form data (matches Python SDK)
      const formData = new URLSearchParams({
        _token: token || '',
        email: credentials.email,
        password: credentials.password,
        remember: '1',
      });

      // Login endpoint: /{lang}/sign-in/
      const response = await this.http.request<any>(
        `/${this.lang}/sign-in/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${QUOTEX_HTTPS_URL}/${this.lang}/sign-in/modal`,
            'Origin': QUOTEX_HTTPS_URL,
          },
          body: formData.toString(),
        }
      );

      // Check if redirected to /trade (successful login)
      if (response && typeof response === 'object') {
        // Try to get profile/session data
        const profileResponse = await this.getProfile();
        
        if (profileResponse.token) {
          this.logger.info('HTTP login successful');
          return {
            success: true,
            token: profileResponse.token,
            cookies: profileResponse.cookies,
            message: 'Login successful',
          };
        }
      }

      this.logger.warn('HTTP login failed');
      return {
        success: false,
        message: 'Login failed',
      };
    } catch (error) {
      this.logger.error('HTTP login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Login via browser automation (Puppeteer)
   * Used when HTTP requests are blocked by anti-bot protection
   */
  private async loginViaBrowser(credentials: LoginCredentials): Promise<LoginResponse> {
    if (!this.browserAuth) {
      return {
        success: false,
        message: 'Browser authentication not available',
      };
    }

    try {
      const result = await this.browserAuth.login(credentials.email, credentials.password);

      if (result.success) {
        this.logger.info('Browser login successful');
        
        // Update HTTP client with browser cookies
        if (result.cookies) {
          this.http.setHeaders({
            'Cookie': result.cookies,
          });
        }

        return {
          success: true,
          token: result.token,
          cookies: result.cookies,
          message: result.message || 'Login successful via browser',
        };
      }

      return {
        success: false,
        message: result.message || 'Browser login failed',
      };
    } catch (error) {
      this.logger.error('Browser login error:', error);
      return {
        success: false,
        message: String(error),
      };
    }
  }

  /**
   * Get profile and extract session token
   * Matches: login.py get_profile() method
   */
  async getProfile(): Promise<{ token?: string; cookies?: string; profile?: any }> {
    try {
      const response = await this.http.get(`/${this.lang}/trade`);
      
      if (typeof response === 'string') {
        // Extract window.settings from script tag
        const scriptMatch = response.match(/window\.settings\s*=\s*({[\s\S]*?});/);
        
        if (scriptMatch && scriptMatch[1]) {
          try {
            const settings = JSON.parse(scriptMatch[1]);
            return {
              token: settings.token,
              profile: settings,
            };
          } catch (e) {
            this.logger.error('Failed to parse settings:', e);
          }
        }
      }
      
      return {};
    } catch (error) {
      this.logger.error('Failed to get profile:', error);
      return {};
    }
  }

  /**
   * Logout from platform
   * Matches: logout.py __call__() method
   * Endpoint: https://qxbroker.com/{lang}/logout
   */
  async logout(): Promise<boolean> {
    try {
      this.logger.info('Logging out...');
      
      // Logout endpoint: /{lang}/logout
      await this.http.get(`/${this.lang}/logout`, {
        'Referer': `${this.http['baseUrl']}/${this.lang}/trade`,
      });
      
      return true;
    } catch (error) {
      this.logger.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await this.http.get<any>('/api/v1/verify', {
        Authorization: `Bearer ${token}`,
      });
      return response.valid === true;
    } catch (error) {
      this.logger.error('Token verification error:', error);
      return false;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(token: string): Promise<string | null> {
    try {
      const response = await this.http.post<any>('/api/v1/refresh', { token });
      return response.token || null;
    } catch (error) {
      this.logger.error('Token refresh error:', error);
      return null;
    }
  }
}

