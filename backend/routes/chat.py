import urllib.parse
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

import state
from models import UserInput, ResetInput
from npcs import NPC_PROMPTS, NPC_VOICES, session_memories, get_or_create_session
from services.tts import clean_text, stream_tts
from routes.locations import CAMPUS_LOCATIONS

router = APIRouter()


@router.post("/generate")
async def generate_response(user_input: UserInput):
    if user_input.text == "[WARMUP_PING]":
        async def _empty():
            yield b""
        return StreamingResponse(
            _empty(),
            media_type="audio/mpeg",
            headers={"X-NPC-Response": "System Warmed Up"},
        )

    npc = user_input.npc_id.lower()
    session = user_input.session_id

    if npc not in NPC_PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid NPC ID.")

    history = get_or_create_session(session, npc)
    system_prompt = NPC_PROMPTS[npc]

    try:
        world_state = dict(user_input.world_state)
        if user_input.location:
            world_state["location"] = user_input.location
            world_state["location_description"] = CAMPUS_LOCATIONS.get(
                user_input.location,
                f"the {user_input.location.replace('_', ' ').title()} area",
            )

        injected = f"[System World State: {json.dumps(world_state)}] User says: {user_input.text}"

        messages = [{"role": "system", "content": system_prompt}]
        for msg in history[-10:]:
            messages.append(msg)
        messages.append({"role": "user", "content": injected})

        response = await state.groq_client.chat.completions.create(
            model=state.groq_model,
            messages=messages,
            temperature=0.8,
            max_tokens=300,
        )

        reply_text = response.choices[0].message.content

        history.append({"role": "user", "content": injected})
        history.append({"role": "assistant", "content": reply_text})
        if len(history) > 10:
            del history[:-10]

        header = reply_text[:1000] + "..." if len(reply_text) > 1000 else reply_text
        encoded = urllib.parse.quote(header)

    except Exception as e:
        if history and history[-1].get("role") == "assistant":
            history.pop()
        if history and history[-1].get("role") == "user":
            history.pop()
        err = str(e).lower()
        if "429" in err or "quota" in err or "exhausted" in err:
            raise HTTPException(status_code=429, detail="[ERROR_QUOTA_EXHAUSTED]")
        raise HTTPException(status_code=500, detail=str(e))

    spoken = clean_text(reply_text)
    voice = NPC_VOICES.get(npc, "en-US-AriaNeural")

    audio_bytes = bytearray()
    try:
        async for chunk in stream_tts(spoken, voice):
            audio_bytes.extend(chunk)
    except Exception as tts_e:
        print(f"TTS stream error: {tts_e}")

    async def _stream():
        yield bytes(audio_bytes)

    return StreamingResponse(
        _stream(),
        media_type="audio/mpeg",
        headers={"X-NPC-Response": encoded},
    )


@router.post("/reset")
async def reset_memory(reset: ResetInput):
    npc = reset.npc_id.lower()
    sid = reset.session_id
    if sid in session_memories and npc in session_memories[sid]["data"]:
        session_memories[sid]["data"][npc] = []
        return {"message": f"[{npc.upper()}] Memory wiped for session {sid}."}
    return {"message": "No memory found to wipe."}
