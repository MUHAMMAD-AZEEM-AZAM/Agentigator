"""
Gemini Live Agent with browser automation tools.
Real-time audio streaming using Google GenAI SDK.
"""
import asyncio
import json
import os
import base64
import time
from typing import Optional, Dict, Any, List
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-native-audio-latest"


import subprocess
import tempfile
import struct
import wave
import io

class GeminiLiveAgent:
    """Real-time voice agent with browser automation."""

    def __init__(self, client_id: str, session_manager, websocket, audio_wav_files=None):
        self.client_id = client_id
        self.session_manager = session_manager
        self.client_websocket = websocket
        self.session: Optional[genai.live.AsyncSession] = None
        self.is_running = False
        self._current_turn_id = 0
        self.audio_wav_files = audio_wav_files if audio_wav_files is not None else {}
        self._stream_buffers: Dict[str, bytearray] = {}
        self._stream_started: Dict[str, bool] = {}
        # 1.0s of 24kHz 16-bit mono PCM = 48,000 bytes
        self._stream_chunk_bytes = 48000
        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=10)
        self._audio_send_task: Optional[asyncio.Task] = None
        # 0.5s of 16kHz 16-bit mono PCM = 16,000 bytes
        self._max_send_bytes = 16000
        self._restart_lock = asyncio.Lock()
        self._session_ready = False
        self._session_ready_at = 0.0
        self._preferred_language = "en"
        try:
            session = self.session_manager.get_session(client_id)
            if session and session.get("language"):
                self._preferred_language = session["language"]
        except Exception:
            pass
        self._audio_disabled_until = 0.0
        self._suppress_audio_until = 0.0
        
        # Audio debugging setup
        os.makedirs("debug_audio", exist_ok=True)
        self.user_pcm_file = open(f"debug_audio/{client_id}_in.pcm", "wb")
        self.agent_pcm_file = open(f"debug_audio/{client_id}_out.pcm", "wb")

        # Initialize GenAI client
        self.client = genai.Client(api_key=GEMINI_API_KEY)

    def _get_config(self) -> types.LiveConnectConfig:
        """Get Live API configuration."""
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Puck"
                    )
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=self._get_system_instruction())]
            ),
            tools=[
                types.Tool(function_declarations=self._get_function_declarations())
            ]
        )

    def _get_system_instruction(self) -> str:
        return f"""You are a helpful, friendly voice assistant. You speak naturally and warmly, like a real human assistant.

PREFERRED_LANGUAGE:
- {self._preferred_language}

GREETING:
- ALWAYS begin the conversation with a warm greeting in the appropriate language.
- If the user's language is unclear, greet in English first.
- Example: "Hi there! I'm your assistant. How can I help you today?"

CORE BEHAVIOR:
- Have natural conversations. Be warm, concise, and helpful.
- Keep responses SHORT and conversational — you are speaking out loud, not writing an essay.
- When the user asks you to do something on a website, use the browser tools.
- Briefly explain what you're doing (e.g., "Opening Google for you" or "Filling in your name").
- Before calling any browser tool, always say a short acknowledgement of the action you're about to take.
- If you need more visual detail or can't find a selector, call take_screenshot() before trying again.
- The screenshot includes the browser if visible; otherwise it captures the app screen.
- Always use the browser tools for any web search or web task. Do not use any non-browser search.
- If a tool fails because the browser is not ready, ask for a moment and try the browser tool again.
- Keep the conversation flowing — don't go silent.
- Work independently: do not ask the user for confirmations about clicks or form submission.
- Only ask the user when you need information that is required to proceed and not visible on the screen.
- If an action fails, take a screenshot, read the page text, try a different selector, and retry without asking the user.

LANGUAGE:
- Preferred language may be provided by the app. Respect it unless the user explicitly asks to switch.
- If preferred language is Urdu, respond in Urdu (not Hindi) and use simple Urdu with English keywords for form fields and buttons.
- If preferred language is Hindi, respond in Hindi.
- If preferred language is English, respond in English unless the user clearly uses many words from another language or asks to switch.
- If the user mixes Urdu/Hindi words and it's ambiguous, default to Urdu.

WEB SEARCH:
- If you need to search for something, use the `search_web` tool.
- This will open google.com and search for the query automatically.
- Once the page loads, use `get_page_text` to read the results or click links.

FORM FILLING WORKFLOW:
- When the user asks to fill a form, first load the URL.
- Ask for information one piece at a time.
- If the user provides all info at once, fill everything at once.
- After filling fields, confirm what you did.
- Use get_page_text() to read the page before interacting with it.

BROWSER TOOLS:
- load_url(url): Open a website in the browser
- click_element(selector, description): Click an element on the page
- type_text(selector, text, description): Type text into a field
- scroll_page(direction, amount): Scroll the page up or down
- get_page_info(): Get basic page info (URL, title, ready state)
- get_page_text(): Get the visible text content of the page to understand what's on screen
- take_screenshot(): Capture a screenshot of the current screen for visual context
- submit_form(selector): Submit a form on the page
- wait_for_element(selector, timeout): Wait for an element to appear
- close_browser(): Close the browser when the task is fully complete

HANDLING OBSTACLES:
- If you encounter a CAPTCHA, tell the user: "I see a CAPTCHA. Could you please solve it? Let me know when you're done."
- If you can't find an element, guide the user: "I'm having trouble with that button. Could you tap it yourself?"
- If a page takes time to load, say: "The page is still loading, give me a moment."
- NEVER stop abruptly or give up silently.

IMPORTANT:
- The browser opens inside the user's phone app. They can see what you're doing.
- Keep the session going even after completing a task.
- Remember the full conversation context.
- Always take a screenshot before confirming that a task is completed. Analyze it and retry if not complete.
- When asked to fill a form and the website is unknown, search for it and navigate yourself.
- Once you open the website, find the form and start filling it by asking only for missing personal info.
- Retry actions 2-3 times with different selectors and page reads before asking the user about a blocker.
"""

    def _get_function_declarations(self) -> list:
        """Browser automation function declarations."""
        return [
            types.FunctionDeclaration(
                name="search_web",
                description="Search the web using Google. This will automatically load Google and execute the search query.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query": types.Schema(type=types.Type.STRING, description="The search query to look up")
                    },
                    required=["query"]
                )
            ),
            types.FunctionDeclaration(
                name="load_url",
                description="Load a URL in the embedded browser. Use this when the user asks to open a specific website.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "url": types.Schema(type=types.Type.STRING, description="The full URL to load, e.g. https://google.com")
                    },
                    required=["url"]
                )
            ),
            types.FunctionDeclaration(
                name="click_element",
                description="Click an element on the current page. Use a CSS selector to identify the element.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "selector": types.Schema(type=types.Type.STRING, description="CSS selector of the element to click"),
                        "description": types.Schema(type=types.Type.STRING, description="Human-readable description of what is being clicked")
                    },
                    required=["selector"]
                )
            ),
            types.FunctionDeclaration(
                name="type_text",
                description="Type text into an input field on the page",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "selector": types.Schema(type=types.Type.STRING, description="CSS selector of the input field"),
                        "text": types.Schema(type=types.Type.STRING, description="The text to type"),
                        "description": types.Schema(type=types.Type.STRING, description="Human-readable description of the field")
                    },
                    required=["selector", "text"]
                )
            ),
            types.FunctionDeclaration(
                name="scroll_page",
                description="Scroll the page up or down",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "direction": types.Schema(type=types.Type.STRING, description="'up' or 'down'"),
                        "amount": types.Schema(type=types.Type.NUMBER, description="Pixels to scroll, default 300")
                    },
                    required=["direction"]
                )
            ),
            types.FunctionDeclaration(
                name="get_page_info",
                description="Get basic page info: URL, title, and ready state",
                parameters=types.Schema(type=types.Type.OBJECT, properties={})
            ),
            types.FunctionDeclaration(
                name="get_page_text",
                description="Get the visible text content of the current page. Use this to understand what is on screen before performing actions.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={})
            ),
            types.FunctionDeclaration(
                name="take_screenshot",
                description="Capture a screenshot of the current screen (browser if visible, otherwise app). Use this when selectors are unclear or you need visual context.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={})
            ),
            types.FunctionDeclaration(
                name="submit_form",
                description="Submit a form on the page by clicking the submit button or calling form.submit()",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "selector": types.Schema(type=types.Type.STRING, description="CSS selector of the form or submit button")
                    },
                    required=["selector"]
                )
            ),
            types.FunctionDeclaration(
                name="wait_for_element",
                description="Wait for a specific element to appear on the page before proceeding",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "selector": types.Schema(type=types.Type.STRING, description="CSS selector to wait for"),
                        "timeout": types.Schema(type=types.Type.NUMBER, description="Maximum time to wait in milliseconds, default 5000")
                    },
                    required=["selector"]
                )
            ),
            types.FunctionDeclaration(
                name="close_browser",
                description="Close the browser after the task is fully complete",
                parameters=types.Schema(type=types.Type.OBJECT, properties={})
            )
        ]

    async def start(self):
        """Start the Live API session."""
        try:
            config = self._get_config()
            self._session_cm = self.client.aio.live.connect(model=MODEL, config=config)
            self.session = await self._session_cm.__aenter__()
            logger.info(f"✓ Client {self.client_id}: Connected to Gemini Live API")

            self.is_running = True
            self._session_ready = False
            self._session_ready_at = time.time() + 1.0
            self._audio_send_task = asyncio.create_task(self._audio_sender_loop())

            # Start receive loop in background
            asyncio.create_task(self._receive_loop())

            # Notify client that connection is ready
            await self._send_to_client({
                "type": "connection_ready",
                "message": "Connected to AI assistant"
            })

        except Exception as e:
            logger.error(f"Failed to connect to Gemini: {e}")
            await self._send_to_client({
                "type": "error",
                "message": f"Failed to connect to AI: {str(e)}"
            })
            raise

    async def stop(self, close_debug_files: bool = True):
        """Stop the session."""
        self.is_running = False
        self._session_ready = False
        if self._audio_send_task:
            self._audio_send_task.cancel()
            self._audio_send_task = None
        if hasattr(self, '_session_cm'):
            try:
                await self._session_cm.__aexit__(None, None, None)
            except Exception:
                pass
            
        if close_debug_files:
            if hasattr(self, 'user_pcm_file') and not self.user_pcm_file.closed:
                self.user_pcm_file.close()
            if hasattr(self, 'agent_pcm_file') and not self.agent_pcm_file.closed:
                self.agent_pcm_file.close()
            
        logger.info(f"Client {self.client_id}: Session closed")

    def _decode_audio(self, audio_bytes: bytes) -> bytes:
        """
        Decode incoming audio (which might be an MP4/M4A/WebM container from expo-av)
        into raw 16kHz 16-bit mono PCM required by Gemini.
        """
        try:
            # We use ffmpeg to decode the stream via stdin/stdout
            # -f s16le: output raw 16-bit little endian PCM
            # -ac 1: 1 channel (mono)
            # -ar 16000: 16kHz sample rate
            process = subprocess.Popen(
                ["ffmpeg", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1", "-loglevel", "error"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            if isinstance(audio_bytes, str):
                audio_bytes = audio_bytes.encode()
                
            pcm_bytes, stderr = process.communicate(input=audio_bytes)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg decode error: {stderr}")
                return b""
                
            return pcm_bytes if pcm_bytes else b""
            
        except Exception as e:
            logger.error(f"Error in FFmpeg processing: {e}")
            return b""

    async def send_audio(self, audio_base64: str):
        """Send audio chunk to Gemini Live API."""
        if not self.session or not self.is_running:
            return

        try:
            # Step 1: Decode base64 to original AAC/M4A bytes (from expo-av)
            original_bytes = base64.b64decode(audio_base64)
            
            # Step 2: Use FFmpeg to decode the container format into raw PCM
            pcm_bytes = self._decode_audio(original_bytes)
            
            if not pcm_bytes:
                logger.warning(f"[{self.client_id}] Empty PCM data, skipping")
                return
                
            logger.info(f"[{self.client_id}] Converted {len(original_bytes)} incoming bytes -> {len(pcm_bytes)} PCM bytes")
            
            # Save raw user PCM for debugging
            if hasattr(self, 'user_pcm_file') and not self.user_pcm_file.closed:
                self.user_pcm_file.write(pcm_bytes)
                self.user_pcm_file.flush()

            # Step 3: Enqueue the clean PCM stream for sending
            if self._audio_queue.full():
                try:
                    _ = self._audio_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await self._audio_queue.put(pcm_bytes)
        except Exception as e:
            logger.error(f"Error sending audio to Gemini: {e}")

    async def _audio_sender_loop(self):
        """Serialize audio sends and apply backpressure to avoid timeouts."""
        while self.is_running and self.session:
            try:
                pcm_bytes = await self._audio_queue.get()
                if not pcm_bytes:
                    continue
                if time.time() < self._audio_disabled_until:
                    continue
                if time.time() < self._session_ready_at:
                    continue
                if not self.session:
                    continue
                # Chunk large buffers to keep each send under 1s of audio
                offset = 0
                while offset < len(pcm_bytes):
                    chunk = pcm_bytes[offset:offset + self._max_send_bytes]
                    offset += self._max_send_bytes
                    try:
                        await asyncio.wait_for(
                            self.session.send_realtime_input(
                                audio=types.Blob(
                                    data=chunk,
                                    mime_type="audio/pcm;rate=16000"
                                )
                            ),
                            timeout=1.5
                        )
                    except asyncio.TimeoutError:
                        logger.warning("Audio send timed out; dropping chunk")
                        break
                    except Exception as e:
                        logger.error(f"Audio send error: {e}")
                        if "1008" in str(e) or "1011" in str(e):
                            self._audio_disabled_until = time.time() + 2.0
                            asyncio.create_task(self._restart_session("audio_send_error"))
                        break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Audio sender loop error: {e}")

    async def _restart_session(self, reason: str):
        async with self._restart_lock:
            if not self.is_running:
                return
            logger.warning(f"Restarting Gemini session due to: {reason}")
            try:
                await self.stop(close_debug_files=False)
            except Exception:
                pass
            try:
                while not self._audio_queue.empty():
                    _ = self._audio_queue.get_nowait()
            except Exception:
                pass
            await asyncio.sleep(0.2)
            try:
                await self.start()
            except Exception as e:
                logger.error(f"Failed to restart Gemini session: {e}")

    async def handle_user_interrupt(self):
        """Notify Gemini that the user is interrupting and wants to speak."""
        if not self.session:
            return
        try:
            self._suppress_audio_until = time.time() + 1.5
            await self.session.send_realtime_input(
                text="User interruption: stop speaking and listen."
            )
        except Exception as e:
            logger.error(f"Error sending user interrupt: {e}")

    async def _receive_loop(self):
        """Background task to receive responses from Gemini Live API."""
        try:
            while self.is_running and self.session:
                turn = self.session.receive()
                
                turn_id = str(self._current_turn_id)
                
                # Accumulate PCM chunks for this turn
                pcm_chunks = []
                if turn_id not in self._stream_buffers:
                    self._stream_buffers[turn_id] = bytearray()
                if turn_id not in self._stream_started:
                    self._stream_started[turn_id] = False
                
                async for response in turn:
                    # Handle audio + text from model turn
                    if response.server_content and response.server_content.model_turn:
                        for part in response.server_content.model_turn.parts:
                            # Audio data — accumulate raw PCM
                            if part.inline_data and part.inline_data.data:
                                pcm_data = part.inline_data.data
                                pcm_chunks.append(pcm_data)
                                await self._stream_audio_chunk(turn_id, pcm_data)

                            # Text data
                            if part.text:
                                logger.info(f"Agent says: {part.text}")
                                await self._send_to_client({
                                    "type": "agent_text",
                                    "text": part.text
                                })

                    # Handle turn complete
                    if response.server_content and response.server_content.turn_complete:
                        # Write accumulated PCM to a WAV file and serve it
                        if pcm_chunks:
                            # Only send full WAV URL if we did not already stream chunks
                            if not self._stream_started.get(turn_id, False):
                                wav_url = await self._write_turn_wav(turn_id, pcm_chunks)
                                if wav_url:
                                    await self._send_to_client({
                                        "type": "agent_stream_start",
                                        "url": wav_url,
                                        "turnId": turn_id
                                    })
                        
                        await self._flush_stream_buffer(turn_id)
                        
                        self._current_turn_id += 1
                        await self._send_to_client({
                            "type": "turn_complete"
                        })
                        pcm_chunks = []

                    # Handle tool calls
                    if response.tool_call:
                        await self._handle_tool_call(response.tool_call)

        except asyncio.CancelledError:
            logger.info("Receive loop cancelled")
        except Exception as e:
            if self.is_running:
                logger.error(f"Error in receive loop: {e}")
                await self._send_to_client({
                    "type": "error",
                    "message": "Connection to AI was interrupted. Reconnecting..."
                })

    async def _write_turn_wav(self, turn_id: str, pcm_chunks: list) -> str:
        """
        Write accumulated 24kHz PCM chunks to a WAV file and return its URL.
        Gemini outputs 24kHz/16-bit/mono PCM.
        """
        try:
            all_pcm = b''.join(pcm_chunks)
            if not all_pcm:
                return ""
            
            logger.info(f"[{self.client_id}] Writing {len(all_pcm)} bytes of PCM to WAV for turn {turn_id}")
            
            # Create WAV in memory
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wf:
                wf.setnchannels(1)        # mono
                wf.setsampwidth(2)        # 16-bit = 2 bytes
                wf.setframerate(24000)    # Gemini outputs 24kHz
                wf.writeframes(all_pcm)
            
            # Save agent PCM for debugging
            if hasattr(self, 'agent_pcm_file') and not self.agent_pcm_file.closed:
                self.agent_pcm_file.write(all_pcm)
                self.agent_pcm_file.flush()
                
            # Also save exactly the WAV that is produced
            with open(f"debug_audio/{self.client_id}_agent_turn_{turn_id}.wav", "wb") as f_wav:
                f_wav.write(wav_buffer.getvalue())
            
            wav_data = wav_buffer.getvalue()
            
            # Store in the shared dict for the HTTP endpoint to serve
            if self.client_id not in self.audio_wav_files:
                self.audio_wav_files[self.client_id] = {}
            self.audio_wav_files[self.client_id][turn_id] = wav_data
            
            url = f"/audio/{self.client_id}/{turn_id}.wav"
            return url
            
        except Exception as e:
            logger.error(f"Error writing WAV file: {e}")
            return ""

    def _pcm_to_wav_bytes(self, pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
        """Wrap raw PCM in a WAV container for playback on the client."""
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)
        return wav_buffer.getvalue()

    async def _stream_audio_chunk(self, turn_id: str, pcm_data: bytes):
        """Stream audio to client in small WAV chunks while the model is still speaking."""
        if not pcm_data:
            return
        if time.time() < self._suppress_audio_until:
            return
        buffer = self._stream_buffers.get(turn_id)
        if buffer is None:
            buffer = bytearray()
            self._stream_buffers[turn_id] = buffer
        buffer.extend(pcm_data)

        if not self._stream_started.get(turn_id, False):
            self._stream_started[turn_id] = True
            await self._send_to_client({
                "type": "agent_audio_start",
                "turnId": turn_id
            })

        while len(buffer) >= self._stream_chunk_bytes:
            chunk = bytes(buffer[:self._stream_chunk_bytes])
            del buffer[:self._stream_chunk_bytes]
            wav_bytes = self._pcm_to_wav_bytes(chunk, 24000)
            await self._send_to_client({
                "type": "agent_audio_chunk",
                "turnId": turn_id,
                "audio": base64.b64encode(wav_bytes).decode()
            })

    async def _flush_stream_buffer(self, turn_id: str):
        """Flush any remaining audio and mark the stream end."""
        buffer = self._stream_buffers.get(turn_id)
        if buffer and len(buffer) > 0:
            wav_bytes = self._pcm_to_wav_bytes(bytes(buffer), 24000)
            await self._send_to_client({
                "type": "agent_audio_chunk",
                "turnId": turn_id,
                "audio": base64.b64encode(wav_bytes).decode()
            })
        await self._send_to_client({
            "type": "agent_audio_end",
            "turnId": turn_id
        })
        if turn_id in self._stream_buffers:
            del self._stream_buffers[turn_id]
        if turn_id in self._stream_started:
            del self._stream_started[turn_id]

    async def _handle_tool_call(self, tool_call):
        """Handle tool calls from Gemini — send to mobile app for execution."""
        for fc in tool_call.function_calls:
            logger.info(f"Tool call: {fc.name}({fc.args})")

            # Special case: close_browser is handled locally
            if fc.name == "close_browser":
                await self._send_to_client({
                    "type": "browser_action",
                    "action": "close_browser",
                    "params": {}
                })
                # Send tool response back to Gemini immediately
                await self._send_tool_response_to_gemini(
                    fc.name, fc.id, {"status": "success", "message": "Browser closed"}
                )
                return

            # For all other tool calls, send to mobile app and wait for result
            await self._send_to_client({
                "type": "browser_action",
                "action": fc.name,
                "params": dict(fc.args) if fc.args else {},
                "tool_call_id": fc.id
            })

    async def handle_tool_result(self, tool_name: str, tool_call_id: str, result: dict):
        """Send tool execution result back to Gemini."""
        await self._send_tool_response_to_gemini(tool_name, tool_call_id, result)

    async def _send_tool_response_to_gemini(self, tool_name: str, tool_call_id: str, result: dict):
        """Send a function response back to Gemini Live session."""
        if not self.session:
            return
        if not tool_call_id:
            logger.warning(f"Missing tool_call_id for {tool_name}, skipping tool response")
            return

        try:
            function_response = types.FunctionResponse(
                name=tool_name,
                id=tool_call_id,
                response=result
            )

            await self.session.send_tool_response(
                function_responses=[function_response]
            )
            logger.info(f"Tool response sent for: {tool_name}")

        except Exception as e:
            logger.error(f"Error sending tool response: {e}")

    async def send_screenshot(self, image_base64: str, mime_type: str = "image/jpeg"):
        """Send screenshot to Gemini for visual understanding."""
        if not self.session:
            return

        try:
            image_bytes = base64.b64decode(image_base64)

            await self.session.send_realtime_input(
                media=types.Blob(
                    data=image_bytes,
                    mime_type=mime_type
                )
            )
            logger.info("Screenshot sent to Gemini")
        except Exception as e:
            logger.error(f"Error sending screenshot: {e}")

    async def update_config(self, config: dict):
        """Update agent configuration (language, etc.)."""
        language = config.get("language")
        if language:
            self._preferred_language = language
            try:
                self.session_manager.update_session(self.client_id, {"language": language})
            except Exception:
                pass
            if self.session:
                try:
                    language_names = {"en": "English", "ur": "Urdu", "hi": "Hindi"}
                    language_label = language_names.get(language, language)
                    await self.session.send_realtime_input(
                        text=f"Preferred language is {language_label}. Follow the language rules."
                    )
                except Exception as e:
                    logger.error(f"Error sending language hint: {e}")
        logger.info(f"Config update: {config}")

    async def resume_after_user_action(self):
        """Resume after user completed a manual action (e.g., CAPTCHA)."""
        if not self.session:
            return

        try:
            # Send a text message to Gemini to let it know the user finished
            await self.session.send_realtime_input(
                text="The user has completed the manual action. Please continue with the task."
            )
            logger.info("Resumed after user action")
        except Exception as e:
            logger.error(f"Error resuming after user action: {e}")

    async def _send_to_client(self, message: dict):
        """Send message to mobile app via WebSocket."""
        try:
            await self.client_websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending to client: {e}")
