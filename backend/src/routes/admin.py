from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from db.db import User
from db.session import DbSession
from models.admin import RoleUpdate, UserAdminResponse
from oauth.dependencies import CurrentSuperAdmin
from oauth.roles import Role, superadmin_emails

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserAdminResponse])
def list_users(
    _: CurrentSuperAdmin,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return db.scalars(
        select(User).order_by(User.email).limit(limit).offset(offset)
    ).all()


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
def set_role(
    user_id: str,
    data: RoleUpdate,
    _: CurrentSuperAdmin,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.role == Role.SUPERADMIN or user.email.lower() in superadmin_emails():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Superadmins are set with SUPERADMIN_EMAILS, not here",
        )

    user.role = data.role
    db.commit()
    db.refresh(user)

    return user
