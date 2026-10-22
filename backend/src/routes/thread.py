import logging
from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.sse import EventSourceResponse, ServerSentEvent
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from db.db import Evaluation, Message, Thread
from db.session import DbSession
from llm.evaluator import evaluate_thread
from models.evaluation import EvaluationResponse
from models.thread import (
    MessageCreate,
    MessageResponse,
    ThreadCreate,
    ThreadResponse,
)
from oauth.dependencies import CurrentUser
from routes.scenario import get_accessible_scenario
from services.threads import (
    SimulationThread,
    default_max_turns,
    delete_message,
    delete_thread_tree,
    edit_user_message,
    get_messages,
    get_thread,
    is_generating,
    reply_events,
    save_user_message,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads", tags=["Threads"])


def get_evaluation(db, thread_id: str) -> Evaluation | None:
    return db.scalar(
        select(Evaluation).where(Evaluation.thread_id == thread_id)
    )


@router.post(
    "",
    response_model=ThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_thread(
    data: ThreadCreate,
    user: CurrentUser,
    db: DbSession,
):
    """Start a conversation. The learner speaks first."""
    scenario = get_accessible_scenario(db, data.scenario_id, user.id)
    thread = Thread(
        user_id=user.id,
        scenario_id=scenario.id,
        scenario_snapshot={"title": scenario.title, "config": scenario.config},
        mode=data.mode,
        max_turns=data.max_turns or default_max_turns(),
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)

    return thread


@router.get("", response_model=list[ThreadResponse])
def list_threads(
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return db.scalars(
        select(Thread)
        .where(Thread.user_id == user.id)
        .order_by(Thread.created_at.desc(), Thread.id)
        .limit(limit)
        .offset(offset)
    ).all()


@router.get("/{id}", response_model=ThreadResponse)
def get_thread_details(id: str, user: CurrentUser, db: DbSession):
    return get_thread(db, id, user.id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(id: str, user: CurrentUser, db: DbSession):
    """Delete a conversation with its messages, edit history, turns and report.

    Permanent. Scenarios are kept, since they are practice templates.
    """
    delete_thread_tree(db, get_thread(db, id, user.id))


@router.get("/{id}/messages", response_model=list[MessageResponse])
def list_messages(id: str, user: CurrentUser, db: DbSession):
    get_thread(db, id, user.id)
    return get_messages(db, id)


@router.post("/{id}/messages", response_class=EventSourceResponse)
async def send_message(
    data: MessageCreate,
    thread: SimulationThread,
) -> AsyncIterable[ServerSentEvent]:
    thread_id = thread.id

    async for event in reply_events(
        thread_id,
        prepare=lambda: save_user_message(thread_id, data.content),
        rollback=delete_message,
    ):
        yield event


def get_editable_message(
    message_id: str, thread: SimulationThread, db: DbSession
) -> Message:
    """The message to edit. Checked before streaming starts, so errors are plain HTTP errors."""
    message = next(
        (m for m in get_messages(db, thread.id) if m.id == message_id),
        None,
    )

    if message is None:
        raise HTTPException(404, "Message not found")

    if message.role != "user":
        raise HTTPException(409, "Only your own messages can be edited")

    return message


@router.patch("/{id}/messages/{message_id}", response_class=EventSourceResponse)
async def edit_message(
    data: MessageCreate,
    message: Annotated[Message, Depends(get_editable_message)],
    thread: SimulationThread,
) -> AsyncIterable[ServerSentEvent]:
    """Edit one of your messages in place and get a new reply.

    The conversation keeps its id. The replies after the edited message are
    archived (kept for audit, no longer shown), and the character answers the
    new text.
    """
    thread_id = thread.id

    async for event in reply_events(
        thread_id,
        prepare=lambda: edit_user_message(thread_id, message.id, data.content),
    ):
        yield event


@router.post("/{id}/complete", response_model=EvaluationResponse)
async def complete_thread(id: str, user: CurrentUser, db: DbSession):
    """End the thread and create (or return) its TA evaluation."""
    thread = get_thread(db, id, user.id)
    existing = get_evaluation(db, id)

    if existing is not None:
        return existing

    if is_generating(thread):
        raise HTTPException(
            409, "A reply is still being generated for this thread"
        )

    messages = get_messages(db, id)

    if not any(m.role == "user" for m in messages):
        raise HTTPException(
            409, "Send at least one message before completing the thread"
        )

    try:
        report = await evaluate_thread(thread.scenario_snapshot, messages)
    except Exception as exc:
        logger.exception("Evaluation failed for thread %s", id)
        raise HTTPException(
            502, "Evaluation failed. Please try again."
        ) from exc

    thread.status = "completed"
    db.add(Evaluation(thread_id=id, report=report.model_dump()))

    try:
        db.commit()
    except IntegrityError:
        # A parallel request stored the evaluation first.
        db.rollback()

    return get_evaluation(db, id)


@router.get("/{id}/evaluation", response_model=EvaluationResponse)
def read_evaluation(id: str, user: CurrentUser, db: DbSession):
    get_thread(db, id, user.id)
    evaluation = get_evaluation(db, id)

    if evaluation is None:
        raise HTTPException(
            404, "No evaluation yet. Complete the thread first."
        )

    return evaluation
