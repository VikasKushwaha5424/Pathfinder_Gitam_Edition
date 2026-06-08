import json
import time
import traceback

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import state
from npcs import NPC_PROMPTS, NPC_VOICES, session_memories, get_or_create_session
from services.stt import transcribe_base64
from services.tts import clean_text, stream_tts_pcm

router = APIRouter()

NAVIGATION_LOCATIONS = [
    "library", "admin_block", "cse_department", "canteen",
    "sports_complex", "auditorium", "hostel_block", "parking",
]

NAVIGATE_TOOL = {
    "type": "function",
    "function": {
        "name": "navigate_to",
        "description": "Trigger visual navigation arrows and map guidance to a campus destination. Use this when the user asks for directions or wants to go somewhere.",
        "parameters": {
            "type": "object",
            "properties": {
                "destination": {
                    "type": "string",
                    "enum": NAVIGATION_LOCATIONS,
                    "description": "The campus location to navigate to",
                }
            },
            "required": ["destination"],
        },
    },
}


@router.websocket("/ws/npc/{npc_id}/{session_id}")
async def npc_websocket(websocket: WebSocket, npc_id: str, session_id: str):
    await websocket.accept()

    npc = npc_id.lower()
    if npc not in NPC_PROMPTS:
        await websocket.send_json({"type": "error", "message": "Invalid NPC ID"})
        await websocket.close()
        return

    history = get_or_create_session(session_id, npc)
    system_prompt = NPC_PROMPTS[npc]

    try:
        while True:
            data = await websocket.receive_json()
            session_memories[session_id]["last_active"] = time.time()

            event = data.get("event_type", "speech")
            payload = data.get("payload", "")
            world_state = json.dumps(data.get("world_state", {}))

            stt_ms = llm_ms = tts_ms = 0

            if event == "audio":
                t0 = time.time()
                user_text = await transcribe_base64(payload)
                stt_ms = (time.time() - t0) * 1000

                if not user_text:
                    await websocket.send_json({"type": "done"})
                    continue

                await websocket.send_json({"type": "user_transcript", "content": user_text})
                prompt = f"[System World State: {world_state}] User says: {user_text}"

            elif event == "gesture":
                prompt = f"[System World State: {world_state}] The user performed a gesture: {payload}"
            else:
                if isinstance(payload, str) and not payload.strip():
                    await websocket.send_json({"type": "done"})
                    continue
                prompt = f"[System World State: {world_state}] User says: {payload}"

            messages = [{"role": "system", "content": system_prompt}]
            for msg in history[-10:]:
                messages.append(msg)
            messages.append({"role": "user", "content": prompt})

            t0 = time.time()
            response = await state.groq_client.chat.completions.create(
                model=state.groq_model,
                messages=messages,
                temperature=0.8,
                max_tokens=300,
                tools=[NAVIGATE_TOOL],
                tool_choice="auto",
            )
            llm_ms = (time.time() - t0) * 1000

            choice = response.choices[0].message
            reply_text = choice.content or ""
            nav_destination = ""

            if choice.tool_calls:
                for tc in choice.tool_calls:
                    if tc.function.name == "navigate_to":
                        try:
                            args = json.loads(tc.function.arguments)
                            nav_destination = args.get("destination", "")
                        except json.JSONDecodeError:
                            pass
                if not reply_text:
                    loc_name = nav_destination.replace("_", " ").title() if nav_destination else "your destination"
                    reply_text = f"I'll guide you to the {loc_name}. Follow the arrow on your screen!"

            history.append({"role": "user", "content": prompt})
            hist_content = choice.content or f"[Navigation to {nav_destination}]"
            history.append({"role": "assistant", "content": hist_content})
            if len(history) > 10:
                del history[:-10]

            await websocket.send_json({"type": "text", "content": reply_text})
            if nav_destination:
                await websocket.send_json({"type": "navigation", "destination": nav_destination})

            t0 = time.time()
            spoken = clean_text(reply_text)
            voice = NPC_VOICES.get(npc, "en-US-AriaNeural")

            try:
                async for chunk in stream_tts_pcm(spoken, voice):
                    await websocket.send_json({
                        "type": "audio_chunk",
                        **chunk,
                    })
            except Exception as e:
                print(f"TTS stream error: {e}")
                traceback.print_exc()
                await websocket.send_json({"type": "error", "message": "Audio stream failed."})

            tts_ms = (time.time() - t0) * 1000
            print(f"[TIMING] STT: {stt_ms:.0f}ms | LLM: {tts_ms:.0f}ms | TTS: {tts_ms:.0f}ms")
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        print(f"Client {session_id} disconnected.")
    except Exception as e:
        print(f"WebSocket error: {e}")
        if history and history[-1].get("role") == "assistant":
            history.pop()
        if history and history[-1].get("role") == "user":
            history.pop()
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
