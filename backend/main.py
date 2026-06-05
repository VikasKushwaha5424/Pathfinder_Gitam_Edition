import os
import sys  # <-- Imported sys for the Windows check
import time
import asyncio
import urllib.parse
import json
import base64
import tempfile
import traceback
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
import edge_tts
from faster_whisper import WhisperModel

# =====================================================================
# WINDOWS ASYNCIO SUBPROCESS FIX
# Forces Python to use the event loop that supports background processes
# =====================================================================
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from the .env file!")

CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")

client = genai.Client(api_key=API_KEY)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN] if CORS_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-NPC-Response"],
)

# --- LOAD LOCAL STT MODEL ---
print("Loading Whisper model (this might take a moment on first boot)...")
# UPGRADED: "small.en" is much smarter and forces English optimization
stt_model = WhisperModel("small.en", device="cpu", compute_type="int8")
print("✅ Whisper model loaded successfully!")

# --- THE PERSONALITY & VOICE ENGINE ---
NPC_PROMPTS = {}
NPC_VOICES = {}

try:
    with open("npcs.json", "r", encoding="utf-8") as file:
        npc_data = json.load(file)
        for npc_id, data in npc_data.items():
            NPC_PROMPTS[npc_id] = data.get("prompt", "")
            NPC_VOICES[npc_id] = data.get("voice", "en-US-AriaNeural")
    print(f"✅ Successfully loaded {len(npc_data)} NPCs from npcs.json")
except FileNotFoundError:
    print("❌ ERROR: npcs.json not found! Make sure it is in the backend folder.")
except json.JSONDecodeError:
    print(
        "❌ ERROR: npcs.json is improperly formatted. Check for missing commas or unescaped quotes."
    )

# Nested dictionary to isolate user sessions with garbage collection data
session_memories = {}


# --- HELPER FUNCTIONS ---
async def _transcribe_bytes(audio_bytes: bytes) -> str:
    """Transcribe raw audio bytes using faster-whisper."""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name

        def run_stt():
            segments, _ = stt_model.transcribe(
                temp_path, 
                beam_size=1,
                language="en",
                vad_filter=True
            )
            return "".join([segment.text for segment in segments])

        transcript = await asyncio.to_thread(run_stt)
        os.remove(temp_path)
        return transcript.strip()
    except Exception as e:
        print(f"STT Error: {e}")
        return "[Error transcribing audio]"


async def transcribe_audio(base64_audio: str) -> str:
    """Decodes base64 audio and transcribes it using faster-whisper."""
    try:
        audio_data = base64.b64decode(base64_audio)
        return await _transcribe_bytes(audio_data)
    except Exception as e:
        print(f"STT Decode Error: {e}")
        return "[Error transcribing audio]"


def clean_text_for_voice(text: str) -> str:
    text = text.replace("*", "").replace("#", "").replace("_", "")
    return text


# --- GARBAGE COLLECTOR TASK ---
async def clean_old_sessions():
    """Runs in the background to delete sessions inactive for over 1 hour"""
    while True:
        await asyncio.sleep(3600)
        current_time = time.time()
        expired_sessions = [
            sid
            for sid, s_data in session_memories.items()
            if current_time - s_data["last_active"] > 3600
        ]
        for sid in expired_sessions:
            del session_memories[sid]
            print(f"Garbage Collector: Deleted inactive session {sid}")


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(clean_old_sessions())


# --- PYDANTIC VALIDATION ---
class UserInput(BaseModel):
    text: str = Field(..., min_length=2, max_length=300)
    npc_id: str = "maya"
    world_state: dict = Field(
        default_factory=dict
    )  # UPGRADED to accept complex JSON telemetry
    location: str = ""
    session_id: str = "default_user"


CAMPUS_LOCATIONS = {
    "library": "GITAM Central Library — quiet study zones, book sections, and digital resources",
    "admin_block": "Administrative Block — admissions, fees, registrar, and student services",
    "cse_department": "Computer Science & Engineering Department — labs, faculty offices, and lecture halls",
    "canteen": "University Canteen & Food Court — snacks, meals, and refreshments",
    "sports_complex": "Sports Complex — indoor courts, gymnasium, and outdoor fields",
    "auditorium": "Main Auditorium — events, seminars, and cultural programs",
    "hostel_block": "Student Hostels — accommodation, warden office, and common rooms",
    "parking": "Campus Parking — visitor parking, bike stands, and shuttle stop",
}


@app.get("/")
async def root():
    return {"message": "System Online: XR-NPC Backend running with HTTP & WebSockets!"}


@app.get("/locations")
async def get_locations():
    return CAMPUS_LOCATIONS


# --- 1. RESET ENDPOINT ---
class ResetInput(BaseModel):
    npc_id: str
    session_id: str = "default_user"


@app.post("/reset")
async def reset_memory(reset_input: ResetInput):
    npc = reset_input.npc_id.lower()
    session = reset_input.session_id

    if session in session_memories and npc in session_memories[session]["data"]:
        session_memories[session]["data"][npc] = []
        return {
            "message": f"[{npc.upper()}] Memory wiped successfully for session {session}."
        }
    return {"message": "No memory found to wipe."}


# =====================================================================
# WEB UI INTEGRATION: AUDIO TRANSCRIPTION ENDPOINT
# =====================================================================
@app.post("/transcribe")
async def transcribe_upload(
    file: UploadFile = File(...),
    location: str = Form(""),
):
    audio_bytes = await file.read()
    transcript = await _transcribe_bytes(audio_bytes)
    return {"transcript": transcript, "location": location, "filename": file.filename}


# =====================================================================
# UNITY VR INTEGRATION: WEBSOCKET ENDPOINT (With FFmpeg PCM Transcoding)
# =====================================================================
@app.websocket("/ws/npc/{npc_id}/{session_id}")
async def npc_websocket(websocket: WebSocket, npc_id: str, session_id: str):
    await websocket.accept()

    npc = npc_id.lower()
    if npc not in NPC_PROMPTS:
        await websocket.send_json({"type": "error", "message": "Invalid NPC ID"})
        await websocket.close()
        return

    if session_id not in session_memories:
        session_memories[session_id] = {
            "last_active": time.time(),
            "data": {k: [] for k in NPC_PROMPTS.keys()},
        }

    if npc not in session_memories[session_id]["data"]:
        session_memories[session_id]["data"][npc] = []

    history = session_memories[session_id]["data"][npc]
    system_prompt = NPC_PROMPTS[npc]

    try:
        while True:
            data = await websocket.receive_json()
            session_memories[session_id]["last_active"] = time.time()

            event_type = data.get("event_type", "speech")
            payload = data.get("payload", "")
            world_state = data.get("world_state", {})

            world_state_json = json.dumps(world_state)

            stt_time = 0
            llm_time = 0
            tts_time = 0

            # --- ROUTE INCOMING PAYLOAD BASED ON EVENT TYPE ---
            if event_type == "audio":
                print("🎙️ Receiving audio payload from Unity...")
                stt_start = time.time()
                user_text = await transcribe_audio(payload)
                stt_time = time.time() - stt_start
                
                # If the VAD filter strips out all the noise and leaves nothing, skip generating a response
                if not user_text:
                    print("🔇 No speech detected (filtered out static).")
                    await websocket.send_json({"type": "done"})
                    continue
                    
                print(f"📝 Transcribed: {user_text} (STT: {stt_time*1000:.0f}ms)")

                # Send the transcript back so Unity UI can display what it heard
                await websocket.send_json(
                    {"type": "user_transcript", "content": user_text}
                )
                injected_prompt = (
                    f"[System World State: {world_state_json}] User says: {user_text}"
                )

            elif event_type == "gesture":
                injected_prompt = f"[System World State: {world_state_json}] The user performed a gesture: {payload}"
            else:
                injected_prompt = (
                    f"[System World State: {world_state_json}] User says: {payload}"
                )

            history.append(
                types.Content(
                    role="user", parts=[types.Part.from_text(text=injected_prompt)]
                )
            )

            llm_start = time.time()
            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=300,
                    temperature=0.8,
                ),
            )
            llm_time = time.time() - llm_start

            history.append(
                types.Content(
                    role="model", parts=[types.Part.from_text(text=response.text)]
                )
            )

            if len(history) > 10:
                del history[:-10]

            await websocket.send_json({"type": "text", "content": response.text})

            # 5. STREAM AUDIO AS BASE64 CHUNKS (Transcoded to Raw PCM)
            tts_start = time.time()
            spoken_text = clean_text_for_voice(response.text)
            voice = NPC_VOICES.get(npc, "en-US-AriaNeural")
            ffmpeg_process = None
            try:
                ffmpeg_process = await asyncio.create_subprocess_exec(
                    "ffmpeg.exe",
                    "-i",
                    "pipe:0",
                    "-f",
                    "f32le",
                    "-acodec",
                    "pcm_f32le",
                    "-ar",
                    "24000",
                    "-ac",
                    "1",
                    "pipe:1",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )

                async def push_audio():
                    communicate = edge_tts.Communicate(spoken_text, voice)
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            ffmpeg_process.stdin.write(chunk["data"])
                            await ffmpeg_process.stdin.drain()
                    ffmpeg_process.stdin.close()
                    await ffmpeg_process.stdin.wait_closed()

                async def read_audio():
                    while True:
                        pcm_chunk = await ffmpeg_process.stdout.read(4096)
                        if not pcm_chunk:
                            break
                        audio_b64 = base64.b64encode(pcm_chunk).decode("utf-8")
                        await websocket.send_json(
                            {
                                "type": "audio_chunk",
                                "data": audio_b64,
                                "format": "f32le",
                                "sample_rate": 24000,
                            }
                        )

                await asyncio.gather(push_audio(), read_audio())

            except Exception as stream_error:
                print(f"❌ TTS WebSocket Stream interrupted: {stream_error}")
                traceback.print_exc()
                await websocket.send_json(
                    {"type": "error", "message": "Audio stream failed."}
                )
            finally:
                if ffmpeg_process is not None and ffmpeg_process.returncode is None:
                    ffmpeg_process.kill()
                    await ffmpeg_process.wait()

            tts_time = time.time() - tts_start
            print(f"[TIMING] STT: {stt_time*1000:.0f}ms | LLM: {llm_time*1000:.0f}ms | TTS: {tts_time*1000:.0f}ms")

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        print(f"Unity Client {session_id} disconnected.")

    except Exception as e:
        print(f"WebSocket Error: {e}")
        if history and history[-1].role == "model":
            history.pop()
        if history and history[-1].role == "user":
            history.pop()
        await websocket.send_json({"type": "error", "message": str(e)})


# =====================================================================
# WEB UI INTEGRATION: LEGACY HTTP POST ENDPOINT
# =====================================================================
@app.post("/generate")
async def generate_response(user_input: UserInput):
    if user_input.text == "[WARMUP_PING]":

        async def empty_stream():
            yield b""

        return StreamingResponse(
            empty_stream(),
            media_type="audio/mpeg",
            headers={"X-NPC-Response": "System Warmed Up"},
        )

    npc = user_input.npc_id.lower()
    session = user_input.session_id

    if npc not in NPC_PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid NPC ID.")

    if session not in session_memories:
        session_memories[session] = {
            "last_active": time.time(),
            "data": {k: [] for k in NPC_PROMPTS.keys()},
        }

    session_memories[session]["last_active"] = time.time()

    if npc not in session_memories[session]["data"]:
        session_memories[session]["data"][npc] = []

    history = session_memories[session]["data"][npc]
    system_prompt = NPC_PROMPTS[npc]

    try:
        world_state = dict(user_input.world_state)
        if user_input.location:
            world_state["location"] = user_input.location
            location_desc = CAMPUS_LOCATIONS.get(
                user_input.location,
                f"the {user_input.location.replace('_', ' ').title()} area",
            )
            world_state["location_description"] = location_desc

        world_state_json = json.dumps(world_state)

        injected_prompt = (
            f"[System World State: {world_state_json}] User says: {user_input.text}"
        )
        history.append(
            types.Content(
                role="user", parts=[types.Part.from_text(text=injected_prompt)]
            )
        )

        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt, max_output_tokens=300, temperature=0.8
            ),
        )

        history.append(
            types.Content(
                role="model", parts=[types.Part.from_text(text=response.text)]
            )
        )

        if len(history) > 10:
            del history[:-10]

        spoken_text = clean_text_for_voice(response.text)
        voice = NPC_VOICES.get(npc, "en-US-AriaNeural")

        async def audio_stream():
            try:
                communicate = edge_tts.Communicate(spoken_text, voice)
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]
            except Exception as stream_error:
                print(f"TTS Stream interrupted: {stream_error}")
                if history and history[-1].role == "model":
                    history.pop()
                if history and history[-1].role == "user":
                    history.pop()

        header_text = response.text
        if len(header_text) > 1000:
            header_text = header_text[:1000] + "..."

        encoded_text = urllib.parse.quote(header_text)

        return StreamingResponse(
            audio_stream(),
            media_type="audio/mpeg",
            headers={"X-NPC-Response": encoded_text},
        )

    except Exception as e:
        if history and history[-1].role == "model":
            history.pop()

        if history and history[-1].role == "user":
            history.pop()

        error_msg = str(e).lower()
        if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
            raise HTTPException(status_code=429, detail="[ERROR_QUOTA_EXHAUSTED]")

        raise HTTPException(status_code=500, detail=str(e))