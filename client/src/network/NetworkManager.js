// client/src/network/NetworkManager.js
import { io } from 'socket.io-client';

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.token = null;
    this.connected = false;
    this.listeners = new Map();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.latency = 0;
    this._pingInterval = null;
    this._lastPing = 0;
  }

  connect(token) {
    this.token = token;

    if (this.socket) {
      this.socket.disconnect();
    }

    const serverUrl = window.location.origin;

    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[Network] Connected:', this.socket.id);
      this.startPing();

      // Flush queued messages
      for (const [event, data] of this.messageQueue) {
        this.socket.emit(event, data);
      }
      this.messageQueue = [];
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.warn('[Network] Disconnected:', reason);
      this.stopPing();
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Network] Connection error:', err.message);
      this.reconnectAttempts++;
    });

    // Forward all registered events to listeners
    this.socket.onAny((event, data) => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          handler(data);
        }
      }
    });

    return this;
  }

  disconnect() {
    this.stopPing();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  emit(event, data) {
    if (!this.socket || !this.connected) {
      // Queue important messages
      if (this.messageQueue.length < 50) {
        this.messageQueue.push([event, data]);
      }
      return;
    }
    this.socket.emit(event, data);
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) handlers.delete(handler);
  }

  startPing() {
    this._pingInterval = setInterval(() => {
      this._lastPing = Date.now();
      this.socket.emit('ping', this._lastPing);
      this.socket.once('pong', () => {
        this.latency = Date.now() - this._lastPing;
      });
    }, 2000);
  }

  stopPing() {
    clearInterval(this._pingInterval);
  }

  getLatency() {
    return this.latency;
  }

  isConnected() {
    return this.connected;
  }
}
