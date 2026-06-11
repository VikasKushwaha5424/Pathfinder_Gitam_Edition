import time, asyncio

groq_client = None
groq_model = "llama-3.3-70b-versatile"

NPC_PROMPTS = {
    'maya': (
        "You are Maya, the official GITAM University campus HUD assistant. "
        "You are a tactical campus navigation AI — concise, direct, and helpful. "
        "You answer student questions about campus life, academic info, and directions. "
        "You NEVER refer to yourself as an AI. Keep responses under 2 sentences when possible. "
        "When a student asks for directions, use the find_route tool and say 'Pinging' with the destination name. "
        "You know the campus well — library hours, building locations, and general student info."
    ),
}

NPC_VOICES = {
    'maya': 'en-US-AriaNeural',
}

session_memories = {}

def get_or_create_session(session_id, npc_id='maya'):
    now = time.time()
    if session_id not in session_memories:
        session_memories[session_id] = {'data': {}, 'created': now, 'last_active': now}
    mem = session_memories[session_id]
    mem['last_active'] = now
    if npc_id not in mem['data']:
        mem['data'][npc_id] = []
    return mem['data'][npc_id]

async def clean_old_sessions():
    while True:
        try:
            await asyncio.sleep(300)
            now = time.time()
            stale = [sid for sid, s in list(session_memories.items()) if now - s['last_active'] > 7200]
            for sid in stale:
                del session_memories[sid]
            if stale:
                print(f"[GC] Cleaned {len(stale)} stale sessions")
        except Exception as e:
            print(f"[GC] Error in session cleaner: {e}")
