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

    nav_destination = ""

    try:
        world_state = dict(user_input.world_state)
        if user_input.location:
            world_state["location"] = user_input.location
            loc_data = CAMPUS_LOCATIONS.get(user_input.location)
            world_state["location_description"] = (
                loc_data["description"] if loc_data
                else f"the {user_input.location.replace('_', ' ').title()} area"
            )

        route_data = world_state.pop("route", {})
        if route_data and isinstance(route_data, dict):
            next_step = route_data.get("next_step", "")
            turn = route_data.get("turn", "")
            dest_status = route_data.get("destination_status", "en_route")
            parts = []
            if next_step:
                parts.append(f"Next: {next_step}")
            if turn:
                parts.append(f"Turn: {turn}")
            if dest_status == "arrived":
                parts.append("The user has arrived at their destination.")
            elif dest_status == "off_route":
                parts.append("The user may be off-route. Encourage them to scan the nearest poster.")
            else:
                parts.append("The user is en route.")
            world_state["route_info"] = "; ".join(parts)

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
            tools=[NAVIGATE_TOOL],
            tool_choice="auto",
        )

        choice = response.choices[0].message
        reply_text = choice.content or ""

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

        history.append({"role": "user", "content": user_input.text})
        assistant_msg = choice.model_dump(exclude_none=True)
        history.append(assistant_msg)
        if len(history) > 10:
            del history[:-10]

        header = reply_text[:300] + "..." if len(reply_text) > 300 else reply_text
        encoded = urllib.parse.quote(header)

    except Exception as e:
        err = str(e).lower()
        if "429" in err or "quota" in err or "exhausted" in err:
            raise HTTPException(status_code=429, detail="[ERROR_QUOTA_EXHAUSTED]")
        raise HTTPException(status_code=500, detail=str(e))

    spoken = clean_text(reply_text)
    voice = NPC_VOICES.get(npc, "en-US-AriaNeural")

    async def _stream():
        try:
            async for chunk in stream_tts(spoken, voice):
                yield chunk
        except Exception as tts_e:
            print(f"TTS stream error: {tts_e}")

    response_headers = {"X-NPC-Response": encoded}
    if nav_destination:
        response_headers["X-Navigation-Destination"] = nav_destination

    return StreamingResponse(
        _stream(),
        media_type="audio/mpeg",
        headers=response_headers,
    )


@router.post("/reset")
async def reset_memory(reset: ResetInput):
    npc = reset.npc_id.lower()
    sid = reset.session_id
    if sid in session_memories and npc in session_memories[sid]["data"]:
        session_memories[sid]["data"][npc] = []
        return {"message": f"[{npc.upper()}] Memory wiped for session {sid}."}
    return {"message": "No memory found to wipe."}
