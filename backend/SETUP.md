# Backend Setup Guide

Complete guide to set up and run the Voice Assistant backend.

## Prerequisites

- Python 3.11 or higher
- Gemini API key from Google AI Studio
- pip package manager

## Step-by-Step Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

### 5. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env file and add your API key
# On Windows: notepad .env
# On macOS/Linux: nano .env
```

Add your API key:
```
GEMINI_API_KEY=AIzaSy...your_actual_key_here
```

### 6. Run the Server

```bash
python main.py
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 7. Test the Connection

Open a new terminal and run:

```bash
python test_client.py
```

You should see successful connection messages.

## Verify Installation

### Check Health Endpoint

Open browser and go to:
```
http://localhost:8000/health
```

You should see:
```json
{"status": "healthy"}
```

### Check API Documentation

Go to:
```
http://localhost:8000/docs
```

This shows the FastAPI interactive documentation.

## Common Issues

### Issue: "ModuleNotFoundError: No module named 'google.genai'"

**Solution:**
```bash
pip install --upgrade google-genai
```

### Issue: "ModuleNotFoundError: No module named 'google.adk'"

**Solution:**
The Google ADK might not be publicly available yet. If you get this error:

1. Comment out ADK imports in `gemini_live_agent.py`
2. Use direct Gemini API calls instead
3. Or wait for ADK public release

### Issue: "Connection refused" when testing

**Solution:**
- Make sure the server is running
- Check if port 8000 is available
- Try: `netstat -ano | findstr :8000` (Windows) or `lsof -i :8000` (macOS/Linux)

### Issue: "Invalid API key"

**Solution:**
- Verify your API key in `.env` file
- Make sure there are no extra spaces
- Try generating a new API key

## Development Mode

For development with auto-reload:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Production Deployment

### Using Docker

```bash
# Build image
docker build -t voice-assistant-backend .

# Run container
docker run -p 8000:8000 --env-file .env voice-assistant-backend
```

### Using Google Cloud Run

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy
gcloud run deploy voice-assistant-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

## Next Steps

1. Connect your React Native mobile app to the backend
2. Test voice streaming
3. Test browser automation commands
4. Customize system instructions in `gemini_live_agent.py`

## Support

For issues or questions:
- Check the logs in the terminal
- Review the README.md for API documentation
- Test with `test_client.py` to isolate issues
