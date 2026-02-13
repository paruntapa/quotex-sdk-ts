import type { Logger } from '../../types';

export interface SocketIOConfig {
  url: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  debug?: boolean;
}

export class SocketIOManager {
  private socket: WebSocket | null = null;
  private connected = false;
  private messageHandlers = new Map<string, Set<(data: any) => void>>();
  private reconnectAttempt = 0;
  private pingInterval: Timer | null = null;

  constructor(
    private readonly config: SocketIOConfig,
    private readonly logger: Logger
  ) {}

  async connect(token?: string, cookies?: string, userAgent?: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.logger.info('Connecting to WebSocket with Socket.IO protocol...');

        const host = this.config.url.match(/wss:\/\/ws2\.([^\/]+)/)?.[1] || 'qxbroker.com';

        const headers: Record<string, string> = {
          'User-Agent': userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Origin': `https://${host}`,
          'Host': `ws2.${host}`,
        };

        if (cookies) {
          headers['Cookie'] = cookies;
        }

        this.socket = new WebSocket(this.config.url, { headers } as any);

        this.socket.onopen = () => {
          this.logger.info('WebSocket connected!');
          this.connected = true;

          this.send('42["tick"]');
          this.send('42["indicator/list"]');
          this.send('42["drawing/load"]');
          this.send('42["pending/list"]');
          
          if (token) {
            this.logger.info('Sending authorization...');
            this.authorize(token);
          }

          this.startPing();

          resolve(true);
        };

        this.socket.onmessage = (event) => {
          this.handleRawMessage(event.data);
        };

        this.socket.onclose = (event) => {
          this.logger.info('WebSocket closed:', event.code, event.reason);
          this.connected = false;
          this.stopPing();

          if (this.config.reconnect && this.reconnectAttempt < (this.config.reconnectAttempts || 5)) {
            this.scheduleReconnect(token, cookies, userAgent);
          } else if (!this.connected) {
            resolve(false);
          }
        };

        this.socket.onerror = (error) => {
          this.logger.error('WebSocket error:', error);
          this.connected = false;
        };

        setTimeout(() => {
          if (!this.connected) {
            this.logger.error('WebSocket connection timeout');
            this.socket?.close();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        this.logger.error('Failed to create WebSocket connection:', error);
        resolve(false);
      }
    });
  }

  private authorize(token: string): void {
    const authPayload = {
      session: token,
      isDemo: 1,
      tournamentId: 0
    };

    const message = `42["authorization",${JSON.stringify(authPayload)}]`;
    this.send(message);
    this.logger.debug('Authorization sent');
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.send('2');
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(token?: string, cookies?: string, userAgent?: string): void {
    this.reconnectAttempt++;
    const delay = this.config.reconnectDelay || 5000;

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    setTimeout(() => {
      this.connect(token, cookies, userAgent);
    }, delay);
  }

  send(message: string): void {
    if (!this.socket || !this.connected) {
      this.logger.warn('Cannot send message: not connected');
      return;
    }

    try {
      this.socket.send(message);
      if (this.config.debug) {
        this.logger.debug('Sent:', message.substring(0, 100));
      }
    } catch (error) {
      this.logger.error('Failed to send message:', error);
    }
  }

  emit(channel: string, data?: any): void {
    const message = data 
      ? `42["${channel}",${JSON.stringify(data)}]`
      : `42["${channel}"]`;
    this.send(message);
  }

  private handleRawMessage(message: any): void {
    try {
      if (typeof message !== 'string') {
        message = message.toString();
      }

      if (this.config.debug) {
        const preview = message.length > 200 ? `${message.substring(0, 200)}... (${message.length} chars)` : message;
        this.logger.debug('Received:', preview);
        
      }

      if (message === '0') {
        this.logger.debug('Socket.IO handshake received');
        return;
      }

      if (message === '2') {
        this.send('3');
        return;
      }

      if (message === '3') {
        return;
      }

      if (message === '40') {
        this.logger.debug('Connected to Socket.IO namespace');
        return;
      }

      if (message === '41') {
        this.logger.warn('Disconnected from Socket.IO namespace');
        return;
      }

      if (message.charCodeAt(0) === 4) {
        const jsonStr = message.substring(1);
        try {
          const parsed = JSON.parse(jsonStr);
          
          if (Array.isArray(parsed)) {
            if (parsed.length > 50 && Array.isArray(parsed[0])) {
              this.logger.info(`📊 Instruments list received (${parsed.length} assets)`);
              this.handleMessage('instruments', parsed);
            } else if (
              parsed.length === 1 &&
              Array.isArray(parsed[0]) &&
              parsed[0].length >= 2 &&
              typeof parsed[0][0] === 'string'
            ) {
              this.handleMessage('tick', parsed[0]);
            } else {
              this.handleMessage('message', parsed);
            }

          } else if (typeof parsed === 'object' && parsed !== null) {

            if (parsed.candles !== undefined || parsed.history !== undefined) {
              this.logger.debug('📊 History/candle data received for:', parsed.asset || 'unknown');
              this.handleMessage('candles', parsed);

            } else if (parsed.open !== undefined && parsed.close !== undefined && parsed.asset !== undefined) {
              this.handleMessage('candles', parsed);

            } else if (parsed.id && (parsed.openTime || parsed.closeTime)) {
              this.logger.info('💡 Trade message:', JSON.stringify(parsed).substring(0, 300));
              this.handleMessage('message', parsed);

            } else if (parsed.error) {
              this.logger.error('❌ Server error:', parsed.error);
              this.handleMessage('message', parsed);

            } else if (parsed.pending) {
              this.logger.info('🎯 Pending order confirmed:', parsed.pending?.ticket);
              this.handleMessage('message', parsed);

            } else if (parsed.liveBalance !== undefined || parsed.demoBalance !== undefined) {
              this.logger.debug('💰 Balance update received');
              this.handleMessage('message', parsed);

            } else {
              if (this.config.debug) {
                const keys = Object.keys(parsed).join(',');
                this.logger.debug('Type 4 object:', keys);
              }
              this.handleMessage('message', parsed);
            }

          } else if (typeof parsed === 'number') {
            this.handleMessage('tick', parsed);

          } else {
            if (this.config.debug) {
              this.logger.debug('Type 4 unhandled:', typeof parsed);
            }
          }
        } catch (e) {
          if (this.config.debug) {
            this.logger.error('Failed to parse type 4 message:', e);
          }
        }
        return;
      }

      if (message.startsWith('42')) {
        const jsonStr = message.substring(2);
        try {
          const parsed = JSON.parse(jsonStr);
          
          if (Array.isArray(parsed) && parsed.length >= 1) {
            if (typeof parsed[0] === 'string') {
              const event = parsed[0];
              const data = parsed[1];

              this.handleMessage(event, data);

              if (event === 's_authorization') {
                this.logger.info('✅ Authorization accepted!');
              } else if (event === 'authorization/reject') {
                this.logger.error('❌ Authorization rejected');
              }
            } else {
              if (Array.isArray(parsed) && parsed.length > 50) {
                this.logger.info(`📊 Instruments list received (${parsed.length} assets), first item type: ${typeof parsed[0]}`);
                this.handleMessage('instruments', parsed);
              } else {
                this.handleMessage('message', parsed);
              }
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            this.handleMessage('message', parsed);
            
            if (parsed.pending) {
              this.logger.debug('Pending order confirmed:', parsed.pending.ticket);
            }
          }
        } catch (e) {
          if (this.config.debug) {
            this.logger.debug('Non-JSON Socket.IO message:', message);
          }
        }
      } else if (message.startsWith('{') || message.startsWith('[')) {
        try {
          const parsed = JSON.parse(message);
          if (typeof parsed === 'object' && parsed !== null) {
            if (this.config.debug) {
              this.logger.debug('✅ Non-Socket.IO JSON message:', Object.keys(parsed).join(','));
            }
            this.handleMessage('message', parsed);
            
            if (parsed.pending) {
              this.logger.info('🎯 Pending order confirmed:', parsed.pending.ticket);
            }
          }
        } catch (e) {
          if (this.config.debug) {
            this.logger.debug('JSON parse error:', e);
          }
        }
      } else {
        if (this.config.debug && message.length < 100) {
          this.logger.debug('Unknown message format:', message);
        }
      }

    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }
    
    this.messageHandlers.get(channel)!.add(callback);
    
    return () => this.off(channel, callback);
  }

  on(channel: string, callback: (data: any) => void): void {
    this.subscribe(channel, callback);
  }

  off(channel: string, callback: (data: any) => void): void {
    const handlers = this.messageHandlers.get(channel);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  private handleMessage(channel: string, data: any): void {
    const handlers = this.messageHandlers.get(channel);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`Error in message handler for ${channel}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  disconnect(): void {
    this.stopPing();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
      this.logger.info('WebSocket disconnected');
    }
  }
}

