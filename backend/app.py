import os, sys, asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
import state
from state import clean_old_sessions

load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")
if not API_KEY:
    raise ValueError("GROQ_API_KEY is missing from the .env file!")

CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")

state.groq_client = AsyncOpenAI(
    api_key=API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(clean_old_sessions())
    yield

app = FastAPI(lifespan=lifespan)

is_cors_wildcard = CORS_ORIGIN == "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_cors_wildcard else [CORS_ORIGIN],
    allow_credentials=not is_cors_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TokenAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ["/generate", "/transcribe"]:
            token = request.headers.get("x-api-key")
            if token != "maya_secret_token":
                return JSONResponse(status_code=403, content={"detail": "Forbidden: Invalid API Token"})
        return await call_next(request)

app.add_middleware(TokenAuthMiddleware)

from api import health, locations, transcribe, chat, session, routing, admin

app.include_router(health.router)
app.include_router(locations.router)
app.include_router(transcribe.router)
app.include_router(chat.router)
app.include_router(session.router)
app.include_router(routing.router)
app.include_router(admin.router)
