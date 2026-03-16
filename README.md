# Agentigator 🤖

A cutting-edge voice-powered AI assistant built with Gemini Live API and real-time browser automation. Talk to your AI agent naturally, and watch it take actions on the web in real-time.

## 🌟 Key Features

- **Real-Time Voice Interaction**: Speak naturally to the AI assistant using the Gemini Live API
- **Browser Automation**: The AI can browse the web, click buttons, fill forms, and execute complex tasks
- **Cross-Platform**: Runs on iOS and Android via Expo
- **WebSocket Communication**: Low-latency real-time interaction between mobile and backend
- **Multilingual Support**: Language selection in the app UI
- **Session Persistence**: Maintains conversation history and state

## 🏗️ Architecture

```
Agentigator/
├── frontend/          # React Native + Expo mobile app
│   ├── app/          # Navigation & screens
│   ├── components/   # Reusable UI components
│   ├── services/     # WebSocket & API services
│   ├── hooks/        # Custom React hooks
│   └── contexts/     # React context providers
│
├── backend/          # Python FastAPI server
│   ├── main.py      # Server entry point
│   ├── agent/       # Gemini Live agent logic
│   ├── services/    # Business logic services
│   └── requirements.txt
│
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)
- **Gemini API Key** (get it from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **WiFi Network** (backend and app must be on same network)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env  # Create from template if available
# Edit .env and add your GEMINI_API_KEY
```

Start the backend server:
```bash
python main.py
```

The server will start on `http://0.0.0.0:8000`

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Configure the backend connection
# Edit config/api.ts and set BACKEND_IP to your server IP
# Example: const BACKEND_IP = '192.168.1.100';
```

Find your IP address:
- **Windows**: Run `ipconfig` and look for IPv4 Address (e.g., 192.168.x.x)
- **Mac/Linux**: Run `ifconfig` and look for inet address

Start the development app:
```bash
npm run dev
```

This opens Expo CLI where you can:
- Run on iOS simulator: Press `i`
- Run on Android emulator: Press `a`
- Scan QR code with Expo Go app on physical device

## 📡 How It Works

1. **User speaks** into the mobile app microphone
2. **Audio is streamed** to the backend via WebSocket
3. **Gemini Live API** processes the audio and generates responses
4. **Browser tools** are called by the AI to interact with websites
5. **Results are streamed back** to the mobile app in real-time
6. **User hears the response** through the app speaker

## 🔧 Configuration

### Backend (.env)

```properties
# Gemini API Configuration
GEMINI_API_KEY=your_api_key_here

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Environment
ENVIRONMENT=development
```

### Frontend (config/api.ts)

```typescript
const BACKEND_IP = '192.168.1.100';  // Change to your server IP
const BACKEND_PORT = 8000;
const API_URL = `http://${BACKEND_IP}:${BACKEND_PORT}`;
```

## 📚 API Reference

### WebSocket Endpoint
**Connection**: `ws://{BACKEND_IP}:8000/ws/{client_id}`

#### Messages from Mobile App to Backend:
- **audio_chunk**: PCM audio data for real-time transcription
- **control_message**: Start/stop recording, end session

#### Messages from Backend to Mobile App:
- **audio_response**: AI-generated audio response
- **text_response**: Transcribed or generated text
- **tool_call**: Browser automation actions

## 🛠️ Development

### Backend Development

```bash
cd backend

# Run with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Run tests
pytest

# Check code
pylint agent/ services/
```

### Frontend Development

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Type checking
npx tsc --noEmit
```

## 🐛 Troubleshooting

### App can't connect to backend
- ✅ Ensure backend is running: `python main.py`
- ✅ Check IP address in `config/api.ts` matches your machine
- ✅ Verify both are on the same WiFi network
- ✅ Check firewall isn't blocking port 8000

### Gemini API errors
- ✅ Verify API key is correct in `.env`
- ✅ Check API quota at [Google Cloud Console](https://console.cloud.google.com/)
- ✅ Ensure Gemini API is enabled in your Google Cloud project

### Audio issues
- ✅ Grant microphone permissions to the app
- ✅ Check that speakers are not muted
- ✅ Verify audio format (should be 16-bit PCM, 16kHz)

### WebSocket disconnection
- ✅ Check network stability
- ✅ Verify backend is still running
- ✅ Look for errors in backend logs

## 📦 Dependencies

### Backend
- **FastAPI**: Web framework
- **uvicorn**: ASGI server
- **google-generativeai**: Gemini API client
- **python-socketio**: WebSocket communication

### Frontend
- **React Native**: Mobile framework
- **Expo**: Development platform
- **TypeScript**: Type safety
- **WebSocket**: Real-time communication

## 🎓 Learning Resources

- [Gemini Live API Documentation](https://ai.google.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/)

## 📄 License

This project is private and proprietary.

## 👨‍💻 Author

**Muhammad Azeem Azam**

---

**Questions or Issues?** Check the troubleshooting section or review the logs in `backend/logs/` for detailed error messages.
