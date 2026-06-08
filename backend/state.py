from typing import Optional
from openai import AsyncOpenAI

groq_client: Optional[AsyncOpenAI] = None
groq_model: str = "llama-3.1-8b-instant"
