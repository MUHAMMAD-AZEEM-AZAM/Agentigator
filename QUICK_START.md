# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Get Your IP Address

**Windows:**
```bash
ipconfig
```
Look for: `IPv4 Address: 192.168.x.x`

**Mac/Linux:**
```bash
ifconfig
```
Look for: `inet 192.168.x.x`

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add GEMINI_API_KEY
python main.py
```

### 3. Configure Frontend

Edit `config/api.ts`:
```typescript
const BACKEND_IP = '192.168.1.100'; // YOUR IP HERE
```

### 4. Run App

```bash
npm install
npm run dev
```

## ✅ Verify It Works

1. Open app → See "Ready to assist"
2. WiFi icon in top right should be green
3. Tap mic → Speak → Get response

## 🎯 Key Features

- **Continuous Voice**: Conversation never stops
- **Auto Browser**: Opens only when agent needs it
- **Real-time**: Instant responses via WebSocket
- **Multilingual**: Adapts to your language automatically

## 📝 Example Commands

- "Hello, how can you help me?"
- "Open Google for me"
- "Help me fill a contact form"
- "Navigate to example.com"

## 🔧 Common Issues

**Can't connect?**
- Check IP address in config/api.ts
- Ensure backend is running
- Both devices on same WiFi

**No audio?**
- Check microphone permissions
- Verify Gemini API key

**Browser not opening?**
- This is normal! It opens automatically when needed
- Try: "Can you open a website for me?"

## 📚 Full Documentation

- `SETUP_GUIDE.md` - Detailed setup instructions
- `BACKEND_INTEGRATION.md` - Technical integration details
- `backend/README.md` - Backend API documentation
