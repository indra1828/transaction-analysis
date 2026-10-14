from typing import Literal

from pydantic import BaseModel, ConfigDict

# These models are also the structured-output schema for the LLM, so they
# avoid defaults and validation constraints (not supported in strict mode).


class EgoStateCue(BaseModel):
    message_id: str
    ego_state: Literal["parent", "adult", "child"]
    evidence: str
    note: str


class Transaction(BaseModel):
    message_ids: list[str]
    kind: Literal["complementary", "crossed", "possible_ulterior"]
    explanation: str


class ObjectiveResult(BaseModel):
    objective: str
    status: Literal["achieved", "partly_achieved", "missed"]
    evidence: str


class TurningPoint(BaseModel):
    message_id: str
    explanation: str


class Alternative(BaseModel):
    message_id: str
    suggested_response: str
    why: str


class EvaluationReport(BaseModel):
    summary: str
    ego_state_cues: list[EgoStateCue]
    transactions: list[Transaction]
    assertiveness: str
    active_listening: str
    conflict_management: str
    problem_solving: str
    objectives: list[ObjectiveResult]
    turning_point: TurningPoint | None
    strengths: list[str]
    improvements: list[str]
    alternatives: list[Alternative]
    caveat: str


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    thread_id: str
    report: EvaluationReport
