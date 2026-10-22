import logging

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from db.db import Scenario, Thread, User
from db.session import DbSession
from llm import guardrails
from llm.scenario import draft_scenario
from models.scenario import (
    ScenarioCreateRequest,
    ScenarioDraft,
    ScenarioDraftRequest,
    ScenarioResponse,
    ScenarioUpdate,
)
from oauth.dependencies import CurrentUser
from oauth.roles import can_teach
from services.threads import delete_thread_tree, is_generating

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


def is_visible(scenario: Scenario, user_id: str) -> bool:
    return scenario.is_public or scenario.is_shared or scenario.created_by == user_id


def is_creator(scenario: Scenario, user_id: str) -> bool:
    return not scenario.is_public and scenario.created_by == user_id


def can_share(user: User) -> bool:
    """Only teachers can share a scenario with every user. Students' scenarios stay private."""
    return can_teach(user.role)


def scenario_response(scenario: Scenario, user: User) -> ScenarioResponse:
    return ScenarioResponse(
        id=scenario.id,
        title=scenario.title,
        config=scenario.config,
        is_public=scenario.is_public,
        is_shared=scenario.is_shared,
        editable=is_creator(scenario, user.id),
    )


def get_accessible_scenario(db, scenario_id: str, user_id: str) -> Scenario:
    """Return a built-in scenario, a teacher's shared scenario, or one the user created."""
    scenario = db.get(Scenario, scenario_id)

    if scenario is None or not is_visible(scenario, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )

    return scenario


def get_owned_scenario(db, scenario_id: str, user_id: str) -> Scenario:
    """Return a scenario the user created. Built-in and other people's scenarios cannot be changed."""
    scenario = get_accessible_scenario(db, scenario_id, user_id)

    if scenario.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Built-in scenarios cannot be changed",
        )

    if scenario.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the teacher who created this scenario can change it",
        )

    return scenario


def ensure_unique_title(db, title: str, scenario_id: str | None = None) -> None:
    """Scenario names are unique across the platform, ignoring case."""
    statement = select(Scenario.id).where(func.lower(Scenario.title) == title.lower())

    if scenario_id is not None:
        statement = statement.where(Scenario.id != scenario_id)

    if db.scalar(statement) is not None:
        raise HTTPException(409, "A scenario with this name already exists. Choose another name.")


def _strings(values):
    """Every piece of text in a value: a string, or the strings in a list."""
    for value in values:
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            yield from value


@router.get("", response_model=list[ScenarioResponse])
def list_scenarios(
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    scenarios = db.scalars(
        select(Scenario)
        .where(
            or_(
                Scenario.is_public.is_(True),
                Scenario.is_shared.is_(True),
                Scenario.created_by == user.id,
            )
        )
        .order_by(Scenario.title, Scenario.id)
        .limit(limit)
        .offset(offset)
    ).all()

    return [scenario_response(scenario, user) for scenario in scenarios]


@router.get("/{id}", response_model=ScenarioResponse)
def get_scenario(id: str, user: CurrentUser, db: DbSession):
    return scenario_response(get_accessible_scenario(db, id, user.id), user)


@router.post(
    "",
    response_model=ScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scenario(
    data: ScenarioCreateRequest,
    db: DbSession,
    user: CurrentUser,
):
    """Create a scenario. Teachers choose whether it is shared with every user; students' scenarios are private."""
    ensure_unique_title(db, data.title)
    scenario = Scenario(
        title=data.title,
        config=data.config,
        created_by=user.id,
        is_public=False,
        is_shared=data.is_shared if can_share(user) else False,
    )

    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    return scenario_response(scenario, user)


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
    if data.is_shared and not can_share(user):
        raise HTTPException(403, "Students can only keep their scenarios private")

    scenario = get_owned_scenario(db, id, user.id)
    changes = data.config.model_dump(exclude_none=True) if data.config else {}
    texts = [data.title or "", *_strings(changes.values())]

    if any(guardrails.is_blocked(text) for text in texts):
        raise HTTPException(422, "Describe a workplace conversation to practise.")

    if data.title is not None:
        ensure_unique_title(db, data.title, scenario.id)
        scenario.title = data.title

    if data.is_shared is not None:
        scenario.is_shared = data.is_shared

    if changes:
        # A new dict, so SQLAlchemy sees the JSON change.
        scenario.config = {**scenario.config, **changes}

    db.commit()
    db.refresh(scenario)

    return scenario_response(scenario, user)


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
    """Draft the rest of a scenario from the teacher's answers.

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
