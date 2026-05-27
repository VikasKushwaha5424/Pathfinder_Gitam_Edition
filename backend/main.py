import os
import time
import asyncio
import urllib.parse
import json
import base64
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types
import edge_tts

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from the .env file!")

client = genai.Client(api_key=API_KEY)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-NPC-Response"] 
)

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
    print("❌ ERROR: npcs.json is improperly formatted. Check for missing commas or unescaped quotes.")

# Nested dictionary to isolate user sessions with garbage collection data
session_memories = {}

# --- GARBAGE COLLECTOR TASK ---
async def clean_old_sessions():
    """Runs in the background to delete sessions inactive for over 1 hour"""
    while True:
        await asyncio.sleep(3600) 
        current_time = time.time()
        expired_sessions = [
            sid for sid, s_data in session_memories.items() 
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
    world_state: dict = Field(default_factory=dict) # UPGRADED to accept complex JSON telemetry
    session_id: str = "default_user" 

def clean_text_for_voice(text: str) -> str:
    text = text.replace("*", "").replace("#", "").replace("_", "")
    return text

@app.get("/")
async def root():
    return {"message": "System Online: XR-NPC Backend running with HTTP & WebSockets!"}

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
        return {"message": f"[{npc.upper()}] Memory wiped successfully for session {session}."}
    return {"message": "No memory found to wipe."}


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
            "data": {k: [] for k in NPC_PROMPTS.keys()}
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

            if event_type == "gesture":
                injected_prompt = f"[System World State: {world_state_json}] The user performed a gesture: {payload}"
            else:
                injected_prompt = f"[System World State: {world_state_json}] User says: {payload}"

            history.append(types.Content(role="user", parts=[types.Part.from_text(text=injected_prompt)]))

            if len(history) > 10:
                del history[:-10]

            response = await client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=150,
                    temperature=0.7
                )
            )

            history.append(types.Content(role="model", parts=[types.Part.from_text(text=response.text)]))

            await websocket.send_json({
                "type": "text",
                "content": response.text
            })

            # 5. STREAM AUDIO AS BASE64 CHUNKS (Transcoded to Raw PCM)
            spoken_text = clean_text_for_voice(response.text)
            voice = NPC_VOICES.get(npc, "en-US-AriaNeural")

            try:
                # Start FFmpeg subprocess
                # -i pipe:0 reads the MP3 stream from stdin
                # -f f32le outputs Raw 32-bit Float PCM (Unity's native format)
                ffmpeg_process = await asyncio.create_subprocess_exec(
                    "ffmpeg",
                    "-i", "pipe:0",
                    "-f", "f32le",
                    "-acodec", "pcm_f32le",
                    "-ar", "24000", # Match edge-tts sample rate
                    "-ac", "1",     # Mono
                    "pipe:1",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL
                )

                # Task 1: Feed MP3 stream into FFmpeg
                async def push_audio():
                    communicate = edge_tts.Communicate(spoken_text, voice)
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            ffmpeg_process.stdin.write(chunk["data"])
                            await ffmpeg_process.stdin.drain()
                    ffmpeg_process.stdin.close()
                    await ffmpeg_process.stdin.wait_closed()

                # Task 2: Read PCM stream from FFmpeg and send to Unity
                async def read_audio():
                    while True:
                        # Read 4KB chunks of pure PCM float data
                        pcm_chunk = await ffmpeg_process.stdout.read(4096)
                        if not pcm_chunk:
                            break
                        
                        audio_b64 = base64.b64encode(pcm_chunk).decode('utf-8')
                        await websocket.send_json({
                            "type": "audio_chunk",
                            "data": audio_b64,
                            "format": "f32le",
                            "sample_rate": 24000
                        })

                # Run both tasks concurrently to achieve zero-latency streaming
                await asyncio.gather(push_audio(), read_audio())

            except Exception as stream_error:
                print(f"TTS WebSocket Stream interrupted: {stream_error}")
                await websocket.send_json({"type": "error", "message": "Audio stream failed."})

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        print(f"Unity Client {session_id} disconnected.")
        if session_id in session_memories:
             del session_memories[session_id]
             
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
            headers={"X-NPC-Response": "System Warmed Up"}
        )

    npc = user_input.npc_id.lower()
    session = user_input.session_id

    if npc not in NPC_PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid NPC ID.")

    if session not in session_memories:
        session_memories[session] = {
            "last_active": time.time(), 
            "data": {k: [] for k in NPC_PROMPTS.keys()}
        }
    
    session_memories[session]["last_active"] = time.time()
    
    if npc not in session_memories[session]["data"]:
         session_memories[session]["data"][npc] = []
         
    history = session_memories[session]["data"][npc]
    system_prompt = NPC_PROMPTS[npc]

    try:
        # Format the dictionary dynamically sent by React into a clean JSON string
        world_state_json = json.dumps(user_input.world_state)
        
        injected_prompt = f"[System World State: {world_state_json}] User says: {user_input.text}"
        history.append(types.Content(role="user", parts=[types.Part.from_text(text=injected_prompt)]))
        
        if len(history) > 10:
            del history[:-10]

        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=150,  
                temperature=0.7         
            )
        )
        
        history.append(types.Content(role="model", parts=[types.Part.from_text(text=response.text)]))
        
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
            headers={
                "X-NPC-Response": encoded_text
            }
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