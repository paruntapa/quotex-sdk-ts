/**
 * Socket.IO connection manager (Raw WebSocket with Socket.IO protocol)
 * Matches Python SDK's approach: websocket-client with manual Socket.IO protocol
 */

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

  /**
   * Connect to Socket.IO server (Raw WebSocket with Socket.IO protocol)
   * Matches Python SDK: pyquotex/ws/client.py
   */
  async connect(token?: string, cookies?: string, userAgent?: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.logger.info('Connecting to WebSocket with Socket.IO protocol...');

        // Get host from URL (e.g., "qxbroker.com")
        const host = this.config.url.match(/wss:\/\/ws2\.([^\/]+)/)?.[1] || 'qxbroker.com';

        // Create raw WebSocket with headers (matching Python SDK)
        const headers: Record<string, string> = {
          'User-Agent': userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Origin': `https://${host}`,
          'Host': `ws2.${host}`,
        };

        // Add cookies if provided
        if (cookies) {
          headers['Cookie'] = cookies;
        }

        // Create WebSocket connection
        this.socket = new WebSocket(this.config.url, { headers } as any);

        // Handle connection open
        this.socket.onopen = () => {
          this.logger.info('WebSocket connected!');
          this.connected = true;

          // Send initial Socket.IO messages (matching Python SDK's on_open)
          this.send('42["tick"]');
          this.send('42["indicator/list"]');
          this.send('42["drawing/load"]');
          this.send('42["pending/list"]');
          
          // Send authorization if token provided
          if (token) {
            this.logger.info('Sending authorization...');
            this.authorize(token);
          }

          // Start ping interval (Socket.IO keep-alive)
          this.startPing();

          resolve(true);
        };

        // Handle messages
        this.socket.onmessage = (event) => {
          this.handleRawMessage(event.data);
        };

        // Handle close
        this.socket.onclose = (event) => {
          this.logger.info('WebSocket closed:', event.code, event.reason);
          this.connected = false;
          this.stopPing();

          // Auto-reconnect if enabled
          if (this.config.reconnect && this.reconnectAttempt < (this.config.reconnectAttempts || 5)) {
            this.scheduleReconnect(token, cookies, userAgent);
          } else if (!this.connected) {
            resolve(false);
          }
        };

        // Handle errors
        this.socket.onerror = (error) => {
          this.logger.error('WebSocket error:', error);
          this.connected = false;
        };

        // Timeout
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

  /**
   * Send authorization (Socket.IO protocol)
   * Format: 42["authorization",{session,isDemo,tournamentId}]
   */
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

  /**
   * Start ping interval (Socket.IO keep-alive)
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.send('2'); // Socket.IO ping
      }
    }, 25000); // Match Python SDK's pingInterval
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(token?: string, cookies?: string, userAgent?: string): void {
    this.reconnectAttempt++;
    const delay = this.config.reconnectDelay || 5000;

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    setTimeout(() => {
      this.connect(token, cookies, userAgent);
    }, delay);
  }

  /**
   * Send raw message (Socket.IO protocol)
   */
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

  /**
   * Emit Socket.IO event (helper method)
   */
  emit(channel: string, data?: any): void {
    const message = data 
      ? `42["${channel}",${JSON.stringify(data)}]`
      : `42["${channel}"]`;
    this.send(message);
  }

  /**
   * Handle raw WebSocket message (Socket.IO protocol)
   * Matches Python SDK's on_message
   */
  private handleRawMessage(message: any): void {
    try {
      // Convert to string if it's a Blob or Buffer
      if (typeof message !== 'string') {
        message = message.toString();
      }

      if (this.config.debug) {
        const preview = message.length > 200 ? `${message.substring(0, 200)}... (${message.length} chars)` : message;
        this.logger.debug('Received:', preview);
        
      }

      // Handle Socket.IO protocol messages
      if (message === '0') {
        // Connection established
        this.logger.debug('Socket.IO handshake received');
        return;
      }

      if (message === '2') {
        // Ping - respond with pong
        this.send('3');
        return;
      }

      if (message === '3') {
        // Pong received
        return;
      }

      if (message === '40') {
        // Connected to namespace
        this.logger.debug('Connected to Socket.IO namespace');
        return;
      }

      if (message === '41') {
        // Disconnected from namespace
        this.logger.warn('Disconnected from Socket.IO namespace');
        return;
      }

      // Handle Socket.IO message type 4 (message without event name)
      // Format: \u0004{...} or \u0004[...] (charCode 4, not string '4')
      if (message.charCodeAt(0) === 4) {
        // Socket.IO type 4 = message, parse the JSON data after the control character
        const jsonStr = message.substring(1);
        try {
          const parsed = JSON.parse(jsonStr);
          
          // Check if it's an array (likely instruments list)
          if (Array.isArray(parsed)) {
            if (parsed.length > 50 && Array.isArray(parsed[0])) {
              this.logger.info(`📊 Instruments list received (${parsed.length} assets)`);
              this.handleMessage('instruments', parsed);
            } else {
              // Smaller array or different format
              const keys = Object.keys(parsed).join(',');
              this.logger.info('✅ Socket.IO message (type 4):', keys);
              this.handleMessage('message', parsed);
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            const keys = Object.keys(parsed).join(',');
            this.logger.info('✅ Socket.IO message (type 4):', keys);
            
            // Debug: Log full message for buy-related responses
            if (keys.includes('id') || keys.includes('openTime') || keys.includes('closeTime')) {
              this.logger.info('💡 Potential trade message:', JSON.stringify(parsed).substring(0, 300));
            }
            
            this.handleMessage('message', parsed);
            
            // Check for error responses
            if (parsed.error) {
              this.logger.error('❌ Server error:', parsed.error);
            }
            
            // Check for pending order response
            if (parsed.pending) {
              this.logger.info('🎯 Pending order confirmed:', parsed.pending.ticket);
            }
          }
        } catch (e) {
          if (this.config.debug) {
            this.logger.error('Failed to parse type 4 message:', e);
          }
        }
        return;
      }

      // Parse Socket.IO message format: 42["event",data] or 42[data]
      if (message.startsWith('42')) {
        const jsonStr = message.substring(2);
        try {
          const parsed = JSON.parse(jsonStr);
          
          if (Array.isArray(parsed) && parsed.length >= 1) {
            // Check if it's an event message: ["event", data]
            if (typeof parsed[0] === 'string') {
              const event = parsed[0];
              const data = parsed[1];

              // Trigger handlers
              this.handleMessage(event, data);

              // Check for specific events
              if (event === 's_authorization') {
                this.logger.info('✅ Authorization accepted!');
              } else if (event === 'authorization/reject') {
                this.logger.error('❌ Authorization rejected');
              }
            } else {
              // It's just data array, not an event
              // Check if it looks like instruments list (large array of arrays)
              if (Array.isArray(parsed) && parsed.length > 50) {
                this.logger.info(`📊 Instruments list received (${parsed.length} assets), first item type: ${typeof parsed[0]}`);
                this.handleMessage('instruments', parsed);
              } else {
                // Generic message handler
                this.handleMessage('message', parsed);
              }
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            // It's a direct object message
            this.handleMessage('message', parsed);
            
            // Also check for pending order response
            if (parsed.pending) {
              this.logger.debug('Pending order confirmed:', parsed.pending.ticket);
            }
          }
        } catch (e) {
          // Not JSON, might be other data
          if (this.config.debug) {
            this.logger.debug('Non-JSON Socket.IO message:', message);
          }
        }
      } else if (message.startsWith('{') || message.startsWith('[')) {
        // Try to parse as JSON (non-Socket.IO messages)
        try {
          const parsed = JSON.parse(message);
          if (typeof parsed === 'object' && parsed !== null) {
            if (this.config.debug) {
              this.logger.debug('✅ Non-Socket.IO JSON message:', Object.keys(parsed).join(','));
            }
            this.handleMessage('message', parsed);
            
            // Check for pending order response
            if (parsed.pending) {
              this.logger.info('🎯 Pending order confirmed:', parsed.pending.ticket);
            }
          }
        } catch (e) {
          // Not JSON
          if (this.config.debug) {
            this.logger.debug('JSON parse error:', e);
          }
        }
      } else {
        // Unknown message format
        if (this.config.debug && message.length < 100) {
          this.logger.debug('Unknown message format:', message);
        }
      }

    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  /**
   * Subscribe to a channel (alias for on)
   */
  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }
    
    this.messageHandlers.get(channel)!.add(callback);
    
    // Return unsubscribe function
    return () => this.off(channel, callback);
  }

  /**
   * Subscribe to a channel
   */
  on(channel: string, callback: (data: any) => void): void {
    this.subscribe(channel, callback);
  }

  /**
   * Unsubscribe from a channel
   */
  off(channel: string, callback: (data: any) => void): void {
    const handlers = this.messageHandlers.get(channel);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * Handle incoming message
   */
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

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  /**
   * Disconnect
   */
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

