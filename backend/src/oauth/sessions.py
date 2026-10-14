"""Server-side sign-in sessions.

The browser cookie holds only a random session id. The session itself lives
in the database, so logout removes it and a copied cookie stops working.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from db.db import AuthSession, utc_now

SESSION_LIFETIME = timedelta(minutes=10)  # the cookie max_age in main.py is derived from this


def _aware(value: datetime) -> datetime:
    # SQLite returns naive datetimes; they are stored as UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def start_session(request: Request, db: Session, user_id: str) -> None:
    session_id = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            id=session_id,
            user_id=user_id,
            expires_at=utc_now() + SESSION_LIFETIME,
        )
    )
    db.commit()

    request.session.clear()
    request.session["sid"] = session_id


def find_session(db: Session, session_id: str | None) -> AuthSession | None:
    if not session_id:
        return None

    auth = db.get(AuthSession, session_id)

    if auth is None or _aware(auth.expires_at) <= utc_now():
        return None

    return auth


def end_session(request: Request, db: Session) -> None:
    auth = find_session(db, request.session.get("sid"))

    if auth is not None:
        db.delete(auth)
        db.commit()

    request.session.clear()
