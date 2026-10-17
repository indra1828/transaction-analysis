"""Thread logic shared by the thread and turn routes."""

import logging
import os
from collections.abc import AsyncIterator, Callable
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.sse import ServerSentEvent
from sqlalchemy import delete, func, or_, select, update

from db.db import Evaluation, Message, MessageEdit, Thread, Turn, utc_now
from db.session import DbSession, SessionLocal
from llm.roleplay import END, stream_reply
from oauth.dependencies import CurrentUser

logger = logging.getLogger(__name__)

# A crashed request must not block a thread forever.
LOCK_TIMEOUT = timedelta(seconds=120)


def default_max_turns() -> int:
    return int(os.getenv("MAX_TURNS", "20"))


def get_thread(db, thread_id: str, user_id: str) -> Thread:
    thread = db.get(Thread, thread_id)

    if thread is None or thread.user_id != user_id:
        raise HTTPException(404, "Thread not found")

    return thread


def get_messages(db, thread_id: str) -> list[Message]:
    return list(
        db.scalars(
            select(Message)
            .where(Message.thread_id == thread_id, Message.archived_at.is_(None))
            .order_by(Message.created_at, Message.id)
        ).all()
    )


def count_user_messages(db, thread_id: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.thread_id == thread_id,
            Message.role == "user",
            Message.archived_at.is_(None),
        )
    )


def is_generating(thread: Thread) -> bool:
    since = thread.generating_since

    if since is None:
        return False

    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    return datetime.now(timezone.utc) - since < LOCK_TIMEOUT


def thread_tree_ids(db, thread_id: str) -> list[str]:
    """The thread and every branch made from it, directly or through other branches."""
    ids = [thread_id]
    frontier = [thread_id]

    while frontier:
        children = db.scalars(select(Thread.id).where(Thread.parent_thread_id.in_(frontier))).all()
        frontier = [child for child in children if child not in ids]
        ids.extend(frontier)

    return ids


def delete_thread_tree(db, thread: Thread) -> None:
    """Delete a conversation with everything stored for it.

    That is its messages, guided turns and report, plus every branch made
    from it. A branch copies the history before its edit point, so keeping it
    would leave the deleted conversation's text behind.
    """
    ids = thread_tree_ids(db, thread.id)
    threads = db.scalars(select(Thread).where(Thread.id.in_(ids))).all()

    if any(is_generating(item) for item in threads):
        raise HTTPException(409, "A reply is still being generated. Try again in a moment.")

    db.execute(delete(Evaluation).where(Evaluation.thread_id.in_(ids)))
    db.execute(delete(MessageEdit).where(MessageEdit.thread_id.in_(ids)))
    db.execute(delete(Turn).where(Turn.thread_id.in_(ids)))
    db.execute(delete(Message).where(Message.thread_id.in_(ids)))
    # Clear the self-reference first, so the threads can be removed in one statement.
    db.execute(update(Thread).where(Thread.id.in_(ids)).values(parent_thread_id=None))
    db.execute(delete(Thread).where(Thread.id.in_(ids)))
    db.commit()


def acquire_lock(thread_id: str) -> bool:
    """Atomically mark the thread as generating; False if it already is."""
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        result = db.execute(
            update(Thread)
            .where(
                Thread.id == thread_id,
                or_(
                    Thread.generating_since.is_(None),
                    Thread.generating_since < now - LOCK_TIMEOUT,
                ),
            )
            .values(generating_since=now)
        )
        db.commit()

        return result.rowcount == 1


def release_lock(thread_id: str) -> None:
    with SessionLocal() as db:
        db.execute(
            update(Thread)
            .where(Thread.id == thread_id)
            .values(generating_since=None)
        )
        db.commit()


def save_user_message(thread_id: str, content: str) -> str:
    with SessionLocal() as db:
        message = Message(thread_id=thread_id, role="user", content=content)
        db.add(message)
        db.commit()

        return message.id


def edit_user_message(thread_id: str, message_id: str, content: str) -> str:
    """Replace the text of one learner message, in place.

    The previous text is logged for audit. Every message after it is archived:
    it stays in the database but is no longer part of the conversation, so the
    character replies to the new text as if the old continuation never happened.
    """
    with SessionLocal() as db:
        message = db.get(Message, message_id)
        now = utc_now()

        db.add(
            MessageEdit(
                thread_id=thread_id,
                message_id=message_id,
                previous_content=message.content,
                edited_at=now,
            )
        )

        later = db.scalars(
            select(Message).where(
                Message.thread_id == thread_id,
                Message.archived_at.is_(None),
                Message.created_at > message.created_at,
            )
        ).all()

        for item in later:
            item.archived_at = now

        message.content = content
        db.commit()

        return message.id


def delete_message(message_id: str) -> None:
    with SessionLocal() as db:
        message = db.get(Message, message_id)

        if message is not None:
            db.delete(message)
            db.commit()


def _event(name: str, **data) -> ServerSentEvent:
    return ServerSentEvent(event=name, data=data)


async def reply_events(
    thread_id: str,
    prepare: Callable[[], str | None] | None = None,
    rollback: Callable[[str], None] | None = None,
) -> AsyncIterator[ServerSentEvent]:
    """Generate, stream and store the assistant's reply.

    The thread is locked for the whole call. `prepare` runs once the lock
    is held (it saves the user's message and returns its id). If no reply
    ends up stored - LLM error, empty reply or a dropped connection - the
    `rollback(message_id)` callback undoes what `prepare` did, so the user
    can simply retry.
    """
    if not acquire_lock(thread_id):
        yield _event(
            "message.error",
            detail="A reply is already being generated for this thread",
        )
        return

    message_id = None
    stored = False

    try:
        message_id = prepare() if prepare else None

        with SessionLocal() as db:
            thread = db.get(Thread, thread_id)
            snapshot = thread.scenario_snapshot
            history = get_messages(db, thread_id)

        yield _event("message.started", user_message_id=message_id)

        chunks, ended = [], False

        async for token in stream_reply(snapshot, history):
            if token is END:
                ended = True
                continue

            chunks.append(token)
            yield _event("message.delta", content=token)

        content = "".join(chunks).strip()

        if not content:
            raise RuntimeError("AI returned an empty response")

        with SessionLocal() as db:
            thread = db.get(Thread, thread_id)
            reply = Message(
                thread_id=thread_id, role="assistant", content=content
            )
            db.add(reply)

            # A closing condition only tells the learner it may be time to finish.
            # The conversation stays open until they choose to finish it.
            reason = None
            if ended:
                reason = "scenario_completed"
            elif count_user_messages(db, thread_id) >= thread.max_turns:
                reason = "max_turns"
                thread.status = "completed"

            db.commit()
            reply_id, status = reply.id, thread.status

        stored = True
        yield _event(
            "message.completed",
            message_id=reply_id,
            thread_status=status,
            completion_reason=reason,
        )
    except Exception:
        logger.exception("Reply generation failed for thread %s", thread_id)
        yield _event("message.error", detail="Message generation failed")
    finally:
        # Also runs when the client disconnects mid-stream.
        if not stored and rollback and message_id:
            rollback(message_id)

        release_lock(thread_id)


def get_active_thread(id: str, user: CurrentUser, db: DbSession) -> Thread:
    """Owned, still active and not busy: checked before streaming starts
    so problems return normal HTTP errors."""
    thread = get_thread(db, id, user.id)

    if thread.status != "active":
        raise HTTPException(409, "Thread is completed")

    if is_generating(thread):
        raise HTTPException(
            409, "A reply is already being generated for this thread"
        )

    return thread


ActiveThread = Annotated[Thread, Depends(get_active_thread)]


def get_simulation_thread(thread: ActiveThread) -> Thread:
    if thread.mode != "simulation":
        raise HTTPException(409, "Use the guided turn APIs")

    return thread


def get_guided_thread(thread: ActiveThread) -> Thread:
    if thread.mode != "guided":
        raise HTTPException(409, "This thread is not in guided mode")

    return thread


SimulationThread = Annotated[Thread, Depends(get_simulation_thread)]
GuidedThread = Annotated[Thread, Depends(get_guided_thread)]
