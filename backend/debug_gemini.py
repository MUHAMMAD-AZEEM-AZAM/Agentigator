import os
import asyncio
import base64
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
        
        # Test just a simple text input first
        await session.send_realtime_input(text="Hello, Gemini! Can you hear me?")
        print("Sent hello")
        
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
