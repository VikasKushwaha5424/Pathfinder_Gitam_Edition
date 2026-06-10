import json
import time
import asyncio

NPC_PROMPTS = {}
NPC_VOICES = {}


def load_npcs(path: str = "npcs.json"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for npc_id, info in data.items():
                NPC_PROMPTS[npc_id] = info.get("prompt", "")
                NPC_VOICES[npc_id] = info.get("voice", "en-US-AriaNeural")
        print(f"Loaded {len(data)} NPCs from {path}")
    except FileNotFoundError:
        print(f"ERROR: {path} not found!")
    except json.JSONDecodeError:
        print(f"ERROR: {path} is invalid JSON!")


session_memories = {}
SESSION_TTL = 7200


def get_or_create_session(session_id: str, npc: str):
    now = time.time()
    if session_id in session_memories:
        if now - session_memories[session_id]["last_active"] > SESSION_TTL:
            del session_memories[session_id]
        else:
            session_memories[session_id]["last_active"] = now
            if npc not in session_memories[session_id]["data"]:
                session_memories[session_id]["data"][npc] = []
            return session_memories[session_id]["data"][npc]
    session_memories[session_id] = {
        "last_active": now,
        "data": {k: [] for k in NPC_PROMPTS.keys()},
    }
    if npc not in session_memories[session_id]["data"]:
        session_memories[session_id]["data"][npc] = []
    return session_memories[session_id]["data"][npc]


async def clean_old_sessions(ttl: int = 300):
    while True:
        await asyncio.sleep(ttl)
        now = time.time()
        expired = [
            sid for sid, data in session_memories.items()
            if now - data["last_active"] > ttl
        ]
        for sid in expired:
            del session_memories[sid]
            print(f"GC: removed session {sid}")
