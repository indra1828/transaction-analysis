from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from models.evaluation import EvaluationReport
from models.thread import MessageResponse


class TeacherScenario(BaseModel):
    id: str
    title: str
    is_shared: bool


class ConversationSummary(BaseModel):
    id: str
    learner_email: str
    mode: Literal["simulation", "guided"]
    status: str
    created_at: datetime


class SubmissionPage(BaseModel):
    items: list[ConversationSummary]
    total: int


class ConversationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    learner_email: str
    scenario_id: str
    scenario_title: str
    mode: Literal["simulation", "guided"]
    status: str
    created_at: datetime
    messages: list[MessageResponse]
    report: EvaluationReport
