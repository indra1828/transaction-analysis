import logging
from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.sse import EventSourceResponse, ServerSentEvent
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from db.db import Message, Thread, Turn
from db.session import DbSession, SessionLocal
from llm.evaluator import review_turn
from models.thread import MessageCreate, TurnResponse
from oauth.dependencies import CurrentUser
from services.threads import (
    GuidedThread,
    delete_message,
    get_messages,
    get_thread,
    reply_events,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads/{id}/turns", tags=["Guided turns"])


def get_turn(db, thread_id: str, turn_id: str) -> Turn:
    turn = db.get(Turn, turn_id)

    if turn is None or turn.thread_id != thread_id:
        raise HTTPException(404, "Turn not found")

    return turn


def get_open_turn(turn_id: str, thread: GuidedThread, db: DbSession) -> Turn:
    turn = get_turn(db, thread.id, turn_id)

    if turn.status != "draft":
        raise HTTPException(409, "This turn has already been accepted")

    return turn


OpenTurn = Annotated[Turn, Depends(get_open_turn)]


async def review(thread: Thread, db, content: str) -> dict:
    try:
        feedback = await review_turn(
            thread.scenario_snapshot, get_messages(db, thread.id), content
        )
    except Exception as exc:
        logger.exception("Turn review failed for thread %s", thread.id)
        raise HTTPException(
            502, "Could not generate feedback. Please try again."
        ) from exc

    return {"content": content, "feedback": feedback.model_dump()}


@router.get("", response_model=list[TurnResponse])
def list_turns(id: str, user: CurrentUser, db: DbSession):
    get_thread(db, id, user.id)

    return db.scalars(
        select(Turn).where(Turn.thread_id == id).order_by(Turn.number)
    ).all()


@router.post(
    "", response_model=TurnResponse, status_code=status.HTTP_201_CREATED
)
async def create_turn(
    data: MessageCreate, thread: GuidedThread, db: DbSession
):
    """Submit a draft reply and get coaching before it is sent."""
    turns = db.scalars(select(Turn).where(Turn.thread_id == thread.id)).all()

    if any(t.status == "draft" for t in turns):
        raise HTTPException(409, "Revise or accept your current turn first")

    revision = await review(thread, db, data.content)
    turn = Turn(
        thread_id=thread.id,
        number=len(turns) + 1,
        revisions=[revision],
    )
    db.add(turn)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            409, "Revise or accept your current turn first"
        ) from exc

    db.refresh(turn)
    return turn


@router.post("/{turn_id}/revise", response_model=TurnResponse)
async def revise_turn(
    data: MessageCreate,
    turn: OpenTurn,
    thread: GuidedThread,
    db: DbSession,
):
    """Try a new wording for the same turn; earlier attempts are kept."""
    revision = await review(thread, db, data.content)

    # A new list, so SQLAlchemy sees the JSON change.
    turn.revisions = [*turn.revisions, revision]
    db.commit()
    db.refresh(turn)

    return turn


@router.post("/{turn_id}/use-suggestion", response_model=TurnResponse)
def use_suggestion(turn: OpenTurn, db: DbSession):
    """Make the coach's suggested wording the draft. The coach does not review it again."""
    latest = turn.revisions[-1]["feedback"]
    suggested = latest["suggested_response"].strip()

    if not suggested:
        raise HTTPException(409, "There is no suggested wording to use")

    # The suggestion is the final wording, so it is recorded as acceptable.
    revision = {
        "content": suggested,
        "feedback": {
            "acceptable": True,
            "feedback": "You used the coach's wording. Send it when you are ready.",
            "ta_note": latest["ta_note"],
            "suggested_response": suggested,
        },
    }

    # A new list, so SQLAlchemy sees the JSON change.
    turn.revisions = [*turn.revisions, revision]
    db.commit()
    db.refresh(turn)

    return turn


@router.post("/{turn_id}/accept", response_class=EventSourceResponse)
async def accept_turn(
    turn: OpenTurn, thread: GuidedThread
) -> AsyncIterable[ServerSentEvent]:
    """Send the latest wording; the AI replies only after this."""
    thread_id, turn_id = thread.id, turn.id

    def accept() -> str:
        with SessionLocal() as db:
            # Only the first of several parallel accepts wins.
            claimed = db.execute(
                update(Turn)
                .where(Turn.id == turn_id, Turn.status == "draft")
                .values(status="accepted")
            )

            if claimed.rowcount != 1:
                db.rollback()
                raise RuntimeError("Turn already accepted")

            final = db.get(Turn, turn_id).revisions[-1]
            message = Message(
                thread_id=thread_id,
                role="user",
                content=final["content"],
                feedback=final["feedback"],
            )
            db.add(message)
            db.flush()
            db.get(Turn, turn_id).accepted_message_id = message.id
            db.commit()

            return message.id

    def undo(message_id: str) -> None:
        delete_message(message_id)

        with SessionLocal() as db:
            db.execute(
                update(Turn)
                .where(Turn.id == turn_id)
                .values(status="draft", accepted_message_id=None)
            )
            db.commit()

    async for event in reply_events(thread_id, accept, undo):
        yield event
