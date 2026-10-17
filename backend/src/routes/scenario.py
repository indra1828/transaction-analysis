import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from db.db import Scenario, Thread
from db.session import DbSession
from llm import guardrails
from llm.scenario import draft_scenario
from models.scenario import (
    ScenarioCreate,
    ScenarioDraft,
    ScenarioDraftRequest,
    ScenarioResponse,
    ScenarioUpdate,
)
from oauth.dependencies import CurrentUser
from services.threads import delete_thread_tree, is_generating

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


def get_owned_scenario(db, scenario_id: str, user_id: str) -> Scenario:
    """Return a scenario the user created. Built-in scenarios cannot be changed."""
    scenario = get_accessible_scenario(db, scenario_id, user_id)

    if scenario.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Built-in scenarios cannot be changed",
        )

    return scenario


def _strings(values):
    """Every piece of text in a value: a string, or the strings in a list."""
    for value in values:
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            yield from value


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


@router.patch("/{id}", response_model=ScenarioResponse)
def update_scenario(
    id: str,
    data: ScenarioUpdate,
    user: CurrentUser,
    db: DbSession,
):
    """Change a scenario the user created. Fields left out keep their value.

    A conversation that has already started keeps the scenario it began with.
    """
    scenario = get_owned_scenario(db, id, user.id)
    changes = data.config.model_dump(exclude_none=True) if data.config else {}
    texts = [data.title or "", *_strings(changes.values())]

    if any(guardrails.is_blocked(text) for text in texts):
        raise HTTPException(422, "Describe a workplace conversation to practise.")

    if data.title is not None:
        scenario.title = data.title

    if changes:
        # A new dict, so SQLAlchemy sees the JSON change.
        scenario.config = {**scenario.config, **changes}

    db.commit()
    db.refresh(scenario)

    return scenario


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(id: str, user: CurrentUser, db: DbSession):
    """Delete a scenario the user created, with its conversations and reports.

    Permanent. Built-in scenarios cannot be deleted.
    """
    scenario = get_owned_scenario(db, id, user.id)
    threads = db.scalars(select(Thread).where(Thread.scenario_id == scenario.id)).all()

    if any(is_generating(thread) for thread in threads):
        raise HTTPException(409, "A reply is still being generated. Try again in a moment.")

    for thread in threads:
        # A branch of one conversation is removed with it, so skip the ones already gone.
        if db.get(Thread, thread.id) is not None:
            delete_thread_tree(db, thread)

    db.delete(scenario)
    db.commit()


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
