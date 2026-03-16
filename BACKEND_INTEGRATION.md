# Backend Integration Guide

This document explains how to integrate the backend with your React Native frontend.

## Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (React Native)                │
│  - Captures voice input                                      │
│  - Displays UI and animations                                │
│  - Executes browser actions in WebView                       │
│  - Sends screenshots to backend                              │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
                     │ (Real-time bidirectional)
┌────────────────────▼────────────────────────────────────────┐
│                  Backend (FastAPI + Python)                  │
│  - Manages WebSocket connections                             │
│  - Handles session storage                                   │
│  - Routes messages between app and Gemini                    │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Gemini Live API                           │
│  - Processes voice input                                     │
│  - Generates voice responses                                 │
│  - Calls browser automation tools                            │
│  - Analyzes screenshots                                      │
└──────────────────────────────────────────────────────────────┘
```

## Message Flow

### 1. User Speaks

```
Mobile App → Backend → Gemini Live API
```

**Mobile sends:**
```json
{
  "type": "audio",
  "data": "base64_encoded_pcm_audio_chunk"
}
```

### 2. Agent Responds (Voice)

```
Gemini Live API → Backend → Mobile App
```

**Mobile receives:**
```json
{
  "type": "agent_audio",
  "data": "base64_encoded_audio",
  "state": "speaking"
}
```

### 3. Agent Calls Browser Tool

```
Gemini Live API → Backend → Mobile App
```

**Mobile receives:**
```json
{
  "type": "browser_action",
  "action": "load_url",
  "params": {
    "url": "https://example.com/form"
  },
  "state": "processing"
}
```

### 4. Mobile Executes Action & Sends Result

```
Mobile App → Backend → Gemini Live API
```

**Mobile sends:**
```json
{
  "type": "tool_result",
  "tool_name": "load_url",
  "result": {
    "status": "success",
    "message": "Page loaded",
    "url": "https://example.com/form"
  }
}
```

### 5. Agent Needs Visual Context

```
Gemini Live API → Backend → Mobile App
```

**Mobile receives:**
```json
{
  "type": "browser_action",
  "action": "get_page_info",
  "params": {},
  "state": "processing"
}
```

**Mobile captures screenshot and sends:**
```json
{
  "type": "screenshot",
  "data": "base64_encoded_jpeg",
  "mime_type": "image/jpeg"
}
```

## Frontend Implementation

### 1. WebSocket Connection

Create a WebSocket service in your React Native app:

```typescript
// services/websocket.ts
import { v4 as uuidv4 } from 'uuid';

class WebSocketService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private messageHandlers: Map<string, Function> = new Map();

  constructor() {
    this.clientId = uuidv4();
  }

  connect(url: string = 'ws://localhost:8000') {
    this.ws = new WebSocket(`${url}/ws/${this.clientId}`);
    
    this.ws.onopen = () => {
      console.log('Connected to backend');
      this.sendConfig({ language: 'en' });
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from backend');
    };
  }

  private handleMessage(message: any) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  on(messageType: string, handler: Function) {
    this.messageHandlers.set(messageType, handler);
  }

  sendAudio(audioData: string) {
    this.send({
      type: 'audio',
      data: audioData
    });
  }

  sendScreenshot(imageData: string, mimeType: string = 'image/jpeg') {
    this.send({
      type: 'screenshot',
      data: imageData,
      mime_type: mimeType
    });
  }

  sendToolResult(toolName: string, result: any) {
    this.send({
      type: 'tool_result',
      tool_name: toolName,
      result: result
    });
  }

  sendConfig(config: any) {
    this.send({
      type: 'config',
      config: config
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default new WebSocketService();
```

### 2. Audio Recording & Streaming

Update your audio recording hook to stream to backend:

```typescript
// hooks/useAudioStreaming.ts
import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import WebSocketService from '@/services/websocket';

export function useAudioStreaming() {
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startStreaming = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.pcm',
          outputFormat: Audio.AndroidOutputFormat.PCM_16BIT,
          audioEncoder: Audio.AndroidAudioEncoder.PCM_16BIT,
          sampleRate: 16000,
          numberOfChannels: 1,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      }
    );

    recordingRef.current = recording;

    // Stream audio chunks
    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.metering) {
        // Get audio chunk and send to backend
        // Note: You'll need to implement chunk extraction
        // This is a simplified example
      }
    });
  };

  const stopStreaming = async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
  };

  return { startStreaming, stopStreaming };
}
```

### 3. Browser Action Handler

Create a service to handle browser actions:

```typescript
// services/browserActions.ts
import { WebView } from 'react-native-webview';

export class BrowserActionHandler {
  private webViewRef: React.RefObject<WebView>;

  constructor(webViewRef: React.RefObject<WebView>) {
    this.webViewRef = webViewRef;
  }

  async executeAction(action: string, params: any): Promise<any> {
    switch (action) {
      case 'load_url':
        return this.loadUrl(params.url);
      
      case 'click_element':
        return this.clickElement(params.selector);
      
      case 'type_text':
        return this.typeText(params.selector, params.text);
      
      case 'scroll_page':
        return this.scrollPage(params.direction, params.amount);
      
      case 'go_back':
        return this.goBack();
      
      case 'go_forward':
        return this.goForward();
      
      case 'refresh_page':
        return this.refreshPage();
      
      case 'get_page_info':
        return this.getPageInfo();
      
      default:
        return { status: 'error', message: 'Unknown action' };
    }
  }

  private loadUrl(url: string) {
    this.webViewRef.current?.injectJavaScript(`
      window.location.href = '${url}';
      true;
    `);
    return { status: 'success', message: 'Loading URL' };
  }

  private clickElement(selector: string) {
    this.webViewRef.current?.injectJavaScript(`
      (function() {
        const element = document.querySelector('${selector}');
        if (element) {
          element.click();
          return { status: 'success', message: 'Clicked element' };
        }
        return { status: 'error', message: 'Element not found' };
      })();
      true;
    `);
    return { status: 'success', message: 'Clicking element' };
  }

  private typeText(selector: string, text: string) {
    this.webViewRef.current?.injectJavaScript(`
      (function() {
        const element = document.querySelector('${selector}');
        if (element) {
          element.value = '${text}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return { status: 'success', message: 'Text entered' };
        }
        return { status: 'error', message: 'Element not found' };
      })();
      true;
    `);
    return { status: 'success', message: 'Typing text' };
  }

  private scrollPage(direction: string, amount: number) {
    const scrollAmount = direction === 'down' ? amount : -amount;
    this.webViewRef.current?.injectJavaScript(`
      window.scrollBy(0, ${scrollAmount});
      true;
    `);
    return { status: 'success', message: 'Scrolling page' };
  }

  private goBack() {
    this.webViewRef.current?.goBack();
    return { status: 'success', message: 'Going back' };
  }

  private goForward() {
    this.webViewRef.current?.goForward();
    return { status: 'success', message: 'Going forward' };
  }

  private refreshPage() {
    this.webViewRef.current?.reload();
    return { status: 'success', message: 'Refreshing page' };
  }

  private async getPageInfo() {
    // Capture screenshot using react-native-view-shot
    // Return page info
    return { status: 'success', message: 'Getting page info' };
  }
}
```

### 4. Integration in Assistant Screen

```typescript
// app/assistant.tsx
import { useEffect, useRef } from 'react';
import WebSocketService from '@/services/websocket';
import { BrowserActionHandler } from '@/services/browserActions';

export default function Assistant() {
  const webViewRef = useRef<WebView>(null);
  const browserHandler = useRef<BrowserActionHandler | null>(null);

  useEffect(() => {
    // Initialize browser handler
    browserHandler.current = new BrowserActionHandler(webViewRef);

    // Connect to backend
    WebSocketService.connect('ws://YOUR_BACKEND_URL');

    // Handle browser actions from backend
    WebSocketService.on('browser_action', async (message) => {
      const result = await browserHandler.current?.executeAction(
        message.action,
        message.params
      );
      
      // Send result back to backend
      WebSocketService.sendToolResult(message.action, result);
    });

    // Handle agent audio
    WebSocketService.on('agent_audio', (message) => {
      // Play audio response
      playAudio(message.data);
    });

    return () => {
      WebSocketService.disconnect();
    };
  }, []);

  // Rest of your component...
}
```

## Testing

1. Start backend: `cd backend && python main.py`
2. Start mobile app: `npm run dev`
3. Connect mobile app to backend
4. Test voice input and browser actions

## Deployment

### Backend Deployment Options:

1. **Google Cloud Run** (Recommended)
2. **Google Cloud Functions**
3. **Any VPS with Docker**

### Update Frontend URL:

```typescript
// In production, update WebSocket URL
WebSocketService.connect('wss://your-backend-url.run.app');
```

## Next Steps

1. Implement audio streaming in React Native
2. Add screenshot capture functionality
3. Test browser automation
4. Add error handling and retry logic
5. Implement session persistence
6. Add multilingual support
