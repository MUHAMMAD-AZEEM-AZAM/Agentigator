/**
 * WebSocket Service for Backend Communication
 * Handles real-time bidirectional communication with the backend.
 * Supports both JSON text messages and base64 audio data.
 */

import { API_CONFIG } from '@/config/api';

type MessageHandler = (message: any) => void;
type ConnectionHandler = () => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectionHandlers: ConnectionHandler[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalClose = false;

  constructor() {
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const url = `${API_CONFIG.WS_URL}/ws/${this.clientId}`;
    console.log('Connecting to:', url);

    try {
      this.isIntentionalClose = false;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✓ Connected to backend');
        this.reconnectAttempts = 0;
        this.connectionHandlers.forEach(handler => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from backend');
        this.disconnectionHandlers.forEach(handler => handler());

        if (!this.isIntentionalClose) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= API_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, API_CONFIG.RECONNECT_INTERVAL);
  }

  private handleMessage(message: any) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  on(messageType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  off(messageType: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  onConnect(handler: ConnectionHandler) {
    this.connectionHandlers.push(handler);
  }

  onDisconnect(handler: ConnectionHandler) {
    this.disconnectionHandlers.push(handler);
  }

  removeAllListeners() {
    this.messageHandlers.clear();
    this.connectionHandlers = [];
    this.disconnectionHandlers = [];
  }

  /**
   * Send a base64-encoded PCM audio chunk to the backend.
   * The backend will forward it to Gemini Live API.
   */
  sendAudioChunk(base64PcmData: string) {
    this.send({
      type: 'audio',
      data: base64PcmData,
    });
  }

  /**
   * Send screenshot to backend for visual analysis.
   */
  sendScreenshot(imageData: string, mimeType: string = 'image/jpeg') {
    this.send({
      type: 'screenshot',
      data: imageData,
      mime_type: mimeType,
    });
  }

  /**
   * Send tool execution result back to backend.
   */
  sendToolResult(toolName: string, toolCallId: string, result: any) {
    this.send({
      type: 'tool_result',
      tool_name: toolName,
      tool_call_id: toolCallId,
      result: result,
    });
  }

  /**
   * Send configuration update.
   */
  sendConfig(config: any) {
    this.send({
      type: 'config',
      config: config,
    });
  }

  /**
   * Notify backend that user completed a manual action (e.g., CAPTCHA).
   */
  sendUserActionComplete() {
    this.send({
      type: 'user_action_complete',
    });
  }

  /**
   * Notify backend that user interrupted the agent and started speaking.
   */
  sendUserInterrupt() {
    this.send({
      type: 'user_interrupt',
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message.type);
    }
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getClientId(): string {
    return this.clientId;
  }
}

// Export singleton instance
export default new WebSocketService();
