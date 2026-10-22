from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, Field, StringConstraints


def _clean_title(value: str) -> str:
    cleaned = " ".join(value.split())

    if not cleaned:
        raise ValueError("Give the scenario a name.")

    return cleaned


# Names are trimmed and single-spaced, so "  Salary  talk " and "Salary talk" are the same name.
ScenarioTitle = Annotated[str, StringConstraints(max_length=180), AfterValidator(_clean_title)]


class ScenarioCreate(BaseModel):
    title: ScenarioTitle
    config: dict[str, Any]


class ScenarioResponse(ScenarioCreate):
    id: str
    is_public: bool
    is_shared: bool
    # True only for the user who created it and may change it.
    editable: bool


class ScenarioConfig(BaseModel):
    """Shape of a scenario config. Also the LLM's structured output."""

    persona: str
    user_role: str
    context: str
    objectives: list[str]
    stopping_conditions: list[str]


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


class ScenarioCreateRequest(ScenarioCreate):
    # Teachers choose: True shares the scenario with every user, False keeps it to themselves.
    is_shared: bool = True


class ScenarioUpdate(BaseModel):
    title: ScenarioTitle | None = None
    config: ScenarioConfigUpdate | None = None
    is_shared: bool | None = None


class ScenarioDraftRequest(BaseModel):
    """The learner's answers. The model fills in the rest of the scenario."""

    title: ScenarioTitle
    situation: str = Field(min_length=10, max_length=1000)  # what happened
    user_role: str = Field(min_length=1, max_length=120)  # you are
    ai_role: str = Field(min_length=1, max_length=120)  # the character
    goals: list[GoalPoint] = Field(min_length=1, max_length=8)
    # Optional: revise an existing draft with the learner's feedback.
    current: ScenarioDraft | None = None
    feedback: str | None = Field(default=None, max_length=1000)
