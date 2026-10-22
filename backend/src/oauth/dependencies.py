
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from db.db import User
from db.session import DbSession
from oauth.roles import Role, can_teach
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


def get_current_teacher(user: CurrentUser) -> User:
    if not can_teach(user.role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only teachers can do this")

    return user


def get_current_superadmin(user: CurrentUser) -> User:
    if user.role != Role.SUPERADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only superadmins can do this")

    return user


CurrentTeacher = Annotated[User, Depends(get_current_teacher)]
CurrentSuperAdmin = Annotated[User, Depends(get_current_superadmin)]
