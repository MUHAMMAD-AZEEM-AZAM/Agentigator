import os
import asyncio
import base64
import wave
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

async def main():
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
    )
    
    async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-preview-12-2025", config=config) as session:
        print("Connected")
        
        # Read from file we saved
        with open("test_audio.raw", "rb") as f:
            audio_bytes = f.read()
            
        print(f"Read {len(audio_bytes)} bytes of audio")
        
        await session.send_realtime_input(
            audio=types.Blob(
                data=audio_bytes,
                mime_type="audio/pcm;rate=16000"
            )
        )
        print("Sent audio")
        
        async for response in session.receive():
            if response.server_content and response.server_content.model_turn:
                for part in response.server_content.model_turn.parts:
                    if part.text:
                        print(f"Gemini: {part.text}")
                    if part.inline_data:
                        print(f"Gemini sent audio bytes: len {len(part.inline_data.data)}")
            if response.server_content and response.server_content.turn_complete:
                print("Turn complete")
                break

if __name__ == "__main__":
    asyncio.run(main())
