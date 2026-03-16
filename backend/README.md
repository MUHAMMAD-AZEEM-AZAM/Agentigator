# Voice Assistant Backend

Backend server for the voice-based AI assistant using Gemini Live API and Google ADK.

## Features

- Real-time voice streaming with Gemini Live API
- Browser automation tool calling
- WebSocket communication with mobile app
- Session management and data persistence
- Multilingual support

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_api_key
```

### 3. Run the Server

```bash
python main.py
```

Or with uvicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### WebSocket: `/ws/{client_id}`

Main WebSocket endpoint for real-time communication.

#### Messages from Mobile App to Backend:

**Audio Input:**
```json
{
  "type": "audio",
  "data": "base64_encoded_pcm_audio"
}
```

**Screenshot:**
```json
{
  "type": "screenshot",
  "data": "base64_encoded_image",
  "mime_type": "image/jpeg"
}
```

**Tool Result:**
```json
{
  "type": "tool_result",
  "tool_name": "load_url",
  "result": {
    "status": "success",
    "message": "Page loaded"
  }
}
```

**Configuration:**
```json
{
  "type": "config",
  "config": {
    "language": "ur"
  }
}
```

**User Action Complete:**
```json
{
  "type": "user_action_complete"
}
```

#### Messages from Backend to Mobile App:

**Agent Audio (Speaking):**
```json
{
  "type": "agent_audio",
  "data": "base64_encoded_audio",
  "state": "speaking"
}
```

**Browser Action:**
```json
{
  "type": "browser_action",
  "action": "load_url",
  "params": {
    "url": "https://example.com"
  },
  "state": "processing"
}
```

**Agent Text:**
```json
{
  "type": "agent_text",
  "text": "I'm opening the website now..."
}
```

**Turn Complete:**
```json
{
  "type": "turn_complete",
  "state": "idle"
}
```

## Browser Tools

The agent can call these tools to control the browser:

- `load_url(url)` - Load a URL
- `click_element(selector, description)` - Click an element
- `type_text(selector, text, description)` - Type into a field
- `scroll_page(direction, amount)` - Scroll the page
- `go_back()` - Navigate back
- `go_forward()` - Navigate forward
- `refresh_page()` - Reload the page
- `get_page_info()` - Request screenshot and page info

## Architecture

```
Mobile App (React Native)
    ↕ WebSocket
Backend (FastAPI)
    ↕ WebSocket
Gemini Live API
```

### Flow:

1. User speaks → Mobile app sends audio to backend
2. Backend forwards audio to Gemini Live API
3. Gemini processes and decides action (tool call or response)
4. If tool call: Backend sends browser command to mobile app
5. Mobile app executes browser action
6. Mobile app sends result back to backend
7. Backend forwards result to Gemini
8. Gemini continues or responds with voice
9. Backend streams audio back to mobile app

## Storage

Local JSON-based storage in `storage/` directory:

- `sessions.json` - Active user sessions
- `form_data.json` - Saved form data for reuse
- `history.json` - Browsing history

## Development

### Testing WebSocket Connection

```python
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/test_client"
    async with websockets.connect(uri) as ws:
        # Send test message
        await ws.send(json.dumps({
            "type": "config",
            "config": {"language": "en"}
        }))
        
        # Receive response
        response = await ws.recv()
        print(response)

asyncio.run(test())
```

## Deployment

For production deployment on Google Cloud:

```bash
# Build container
docker build -t voice-assistant-backend .

# Deploy to Cloud Run
gcloud run deploy voice-assistant-backend \
  --image voice-assistant-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Troubleshooting

### WebSocket Connection Issues

- Ensure firewall allows WebSocket connections
- Check CORS settings in `main.py`
- Verify Gemini API key is valid

### Audio Issues

- Audio must be PCM format, 16kHz sample rate
- Audio data must be base64 encoded

### Tool Execution Issues

- Check mobile app is properly handling browser actions
- Verify tool results are sent back to backend
- Check logs for error messages
