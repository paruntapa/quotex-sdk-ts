/**
 * WebSocket connection manager using Bun's native WebSocket
 */

import type { Logger, WebSocketConfig, WebSocketState } from '../../types';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private state: WebSocketState = {
    connected: false,
    connecting: false,
    reconnecting: false,
  };
  private reconnectAttempts = 0;
  private reconnectTimer: Timer | null = null;
  private messageHandlers = new Map<string, Set<(data: any) => void>>();
  // The type now accepts handlers that may receive an argument or not
  private eventHandlers = new Map<string, Set<(data?: any) => void>>();

  constructor(
    private readonly config: WebSocketConfig,
    private readonly logger: Logger
  ) {}

  /**
   * Connect to WebSocket server
   */
  async connect(headers?: Record<string, string>): Promise<boolean> {
    if (this.state.connected || this.state.connecting) {
      this.logger.warn('Already connected or connecting');
      return this.state.connected;
    }

    this.state.connecting = true;
    this.logger.info('Connecting to WebSocket...');

    return new Promise((resolve) => {
      try {
        // Add headers if provided (for authentication)
        const wsOptions: any = headers ? { headers } : undefined;
        this.ws = new WebSocket(this.config.url, wsOptions);

        this.ws.onopen = () => {
          this.logger.info('WebSocket connected');
          this.state.connected = true;
          this.state.connecting = false;
          this.state.reconnecting = false;
          this.reconnectAttempts = 0;
          this.emit('open');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Fix: WebSocket error event only passes one argument, the event (not error object)
        this.ws.onerror = (event) => {
          this.logger.error('WebSocket error:', event);
          // Try to be as compatible as possible with what's available
          this.state.error = event as any;
          this.emit('error', event);
        };

        this.ws.onclose = (event) => {
          this.logger.info('WebSocket closed:', event.code, event.reason);
          this.state.connected = false;
          const wasConnecting = this.state.connecting;
          this.state.connecting = false;
          // The emit method is already typed to pass a single optional argument
          this.emit('close', { code: event.code, reason: event.reason });

          // Don't reconnect on initial connection failure
          if (this.config.reconnect && !this.state.reconnecting && !wasConnecting) {
            this.scheduleReconnect();
          }
          
          if (wasConnecting) {
            resolve(false);
          }
        };

        // Timeout for connection
        setTimeout(() => {
          if (this.state.connecting) {
            this.logger.error('WebSocket connection timeout');
            this.ws?.close();
            this.state.connecting = false;
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        this.logger.error('Failed to create WebSocket connection:', error);
        this.state.connecting = false;
        this.state.error = error as Error;
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = {
      connected: false,
      connecting: false,
      reconnecting: false,
    };
  }

  /**
   * Send message through WebSocket
   */
  send(data: string | ArrayBuffer): boolean {
    if (!this.state.connected || !this.ws) {
      this.logger.warn('Cannot send message: not connected');
      return false;
    }

    try {
      this.ws.send(data);
      this.logger.debug('Sent message:', data);
      return true;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Subscribe to specific message type
   */
  on(event: string, handler: (data?: any) => void): () => void {
    if (event === 'message') {
      if (!this.messageHandlers.has('*')) {
        this.messageHandlers.set('*', new Set());
      }
      this.messageHandlers.get('*')!.add(handler);
      
      return () => {
        this.messageHandlers.get('*')?.delete(handler);
      };
    }

    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to specific channel messages
   */
  subscribe(channel: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }
    this.messageHandlers.get(channel)!.add(handler);

    return () => {
      this.messageHandlers.get(channel)?.delete(handler);
    };
  }

  /**
   * Get connection state
   */
  getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string | Buffer): void {
    try {
      this.logger.debug('Received message:', data);

      // Socket.IO message format handling
      let messageData: any;
      let channel: string = '*';

      if (typeof data === 'string') {
        // Handle Socket.IO protocol messages
        if (data.startsWith('42[')) {
          // Parse Socket.IO array message format
          const jsonStr = data.substring(2);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            channel = parsed[0];
            messageData = parsed[1];
          }
        } else if (data.startsWith('0')) {
          // Connection message
          this.logger.debug('Socket.IO connection established');
          return;
        } else if (data === '2') {
          // Ping
          this.send('3'); // Pong
          return;
        } else if (data === '3') {
          // Pong
          return;
        } else {
          // Try to parse as JSON
          try {
            messageData = JSON.parse(data);
          } catch {
            messageData = data;
          }
        }
      } else {
        messageData = data;
      }

      // Emit to channel-specific handlers
      if (this.messageHandlers.has(channel)) {
        for (const handler of this.messageHandlers.get(channel)!) {
          handler(messageData);
        }
      }

      // Emit to global message handlers
      if (this.messageHandlers.has('*')) {
        for (const handler of this.messageHandlers.get('*')!) {
          handler({ channel, data: messageData });
        }
      }

    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data?: any): void {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)!) {
        handler(data);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const maxAttempts = this.config.reconnectAttempts ?? 5;
    
    if (this.reconnectAttempts >= maxAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.state.reconnecting = false;
      return;
    }

    this.state.reconnecting = true;
    this.reconnectAttempts++;

    const delay = this.config.reconnectDelay ?? 5000;
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
