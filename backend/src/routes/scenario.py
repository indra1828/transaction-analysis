import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from db.db import Scenario
from db.session import DbSession
from llm import guardrails
from llm.scenario import draft_scenario
from models.scenario import (
    ScenarioCreate,
    ScenarioDraft,
    ScenarioDraftRequest,
    ScenarioResponse,
)
from oauth.dependencies import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


def get_accessible_scenario(db, scenario_id: str, user_id: str) -> Scenario:
    """Return a public scenario or one created by the user."""
    scenario = db.get(Scenario, scenario_id)

    if scenario is None or not (
        scenario.is_public or scenario.created_by == user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )

    return scenario


@router.get("", response_model=list[ScenarioResponse])
def list_scenarios(user: CurrentUser, db: DbSession):
    return db.scalars(
        select(Scenario).where(
            or_(
                Scenario.is_public.is_(True),
                Scenario.created_by == user.id,
            )
        )
    ).all()


@router.get("/{id}", response_model=ScenarioResponse)
def get_scenario(id: str, user: CurrentUser, db: DbSession):
    return get_accessible_scenario(db, id, user.id)


@router.post(
    "",
    response_model=ScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scenario(
    data: ScenarioCreate,
    db: DbSession,
    user: CurrentUser,
):
    scenario = Scenario(
        **data.model_dump(),
        created_by=user.id,
        is_public=False,
    )

    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    return scenario


@router.post("/draft", response_model=ScenarioDraft)
async def create_draft(data: ScenarioDraftRequest, user: CurrentUser):
    """Draft the rest of a scenario from the learner's answers.

    Nothing is saved. Review the draft, send feedback to revise it (pass the
    draft back as `current`), then save it with POST /scenarios.
    """
    texts = [data.title, data.situation, data.user_role, data.ai_role, *data.goals, data.feedback or ""]

    if any(guardrails.is_blocked(text) for text in texts):
        raise HTTPException(422, "Describe a workplace conversation to practise.")

    try:
        return await draft_scenario(data)
    except Exception as exc:
        logger.exception("Scenario drafting failed")
        raise HTTPException(
            502, "Could not generate a scenario. Please try again."
        ) from exc
