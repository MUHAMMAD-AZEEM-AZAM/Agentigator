# Complete Setup Guide

## Step 1: Get Your Local IP Address

### On Windows:
1. Open Command Prompt (cmd)
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter
4. Example: `192.168.1.100`

### On macOS/Linux:
1. Open Terminal
2. Type: `ifconfig` or `ip addr`
3. Look for "inet" address under your active network (usually en0 or wlan0)
4. Example: `192.168.1.100`

## Step 2: Configure Backend

### 1. Navigate to backend directory:
```bash
cd backend
```

### 2. Create virtual environment:
```bash
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 3. Install dependencies:
```bash
pip install -r requirements.txt
```

### 4. Create .env file:
```bash
cp .env.example .env
```

### 5. Edit .env and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikey

### 6. Start the backend:
```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 3: Configure Frontend

### 1. Open `config/api.ts`

### 2. Update BACKEND_IP with your IP from Step 1:
```typescript
const BACKEND_IP = '192.168.1.100'; // Replace with YOUR IP
```

### 3. Save the file

## Step 4: Run the Mobile App

### 1. Install dependencies (if not already done):
```bash
npm install
```

### 2. Start the development server:
```bash
npm run dev
```

### 3. Choose your platform:
- Press `a` for Android
- Press `i` for iOS
- Scan QR code with Expo Go app

## Step 5: Test the Connection

### 1. Open the app on your device

### 2. Navigate to the Assistant screen

### 3. Check the connection status:
- Top right corner should show a WiFi icon (green = connected)
- Status should say "Ready to assist"

### 4. Test voice interaction:
- Tap the microphone button
- Speak: "Hello, can you help me?"
- The agent should respond

## Troubleshooting

### Backend won't start:
- Check if port 8000 is already in use
- Verify Python version (3.11+)
- Check if all dependencies installed correctly

### Frontend can't connect:
- Verify BACKEND_IP in `config/api.ts` matches your actual IP
- Make sure backend is running
- Check if firewall is blocking port 8000
- Ensure phone and computer are on the same network

### No audio response:
- Check microphone permissions
- Verify Gemini API key is valid
- Check backend logs for errors

### Browser doesn't open:
- This is normal! Browser only opens when agent needs it
- Try asking: "Can you help me fill a form at example.com?"
- Agent will open browser automatically when needed

## Network Configuration

### For Development:
- Both devices must be on the same WiFi network
- Use local IP address (192.168.x.x)

### For Production:
- Deploy backend to Google Cloud Run or similar
- Update `config/api.ts` with production URL
- Use WSS (secure WebSocket) instead of WS

## Testing the Flow

### Test 1: Basic Conversation
1. Tap microphone
2. Say: "Hello, how are you?"
3. Agent should respond with voice

### Test 2: Browser Automation
1. Tap microphone
2. Say: "Can you open Google for me?"
3. Agent should:
   - Respond with voice
   - Open browser automatically
   - Load Google.com
   - Continue conversation in floating bubble

### Test 3: Form Filling
1. Tap microphone
2. Say: "Help me fill a contact form"
3. Agent should:
   - Ask for required information
   - Open the website when ready
   - Fill the form automatically

## Important Notes

1. **Continuous Conversation**: The voice conversation continues even when browser is open
2. **Browser Opens Automatically**: Don't manually open browser - agent will do it when needed
3. **Connection Required**: App needs active connection to backend to work
4. **Same Network**: For development, ensure both devices are on same WiFi

## Next Steps

1. Test basic voice interaction
2. Test browser automation
3. Try form filling scenarios
4. Customize system instructions in backend
5. Deploy to production when ready

## Support

If you encounter issues:
1. Check backend logs in terminal
2. Check frontend logs in Expo console
3. Verify network connectivity
4. Test with `backend/test_client.py`
