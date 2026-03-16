"""
Main FastAPI application with WebSocket support for Gemini Live API integration.
Handles real-time voice communication and browser automation commands.
"""
import asyncio
import json
import os
import base64
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from starlette.websockets import WebSocketState
from typing import Dict
import logging

# Load environment variables
load_dotenv()

from agent.gemini_live_agent import GeminiLiveAgent
from services.session_manager import SessionManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Verify API key is loaded
if not os.environ.get("GEMINI_API_KEY"):
    logger.error("⚠️ GEMINI_API_KEY not found in environment!")
else:
    logger.info("✓ GEMINI_API_KEY loaded successfully")

app = FastAPI(title="Voice Assistant Backend")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session manager for storing user data locally
session_manager = SessionManager()

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# Completed WAV files per client per turn (replaces the old audio_queues + FFmpeg streaming)
audio_wav_files: Dict[str, Dict[str, bytes]] = {}


@app.get("/")
async def root():
    return {"status": "Voice Assistant Backend Running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/audio/{client_id}/{turn_id}.wav")
async def get_audio_wav(client_id: str, turn_id: str):
    """
    Serve a completed WAV file for a given client/turn.
    The agent accumulates all PCM chunks for a turn, writes a WAV file,
    and stores it here for the frontend to download and play.
    """
    if client_id not in audio_wav_files or turn_id not in audio_wav_files[client_id]:
        return JSONResponse({"error": "Audio not found"}, status_code=404)
    
    wav_data = audio_wav_files[client_id][turn_id]
    
    return Response(
        content=wav_data,
        media_type="audio/wav",
        headers={
            "Content-Length": str(len(wav_data)),
            "Cache-Control": "no-cache",
        }
    )


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time communication with mobile app.
    Handles both text (JSON control messages) and binary (audio) frames.
    """
    await websocket.accept()
    active_connections[client_id] = websocket
    logger.info(f"Client {client_id} connected")

    session_manager.create_session(client_id)

    # Initialize Gemini Live Agent for this session
    agent = GeminiLiveAgent(
        client_id=client_id,
        session_manager=session_manager,
        websocket=websocket,
        audio_wav_files=audio_wav_files
    )

    try:
        # Start the Gemini Live session
        await agent.start()

        # Main message loop — handle both text and binary frames
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.receive":
                # Binary frame = raw audio data
                if "bytes" in message and message["bytes"]:
                    audio_b64 = base64.b64encode(message["bytes"]).decode()
                    await agent.send_audio(audio_b64)

                # Text frame = JSON control message
                elif "text" in message and message["text"]:
                    try:
                        data = json.loads(message["text"])
                        await handle_client_message(agent, data)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON from client: {message['text'][:100]}")

            elif message["type"] == "websocket.disconnect":
                break

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket connection for {client_id}: {e}")
    finally:
        if client_id in active_connections:
            del active_connections[client_id]
        await agent.stop()
        session_manager.clear_history(client_id)
        session_manager.delete_session(client_id)


async def handle_client_message(agent: GeminiLiveAgent, message: dict):
    """
    Handle incoming JSON messages from the mobile app.

    Message types:
    - audio: Base64-encoded PCM audio chunk
    - screenshot: Browser screenshot for visual analysis
    - tool_result: Result of browser action execution
    - config: Configuration updates
    - user_action_complete: User finished manual action (e.g., CAPTCHA)
    - user_interrupt: User started speaking while agent was talking
    """
    msg_type = message.get("type")

    if msg_type == "audio":
        # Base64-encoded PCM audio from mobile
        audio_data = message.get("data")
        if audio_data:
            await agent.send_audio(audio_data)

    elif msg_type == "screenshot":
        await agent.send_screenshot(
            message.get("data"),
            message.get("mime_type", "image/jpeg")
        )

    elif msg_type == "tool_result":
        await agent.handle_tool_result(
            message.get("tool_name"),
            message.get("tool_call_id", ""),
            message.get("result", {})
        )

    elif msg_type == "config":
        await agent.update_config(message.get("config", {}))

    elif msg_type == "user_action_complete":
        await agent.resume_after_user_action()

    elif msg_type == "user_interrupt":
        await agent.handle_user_interrupt()

    else:
        logger.warning(f"Unknown message type: {msg_type}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
