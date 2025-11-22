/**
 * Session management for persistent authentication
 */

import type { Logger } from '../../types';

export interface SessionData {
  token?: string;
  cookies?: string;
  userAgent: string;
  timestamp: number;
}

export class SessionManager {
  private sessionFile = 'quotex-session.json';
  private session: SessionData | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly sessionPath?: string
  ) {
    if (sessionPath) {
      this.sessionFile = sessionPath;
    }
  }

  /**
   * Load session from file using Bun's native file API
   */
  async load(): Promise<SessionData | null> {
    try {
      const file = Bun.file(this.sessionFile);
      
      if (await file.exists()) {
        const content = await file.text();
        this.session = JSON.parse(content);
        this.logger.debug('Session loaded from file');
        return this.session;
      }
    } catch (error) {
      this.logger.warn('Failed to load session:', error);
    }
    
    return null;
  }

  /**
   * Save session to file using Bun's native file API
   */
  async save(session: SessionData): Promise<void> {
    try {
      this.session = session;
      await Bun.write(this.sessionFile, JSON.stringify(session, null, 2));
      this.logger.debug('Session saved to file');
    } catch (error) {
      this.logger.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Update existing session
   */
  async update(partial: Partial<SessionData>): Promise<void> {
    if (!this.session) {
      throw new Error('No session to update');
    }

    this.session = {
      ...this.session,
      ...partial,
      timestamp: Date.now(),
    };

    await this.save(this.session);
  }

  /**
   * Clear session data
   */
  async clear(): Promise<void> {
    try {
      this.session = null;
      // Delete file using Bun's native file operations
      const file = Bun.file(this.sessionFile);
      if (await file.exists()) {
        await Bun.write(this.sessionFile, '');
      }
      this.logger.debug('Session cleared');
    } catch (error) {
      this.logger.warn('Failed to clear session:', error);
    }
  }

  /**
   * Get current session
   */
  getSession(): SessionData | null {
    return this.session;
  }

  /**
   * Check if session is valid (not expired)
   */
  isValid(maxAge: number = 24 * 60 * 60 * 1000): boolean {
    if (!this.session || !this.session.timestamp) {
      return false;
    }

    const age = Date.now() - this.session.timestamp;
    return age < maxAge;
  }

  /**
   * Get session token
   */
  getToken(): string | undefined {
    return this.session?.token;
  }

  /**
   * Get session cookies
   */
  getCookies(): string | undefined {
    return this.session?.cookies;
  }

  /**
   * Set session from external data
   */
  setSession(session: SessionData): void {
    this.session = session;
  }
}

