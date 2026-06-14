import time, asyncio, os
from tinydb import TinyDB, Query

groq_client = None
groq_model = "llama-3.3-70b-versatile"

# TinyDB is not thread-safe for asyncio, so we serialize access
db_lock = asyncio.Lock()

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

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'sessions.json')
db = TinyDB(DB_PATH)

async def get_or_create_session(session_id, npc_id='maya'):
    now = time.time()
    Session = Query()
    async with db_lock:
        record = db.search(Session.session_id == session_id)
        if not record:
            new_record = {'session_id': session_id, 'data': {npc_id: []}, 'created': now, 'last_active': now}
            db.insert(new_record)
            return []
        
        mem = record[0]
        db.update({'last_active': now}, Session.session_id == session_id)
        return mem['data'].get(npc_id, [])

async def save_session(session_id, npc_id, history):
    now = time.time()
    Session = Query()
    async with db_lock:
        record = db.search(Session.session_id == session_id)
        if record:
            mem = record[0]
            mem['data'][npc_id] = history
            db.update({'data': mem['data'], 'last_active': now}, Session.session_id == session_id)

async def clean_old_sessions():
    while True:
        try:
            await asyncio.sleep(300)
            now = time.time()
            Session = Query()
            async with db_lock:
                stale = db.search(Session.last_active < now - 7200)
                if stale:
                    stale_ids = [s['session_id'] for s in stale]
                    db.remove(Session.session_id.one_of(stale_ids))
                    print(f"[GC] Cleaned {len(stale)} stale sessions from TinyDB")
        except Exception as e:
            print(f"[GC] Error in session cleaner: {e}")
