
import os

from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from db.db import User
from db.session import DbSession
from oauth.dependencies import CurrentUser
from oauth.google import oauth
from oauth.sessions import end_session, start_session

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(
        request, str(redirect_uri)
    )


@router.get("/google/callback")
async def google_callback(request: Request, db: DbSession):
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as exc:
        raise HTTPException(
            status_code=400,
            detail="Google authentication failed",
        ) from exc

    profile = token.get("userinfo")

    if not profile or not profile.get("sub"):
        raise HTTPException(400, "Invalid Google identity")

    if not profile.get("email_verified"):
        raise HTTPException(403, "Google email is not verified")

    email = profile.get("email")
    if not email:
        raise HTTPException(400, "Google email is unavailable")

    user = db.scalar(
        select(User).where(User.oauth_sub == profile["sub"])
    )

    if user is None:
        existing = db.scalar(
            select(User).where(User.email == email)
        )

        if existing is not None:
            raise HTTPException(
                409,
                "Email already belongs to another account",
            )

        user = User(
            email=email,
            oauth_sub=profile["sub"],
        )

        db.add(user)

        try:
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                409, "Account already exists"
            ) from exc

    start_session(request, db, user.id)

    return RedirectResponse(url=os.getenv("FRONTEND_URL", "/docs"))


@router.get("/me")
def get_me(user: CurrentUser):
    return {
        "id": user.id,
        "email": user.email,
    }


@router.post("/logout")
def logout(request: Request, db: DbSession):
    end_session(request, db)
    return {"message": "Logged out successfully"}
