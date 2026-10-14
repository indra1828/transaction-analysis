
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# Must run before importing modules that read environment variables.
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.sessions import SessionMiddleware  # noqa: E402

from db.seed import seed_scenarios  # noqa: E402
from db.session import init_db  # noqa: E402
from routes.oauth import router as oauth_router  # noqa: E402
from routes.scenario import router as scenario_router  # noqa: E402
from routes.thread import router as thread_router  # noqa: E402
from routes.turn import router as turn_router  # noqa: E402
from oauth.sessions import SESSION_LIFETIME  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_scenarios()
    yield


app = FastAPI(
    title="TA Coach API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    session_cookie="ta_coach_session",
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE", "false").lower() == "true",
    max_age=int(SESSION_LIFETIME.total_seconds()),
)

app.include_router(oauth_router, prefix="/api/v1")
app.include_router(scenario_router, prefix="/api/v1")
app.include_router(thread_router, prefix="/api/v1")
app.include_router(turn_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
