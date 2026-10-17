from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class ScenarioCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    config: dict[str, Any]


class ScenarioResponse(ScenarioCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_public: bool


class ScenarioConfig(BaseModel):
    """Shape of a scenario config. Also the LLM's structured output."""

    persona: str
    user_role: str
    context: str
    objectives: list[str]
    stopping_conditions: list[str]
    opening_line: str


class ScenarioDraft(BaseModel):
    title: str
    config: ScenarioConfig


GoalPoint = Annotated[str, StringConstraints(min_length=1, max_length=200)]


class ScenarioConfigUpdate(BaseModel):
    """Fields to change in a scenario. Fields left out keep their current value."""

    persona: str | None = Field(default=None, min_length=1, max_length=2000)
    user_role: str | None = Field(default=None, min_length=1, max_length=120)
    context: str | None = Field(default=None, min_length=1, max_length=2000)
    objectives: list[GoalPoint] | None = Field(default=None, min_length=1, max_length=8)
    stopping_conditions: list[GoalPoint] | None = Field(default=None, min_length=1, max_length=8)
    opening_line: str | None = Field(default=None, min_length=1, max_length=1000)


class ScenarioUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    config: ScenarioConfigUpdate | None = None


class ScenarioDraftRequest(BaseModel):
    """The learner's answers. The model fills in the rest of the scenario."""

    title: str = Field(min_length=1, max_length=180)
    situation: str = Field(min_length=10, max_length=1000)  # what happened
    user_role: str = Field(min_length=1, max_length=120)  # you are
    ai_role: str = Field(min_length=1, max_length=120)  # the character
    goals: list[GoalPoint] = Field(min_length=1, max_length=8)
    # Optional: revise an existing draft with the learner's feedback.
    current: ScenarioDraft | None = None
    feedback: str | None = Field(default=None, max_length=1000)
