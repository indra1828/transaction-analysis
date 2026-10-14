from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ThreadCreate(BaseModel):
    scenario_id: str
    mode: Literal["simulation", "guided"] = "simulation"
    max_turns: int | None = Field(default=None, ge=1, le=50)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    feedback: dict[str, Any] | None = None
    created_at: datetime


class ThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    scenario_id: str
    mode: str
    status: str
    max_turns: int
    parent_thread_id: str | None
    branch_from_message_id: str | None
    created_at: datetime


class ThreadStartResponse(ThreadResponse):
    opening_message: MessageResponse



class TurnFeedback(BaseModel):
    # True when the draft is good enough to send as it is (about 85-90% there).
    acceptable: bool
    feedback: str
    ta_note: str
    suggested_response: str


class TurnRevision(BaseModel):
    content: str
    feedback: TurnFeedback


class TurnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    thread_id: str
    number: int
    status: str
    revisions: list[TurnRevision]
    accepted_message_id: str | None
