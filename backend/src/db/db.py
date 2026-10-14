from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def generate_id():
    return str(uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_id,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
    )
    oauth_sub: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
    )


class AuthSession(Base):
    """One signed-in browser. Deleting the row signs that browser out."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    title: Mapped[str]
    config: Mapped[dict] = mapped_column(JSON)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    is_public: Mapped[bool] = mapped_column(default=False)


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    scenario_id: Mapped[str] = mapped_column(ForeignKey("scenarios.id"))
    # Copy of the scenario taken when the thread starts, so later
    # edits to the scenario never change a running conversation.
    scenario_snapshot: Mapped[dict] = mapped_column(JSON)
    mode: Mapped[str] = mapped_column(String(20), default="simulation")
    status: Mapped[str] = mapped_column(String(20), default="active")
    max_turns: Mapped[int] = mapped_column(default=10)
    parent_thread_id: Mapped[str | None] = mapped_column(
        ForeignKey("threads.id")
    )
    # Message of the parent thread this branch was created from.
    branch_from_message_id: Mapped[str | None] = mapped_column(String(36))
    # Set while a reply is being generated; guards against
    # simultaneous generation within the same thread.
    generating_since: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"))
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    feedback: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    # Set when an earlier message was edited: this message is then kept only
    # for audit and is no longer part of the conversation.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MessageEdit(Base):
    """Audit trail: the text a learner message had before each edit."""

    __tablename__ = "message_edits"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"))
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"))
    previous_content: Mapped[str] = mapped_column(Text)
    edited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Turn(Base):
    """One user turn in guided mode: drafts, revisions and acceptance."""

    __tablename__ = "turns"
    __table_args__ = (UniqueConstraint("thread_id", "number"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"))
    number: Mapped[int]
    status: Mapped[str] = mapped_column(String(20), default="draft")
    revisions: Mapped[list] = mapped_column(JSON)
    accepted_message_id: Mapped[str | None] = mapped_column(String(36))


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_id
    )
    thread_id: Mapped[str] = mapped_column(
        ForeignKey("threads.id"), unique=True
    )
    report: Mapped[dict] = mapped_column(JSON)
