
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from db.db import User
from db.session import DbSession
from oauth.sessions import find_session


def get_current_user(request: Request, db: DbSession) -> User:
    auth = find_session(db, request.session.get("sid"))
    user = db.get(User, auth.user_id) if auth else None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
