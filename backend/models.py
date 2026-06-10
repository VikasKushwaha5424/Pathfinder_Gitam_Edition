from pydantic import BaseModel, Field


class UserInput(BaseModel):
    text: str = Field(..., min_length=0, max_length=300)
    npc_id: str = "maya"
    world_state: dict = Field(default_factory=dict)
    location: str = ""
    session_id: str = "default_user"


class ResetInput(BaseModel):
    npc_id: str
    session_id: str = "default_user"
