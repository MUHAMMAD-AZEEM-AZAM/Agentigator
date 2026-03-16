"""
Test client to verify WebSocket connection and message flow.
"""
import asyncio
import websockets
import json
import base64

WS_URL = "ws://localhost:8000/ws/test_client_123"


async def test_connection():
    """Test basic WebSocket connection."""
    print("Connecting to backend...")
    
    async with websockets.connect(WS_URL) as websocket:
        print("✓ Connected successfully")
        
        # Test 1: Send configuration
        print("\n1. Sending configuration...")
        config_msg = {
            "type": "config",
            "config": {
                "language": "en"
            }
        }
        await websocket.send(json.dumps(config_msg))
        print("✓ Configuration sent")
        
        # Test 2: Simulate audio input
        print("\n2. Simulating audio input...")
        # Create dummy audio data (in real app, this would be actual PCM audio)
        dummy_audio = base64.b64encode(b"dummy_audio_data").decode('utf-8')
        audio_msg = {
            "type": "audio",
            "data": dummy_audio
        }
        await websocket.send(json.dumps(audio_msg))
        print("✓ Audio sent")
        
        # Test 3: Listen for responses
        print("\n3. Listening for responses...")
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(response)
            print(f"✓ Received response: {data.get('type')}")
            print(f"  Full response: {json.dumps(data, indent=2)}")
        except asyncio.TimeoutError:
            print("⚠ No response received (timeout)")
        
        # Test 4: Simulate tool result
        print("\n4. Simulating tool result...")
        tool_result_msg = {
            "type": "tool_result",
            "tool_name": "load_url",
            "result": {
                "status": "success",
                "message": "Page loaded successfully"
            }
        }
        await websocket.send(json.dumps(tool_result_msg))
        print("✓ Tool result sent")
        
        print("\n✓ All tests completed successfully!")


async def test_screenshot():
    """Test screenshot sending."""
    print("\nTesting screenshot functionality...")
    
    async with websockets.connect(WS_URL) as websocket:
        # Create dummy image data
        dummy_image = base64.b64encode(b"dummy_image_data").decode('utf-8')
        screenshot_msg = {
            "type": "screenshot",
            "data": dummy_image,
            "mime_type": "image/jpeg"
        }
        await websocket.send(json.dumps(screenshot_msg))
        print("✓ Screenshot sent")


if __name__ == "__main__":
    print("=" * 50)
    print("Voice Assistant Backend Test Client")
    print("=" * 50)
    
    try:
        asyncio.run(test_connection())
        asyncio.run(test_screenshot())
    except ConnectionRefusedError:
        print("\n✗ Error: Could not connect to backend")
        print("  Make sure the backend is running on http://localhost:8000")
    except Exception as e:
        print(f"\n✗ Error: {e}")
