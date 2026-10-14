import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# Environment must be set before the app is imported.
os.environ.update(
    GOOGLE_CLIENT_ID="test-client-id",
    GOOGLE_CLIENT_SECRET="test-client-secret",
    SESSION_SECRET="test-session-secret-0123456789abcdef",
    COOKIE_SECURE="false",
    GROQ_API_KEY="test-key",
    DATABASE_URL="sqlite:///" + Path(tempfile.mkdtemp(), "test.db").as_posix(),
)

from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.messages import AIMessage, AIMessageChunk  # noqa: E402

import main  # noqa: E402
from db.db import Base, Scenario  # noqa: E402
from db.session import SessionLocal, engine  # noqa: E402
from models.evaluation import (  # noqa: E402
    Alternative,
    EgoStateCue,
    EvaluationReport,
    ObjectiveResult,
    TurningPoint,
)
from models.scenario import ScenarioConfig, ScenarioDraft  # noqa: E402
from models.thread import TurnFeedback  # noqa: E402
from oauth.google import oauth  # noqa: E402


class FakeLLM:
    """Stands in for Groq: no network, fully scripted."""

    def __init__(self):
        self.tokens = ["Sure", ", let's talk."]
        self.fail_after = None  # raise after this many tokens
        self.opening = "Hello, how can I help?"
        self.fail_structured = False
        self.statuses = ["missed", "achieved"]  # per evaluation call
        self.stream_calls = 0
        self.structured_calls = 0
        self.last_system = None
        self.last_messages = None

    def create_agent(self, model=None, system_prompt=None, response_format=None):
        """Replaces llm.model.create_deep_agent: same call shape."""
        return FakeAgent(self, system_prompt, response_format)

    def record(self, system_prompt, messages):
        self.last_system = system_prompt
        self.last_messages = messages

    async def stream(self, system_prompt, messages):
        self.stream_calls += 1
        self.record(system_prompt, messages)

        for count, token in enumerate(self.tokens):
            if self.fail_after is not None and count >= self.fail_after:
                raise RuntimeError("stream interrupted")
            yield AIMessageChunk(content=token)

    async def run(self, system_prompt, messages, response_format):
        self.record(system_prompt, messages)

        if response_format is None:
            return {"messages": [AIMessage(content=self.opening)]}

        self.structured_calls += 1

        if self.fail_structured:
            raise RuntimeError("LLM unavailable")

        return {
            "messages": [AIMessage(content="")],
            "structured_response": self.structured(response_format),
        }

    def structured(self, schema):
        if schema is EvaluationReport:
            status = self.statuses[
                min(self.structured_calls - 1, len(self.statuses) - 1)
            ]
            return EvaluationReport(
                summary="A calm attempt.",
                ego_state_cues=[
                    EgoStateCue(
                        message_id="m2",
                        ego_state="adult",
                        evidence="hi",
                        note="May suggest an Adult cue.",
                    ),
                    EgoStateCue(  # invented quote: must be dropped
                        message_id="m2",
                        ego_state="child",
                        evidence="something never said",
                        note="made up",
                    ),
                ],
                transactions=[],
                assertiveness="Fairly assertive.",
                active_listening="Some listening.",
                conflict_management="Calm.",
                problem_solving="Limited.",
                objectives=[
                    ObjectiveResult(
                        objective="Stay calm",
                        status=status,
                        evidence="m2",
                    )
                ],
                turning_point=TurningPoint(
                    message_id="m99", explanation="not a real message"
                ),
                strengths=["Polite"],
                improvements=["Ask more questions"],
                alternatives=[
                    Alternative(
                        message_id="m2",
                        suggested_response="Hello, can we talk?",
                        why="Clearer.",
                    ),
                    Alternative(  # m1 is the AI's: must be dropped
                        message_id="m1",
                        suggested_response="x",
                        why="y",
                    ),
                ],
                caveat="model wrote its own caveat",
            )

        if schema is TurnFeedback:
            return TurnFeedback(
                acceptable=False,
                feedback="Good start; add a question.",
                ta_note="This may come across as an Adult cue.",
                suggested_response="Could we look at what happened?",
            )

        return ScenarioDraft(
            title="Generated",
            config=ScenarioConfig(
                persona="A manager",
                user_role="Employee",
                context="A budget talk",
                objectives=["Be clear"],
                stopping_conditions=["Agreement"],
                opening_line="Let's begin.",
            ),
        )


class FakeAgent:
    """Mirrors the Deep Agent calls the app makes (ainvoke and astream)."""

    def __init__(self, fake, system_prompt, response_format):
        self.fake = fake
        self.system_prompt = system_prompt
        self.response_format = response_format

    async def ainvoke(self, payload):
        return await self.fake.run(
            self.system_prompt, payload["messages"], self.response_format
        )

    async def astream(self, payload, stream_mode="messages"):
        async for chunk in self.fake.stream(
            self.system_prompt, payload["messages"]
        ):
            yield chunk, {"langgraph_node": "model"}


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture(autouse=True)
def fake_llm():
    fake = FakeLLM()
    with patch("llm.model.create_deep_agent", fake.create_agent):
        yield fake


@pytest.fixture
def anon():
    return TestClient(main.app)


@pytest.fixture
def login():
    """Return a client signed in as the given Google identity."""

    def _login(email, sub=None, verified=True):
        client = TestClient(main.app)
        token = {
            "userinfo": {
                "sub": sub or f"sub-{email}",
                "email": email,
                "email_verified": verified,
            }
        }
        with patch.object(
            oauth.google,
            "authorize_access_token",
            AsyncMock(return_value=token),
        ):
            client.get(
                "/api/v1/auth/google/callback",
                follow_redirects=False,
            )
        return client

    return _login


@pytest.fixture
def make_public_scenario():
    def _make(title="Missed Deadline"):
        with SessionLocal() as db:
            scenario = Scenario(
                title=title,
                config={"persona": "Arjun", "objectives": ["Stay calm"]},
                is_public=True,
            )
            db.add(scenario)
            db.commit()
            return scenario.id

    return _make


@pytest.fixture
def api():
    """Small helpers shared by the thread tests."""

    class Api:
        base = "/api/v1"

        def start(self, client, scenario_id, **extra):
            return client.post(
                f"{self.base}/threads",
                json={"scenario_id": scenario_id, **extra},
            )

        def send(self, client, thread_id, content="Hi"):
            return client.post(
                f"{self.base}/threads/{thread_id}/messages",
                json={"content": content},
            )

        def messages(self, client, thread_id):
            return client.get(
                f"{self.base}/threads/{thread_id}/messages"
            ).json()

    return Api()
