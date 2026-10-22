from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from db.db import Evaluation, Scenario, Thread, User
from db.session import DbSession
from models.evaluation import EvaluationReport
from models.teacher import ConversationDetail, ConversationSummary, SubmissionPage, TeacherScenario
from models.thread import MessageResponse
from oauth.dependencies import CurrentTeacher
from services.threads import get_messages

router = APIRouter(prefix="/teacher", tags=["Teacher"])


def owned_scenario(db, scenario_id: str, teacher: User) -> Scenario:
    """Only the teacher who created a scenario sees its learners. Others get 404."""
    scenario = db.get(Scenario, scenario_id)

    if scenario is None or scenario.is_public or scenario.created_by != teacher.id:
        raise HTTPException(404, "Scenario not found")

    return scenario


def submitted_conversation(db, thread_id: str, teacher: User) -> tuple[Thread, Evaluation]:
    """A conversation the learner submitted (has a report) in a scenario this teacher created."""
    thread = db.get(Thread, thread_id)

    if thread is None:
        raise HTTPException(404, "Conversation not found")

    owned_scenario(db, thread.scenario_id, teacher)
    evaluation = db.scalar(select(Evaluation).where(Evaluation.thread_id == thread.id))

    if evaluation is None:
        raise HTTPException(404, "This conversation has not been submitted for a report")

    return thread, evaluation


@router.get("/scenarios", response_model=list[TeacherScenario])
def list_my_scenarios(
    teacher: CurrentTeacher,
    db: DbSession,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    scenarios = db.scalars(
        select(Scenario)
        .where(Scenario.created_by == teacher.id, Scenario.is_public.is_(False))
        .order_by(Scenario.title, Scenario.id)
        .limit(limit)
        .offset(offset)
    ).all()

    return [
        TeacherScenario(id=scenario.id, title=scenario.title, is_shared=scenario.is_shared)
        for scenario in scenarios
    ]


@router.get("/scenarios/{id}/conversations", response_model=SubmissionPage)
def list_submissions(
    id: str,
    teacher: CurrentTeacher,
    db: DbSession,
    q: str | None = Query(None, max_length=200),
    sort: Literal["newest", "oldest"] = "newest",
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """Submitted conversations (with a report) for one of the teacher's scenarios, one page at a time."""
    scenario = owned_scenario(db, id, teacher)

    statement = (
        select(Thread, User.email)
        .join(User, User.id == Thread.user_id)
        .join(Evaluation, Evaluation.thread_id == Thread.id)
        .where(Thread.scenario_id == scenario.id)
    )

    if q and q.strip():
        statement = statement.where(User.email.icontains(q.strip(), autoescape=True))

    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    order = Thread.created_at.asc() if sort == "oldest" else Thread.created_at.desc()
    rows = db.execute(statement.order_by(order, Thread.id).limit(limit).offset(offset)).all()

    return SubmissionPage(
        items=[
            ConversationSummary(
                id=thread.id,
                learner_email=email,
                mode=thread.mode,
                status=thread.status,
                created_at=thread.created_at,
            )
            for thread, email in rows
        ],
        total=total,
    )


@router.get("/conversations/{id}", response_model=ConversationDetail)
def read_conversation(id: str, teacher: CurrentTeacher, db: DbSession):
    """A submitted learner conversation and its report, read-only, for assessment."""
    thread, evaluation = submitted_conversation(db, id, teacher)
    learner = db.get(User, thread.user_id)

    return ConversationDetail(
        id=thread.id,
        learner_email=learner.email,
        scenario_id=thread.scenario_id,
        scenario_title=thread.scenario_snapshot.get("title", ""),
        mode=thread.mode,
        status=thread.status,
        created_at=thread.created_at,
        messages=[MessageResponse.model_validate(m) for m in get_messages(db, thread.id)],
        report=EvaluationReport.model_validate(evaluation.report),
    )
