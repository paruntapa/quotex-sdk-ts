/**
 * Account management operations
 */

import type { Logger, Profile, BalanceInfo, AccountMode, AccountSettings } from '../../types';
import { WebSocketManager } from '../../core/websocket/WebSocketManager';

export class AccountManager {
  private profile: Profile | null = null;
  private balanceInfo: BalanceInfo = {
    mode: 'PRACTICE',
    balance: 0,
  };
  private settings: AccountSettings = {
    mode: 'PRACTICE',
  };

  constructor(
    private readonly ws: WebSocketManager,
    private readonly logger: Logger
  ) {
    this.setupAccountHandlers();
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<Profile | null> {
    if (this.profile) {
      return { ...this.profile };
    }

    // Request profile data
    const message = '42["profile/get"]';
    this.ws.send(message);

    // Wait for profile data
    return this.waitForProfile(5000);
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    return this.balanceInfo.balance;
  }

  /**
   * Get balance info
   */
  getBalanceInfo(): BalanceInfo {
    return { ...this.balanceInfo };
  }

  /**
   * Set account mode (PRACTICE or REAL)
   */
  setAccountMode(mode: AccountMode): void {
    this.logger.info(`Setting account mode to ${mode}`);
    this.settings.mode = mode;
    this.balanceInfo.mode = mode;

    // Send mode change request (matches Python SDK)
    const payload = {
      demo: mode === 'PRACTICE' ? 1 : 0,
      tournamentId: 0,
    };
    const message = `42["account/change",${JSON.stringify(payload)}]`;
    this.ws.send(message);
  }

  /**
   * Change account (switch between PRACTICE and REAL)
   */
  async changeAccount(mode: AccountMode): Promise<boolean> {
    try {
      this.setAccountMode(mode);
      await Bun.sleep(1000); // Wait for mode change
      return true;
    } catch (error) {
      this.logger.error('Failed to change account:', error);
      return false;
    }
  }

  /**
   * Edit practice balance (demo account only)
   */
  async editPracticeBalance(amount: number): Promise<boolean> {
    if (this.settings.mode !== 'PRACTICE') {
      this.logger.warn('Can only edit practice balance in PRACTICE mode');
      return false;
    }

    try {
      this.logger.info(`Setting practice balance to ${amount}`);

      // Python SDK sends amount directly, not in object
      const message = `42["demo/refill",${JSON.stringify(amount)}]`;
      this.ws.send(message);

      await Bun.sleep(1000);
      return true;
    } catch (error) {
      this.logger.error('Failed to edit practice balance:', error);
      return false;
    }
  }

  /**
   * Get account settings
   */
  getSettings(): AccountSettings {
    return { ...this.settings };
  }

  /**
   * Update account settings
   */
  updateSettings(partial: Partial<AccountSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };

    // Send settings update
    const message = `42["settings/update",${JSON.stringify(this.settings)}]`;
    this.ws.send(message);
  }

  /**
   * Get current account mode
   */
  getAccountMode(): AccountMode {
    return this.settings.mode;
  }

  /**
   * Check if in demo mode
   */
  isDemoMode(): boolean {
    return this.settings.mode === 'PRACTICE';
  }

  /**
   * Check if in real mode
   */
  isRealMode(): boolean {
    return this.settings.mode === 'REAL';
  }

  /**
   * Setup WebSocket handlers for account events
   */
  private setupAccountHandlers(): void {
    // Profile updates
    this.ws.subscribe('profile', (data) => {
      this.handleProfileUpdate(data);
    });

    // Balance updates
    this.ws.subscribe('balance', (data) => {
      this.handleBalanceUpdate(data);
    });

    // Account mode updates
    this.ws.subscribe('account/mode', (data) => {
      this.handleAccountModeUpdate(data);
    });

    // Authorization updates (includes profile)
    this.ws.subscribe('authorization', (data) => {
      if (data.profile) {
        this.handleProfileUpdate(data.profile);
      }
      if (data.balance !== undefined) {
        this.handleBalanceUpdate(data);
      }
    });
  }

  /**
   * Handle profile update
   */
  private handleProfileUpdate(data: any): void {
    if (!data) return;

    this.profile = {
      nickName: data.nickName || data.nick_name || data.username,
      email: data.email,
      profileId: data.profileId || data.profile_id || data.id,
      demoBalance: data.demoBalance || data.demo_balance || 0,
      liveBalance: data.liveBalance || data.live_balance || 0,
      avatar: data.avatar,
      countryName: data.countryName || data.country_name || data.country,
      timezone: data.timezone || data.tz,
      offset: data.offset || 0,
    };

    // Update balance based on current mode
    this.updateBalanceFromProfile();

    this.logger.debug('Profile updated:', this.profile);
  }

  /**
   * Handle balance update
   */
  private handleBalanceUpdate(data: any): void {
    if (data.balance !== undefined) {
      this.balanceInfo.balance = data.balance;
      this.logger.debug(`Balance updated: ${data.balance}`);
    }

    if (data.liveBalance !== undefined || data.demoBalance !== undefined) {
      this.updateBalanceFromProfile();
    }
  }

  /**
   * Handle account mode update
   */
  private handleAccountModeUpdate(data: any): void {
    if (data.demo !== undefined) {
      const mode = data.demo === 1 ? 'PRACTICE' : 'REAL';
      this.settings.mode = mode;
      this.balanceInfo.mode = mode;
      this.updateBalanceFromProfile();
      this.logger.info(`Account mode changed to ${mode}`);
    } else if (data.mode) {
      this.settings.mode = data.mode;
      this.balanceInfo.mode = data.mode;
      this.updateBalanceFromProfile();
      this.logger.info(`Account mode changed to ${data.mode}`);
    }
  }

  /**
   * Update balance from profile based on current mode
   */
  private updateBalanceFromProfile(): void {
    if (!this.profile) return;

    if (this.settings.mode === 'PRACTICE') {
      this.balanceInfo.balance = this.profile.demoBalance;
    } else {
      this.balanceInfo.balance = this.profile.liveBalance;
    }
  }

  /**
   * Wait for profile data
   */
  private async waitForProfile(timeout: number): Promise<Profile | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.profile) {
        return { ...this.profile };
      }
      await Bun.sleep(100);
    }

    return null;
  }
}

