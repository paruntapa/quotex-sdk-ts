/**
 * Browser-based authentication using Playwright
 * Used to bypass anti-bot protection
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { Logger } from '../../types';
import { QUOTEX_HTTPS_URL } from '../../config/constants';

export interface BrowserLoginResult {
  success: boolean;
  token?: string;
  cookies?: string;
  userAgent?: string;
  message?: string;
}

export interface BrowserAuthOptions {
  headless?: boolean;
  timeout?: number;
  debug?: boolean;
}

export class BrowserAuth {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly lang: string = 'en',
    private readonly options: BrowserAuthOptions = {}
  ) {
    this.options = {
      headless: true,
      timeout: 60000,
      debug: false,
      ...options,
    };
  }

  /**
   * Initialize browser with Playwright
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.logger.info('Launching Playwright browser for authentication...');

    // Launch Chromium browser with stealth settings
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    // Create a new context with stealth settings
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Create a new page
    this.page = await this.context.newPage();

    // Remove automation indicators using addInitScript (Playwright's equivalent of evaluateOnNewDocument)
    await this.page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock chrome object
      Object.defineProperty((window as any), 'chrome', {
        value: { runtime: {} },
        configurable: true,
      });

      // Mock permissions
      const originalQuery = navigator.permissions && navigator.permissions.query;
      if (originalQuery) {
        (navigator.permissions as any).query = function (parameters: any) {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ 
              state: typeof Notification !== 'undefined' ? Notification.permission : 'default' 
            });
          }
          return originalQuery.call(this, parameters);
        };
      }

      // Add plugin mock
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock language
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    if (this.options.debug) {
      this.page.on('console', (msg: any) => {
        this.logger.debug(`Browser console: ${msg.text()}`);
      });
    }
  }

  /**
   * Login using browser automation
   */
  async login(email: string, password: string): Promise<BrowserLoginResult> {
    try {
      await this.initBrowser();

      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      const loginUrl = `${QUOTEX_HTTPS_URL}/${this.lang}/sign-in/`;
      
      if (!this.options.headless) {
        this.logger.info('🔍 VISIBLE MODE: Watch the browser window!');
        this.logger.info('The browser will:');
        this.logger.info('  1. Navigate to login page');
        this.logger.info('  2. Fill in email');
        this.logger.info('  3. Fill in password');
        this.logger.info('  4. Click submit');
        this.logger.info('  5. Extract session data');
      }
      
      this.logger.info(`Navigating to ${loginUrl}`);

      // Navigate to login page
      await this.page.goto(loginUrl, {
        waitUntil: 'networkidle',
        timeout: this.options.timeout,
      });

      // Wait for the page to fully load and for the modal to appear
      this.logger.info('⏳ Waiting for login form...');
      
      // Wait for the login modal/form to be visible (check for the active tab)
      await this.page.waitForSelector('.tabs__item.active', {
        state: 'visible',
        timeout: this.options.timeout,
      });

      // Extra wait for any animations
      await this.page.waitForTimeout(1500);
      
      // Now find the visible email input within the active tab
      const emailInput = this.page.locator('.tabs__item.active input[name="email"]');

      // Fill in email using Playwright's fill method
      this.logger.info('📧 Filling email...');
      await emailInput.clear();
      await emailInput.fill(email);
      
      // Type with delay for more human-like behavior
      if (!this.options.headless) {
        await this.page.waitForTimeout(500);
      }

      // Fill in password
      this.logger.info('🔒 Filling password...');
      
      // Use the password input within the same active tab
      const passwordInput = this.page.locator('.tabs__item.active input[name="password"]');
      await passwordInput.clear();
      await passwordInput.fill(password);

      // Wait a bit for form validation
      await this.page.waitForTimeout(this.options.headless ? 1000 : 2000);

      // Click submit button
      this.logger.info('🚀 Submitting login form...');
      
      try {
        // Wait for the submit button within the active tab
        const submitButton = this.page.locator('.tabs__item.active button.modal-sign__block-button');
        await submitButton.waitFor({ state: 'visible', timeout: 5000 });
        
        this.logger.info('✅ Found submit button, clicking...');
        
        // Click the button
        await submitButton.click();
      } catch (error) {
        this.logger.warn('⚠️  Submit button click failed, trying form submission...');
        
        // Alternative: Submit the form directly or press Enter
        await this.page.evaluate(() => {
          const form = document.querySelector('form');
          if (form && typeof (form as HTMLFormElement).submit === 'function') {
            (form as HTMLFormElement).submit();
          } else {
            // Last resort: press Enter
            const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
            if (passwordInput) {
              const evt = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
              passwordInput.dispatchEvent(evt);
            }
          }
        });
      }
      
      if (!this.options.headless) {
        this.logger.info('⏳ Keeping browser open for 5 seconds so you can see the result...');
      }

      // Wait for navigation or error message
      this.logger.info('⏳ Waiting for login result...');
      
      // Wait for either success (redirect to /trade) or error message
      const waitTime = this.options.headless ? 3000 : 5000;
      await this.page.waitForTimeout(waitTime);

      // Check if login was successful
      const currentUrl = this.page.url();
      this.logger.info(`📍 Current URL after login: ${currentUrl}`);

      if (currentUrl.includes('/trade')) {
        this.logger.info('✅ Login successful! Extracting session data...');

        // Extract session token from window.settings
        const token = await this.page.evaluate(() => {
          try {
            return typeof window !== 'undefined' && (window as any).settings?.token ? (window as any).settings.token : null;
          } catch {
            return null;
          }
        });

        // Get cookies from context
        const cookies = await this.context!.cookies();
        const cookieString = cookies
          .map((cookie: any) => `${cookie.name}=${cookie.value}`)
          .join('; ');

        // Get user agent
        const userAgent = await this.page.evaluate(() => navigator.userAgent);

        await this.close();

        return {
          success: true,
          token: token || undefined,
          cookies: cookieString,
          userAgent,
          message: 'Login successful via browser',
        };
      } else {
        // Check for error message
        let errorMessage = 'Login failed';
        
        try {
          const errorElement = this.page.locator('.hint--danger, .input-control-cabinet__hint').first();
          if (await errorElement.isVisible()) {
            const text = await errorElement.textContent();
            if (text) {
              errorMessage = text.trim();
            }
          }
        } catch {
          // No error element found, use default message
        }

        await this.close();

        return {
          success: false,
          message: errorMessage,
        };
      }
    } catch (error: any) {
      this.logger.error('Browser login error:', error);
      await this.close();

      return {
        success: false,
        message: `Browser login failed: ${error && error.message ? error.message : error}`,
      };
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      this.logger.debug('Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }
}
