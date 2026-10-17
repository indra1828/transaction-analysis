import pytest

from db.db import Thread
from db.session import SessionLocal, engine
from services.threads import acquire_lock

API = "/api/v1"


def private_scenario(client):
    return client.post(
        f"{API}/scenarios",
        json={"title": "Mine", "config": {"persona": "Boss"}},
    ).json()["id"]


def test_thread_owner_comes_from_session(login, api):
    owner = login("a@example.com")
    me = owner.get(f"{API}/auth/me").json()["id"]

    response = api.start(
        owner, private_scenario(owner), user_id="someone-else"
    )

    assert response.status_code == 201
    assert response.json()["user_id"] == me
    assert response.json()["opening_message"]["role"] == "assistant"


def test_cannot_start_thread_on_other_users_private_scenario(login, api):
    owner, other = login("a@example.com"), login("b@example.com")
    assert api.start(other, private_scenario(owner)).status_code == 404


def test_can_start_thread_on_public_scenario(login, api, make_public_scenario):
    user = login("a@example.com")
    assert api.start(user, make_public_scenario()).status_code == 201


def test_threads_are_isolated_between_users(login, api):
    owner, other = login("a@example.com"), login("b@example.com")
    thread_id = api.start(owner, private_scenario(owner)).json()["id"]

    assert [t["id"] for t in owner.get(f"{API}/threads").json()] == [thread_id]
    assert other.get(f"{API}/threads").json() == []
    assert other.get(f"{API}/threads/{thread_id}").status_code == 404
    assert api.messages(other, thread_id)["detail"] == "Thread not found"
    assert api.send(other, thread_id).status_code == 404
    assert [m["role"] for m in api.messages(owner, thread_id)] == ["assistant"]


def test_owner_can_chat_and_history_is_saved(login, api, fake_llm):
    owner = login("a@example.com")
    thread_id = api.start(owner, private_scenario(owner)).json()["id"]

    response = api.send(owner, thread_id)

    assert response.status_code == 200
    assert "message.completed" in response.text
    messages = api.messages(owner, thread_id)
    assert [m["role"] for m in messages] == [
        "assistant",
        "user",
        "assistant",
    ]
    assert messages[-1]["content"] == "Sure, let's talk."


def test_unknown_thread_returns_404(login, api):
    assert api.send(login("a@example.com"), "nope").status_code == 404


def test_scenario_snapshot_is_stored_and_used_in_the_prompt(
    login, api, fake_llm
):
    owner = login("a@example.com")
    thread_id = api.start(owner, private_scenario(owner)).json()["id"]
    api.send(owner, thread_id)

    with SessionLocal() as db:
        snapshot = db.get(Thread, thread_id).scenario_snapshot
    assert snapshot == {"title": "Mine", "config": {"persona": "Boss"}}

    assert "Mine" in fake_llm.last_system and "Boss" in fake_llm.last_system
    # Multi-turn memory: opening line + the user's message are sent.
    assert [m.content for m in fake_llm.last_messages] == [
        "Hello, how can I help?",
        "Hi",
    ]


def test_second_turn_includes_earlier_conversation(login, api, fake_llm):
    owner = login("a@example.com")
    thread_id = api.start(owner, private_scenario(owner)).json()["id"]
    api.send(owner, thread_id, "First")
    api.send(owner, thread_id, "Second")

    contents = [m.content for m in fake_llm.last_messages]
    assert contents == [
        "Hello, how can I help?",
        "First",
        "Sure, let's talk.",
        "Second",
    ]


def test_opening_line_in_config_skips_the_llm(login, api, fake_llm):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios",
        json={"title": "T", "config": {"opening_line": "Morning."}},
    ).json()["id"]

    opening = api.start(owner, scenario_id).json()["opening_message"]

    assert opening["content"] == "Morning."


# ---- reliability -----------------------------------------------------


def started(login, api):
    owner = login("a@example.com")
    return owner, api.start(owner, private_scenario(owner)).json()["id"]


def generating_since(thread_id):
    with SessionLocal() as db:
        return db.get(Thread, thread_id).generating_since


def test_interrupted_stream_is_rolled_back_and_can_be_retried(
    login, api, fake_llm
):
    owner, thread_id = started(login, api)
    fake_llm.fail_after = 1

    response = api.send(owner, thread_id, "Hello there")

    assert "message.error" in response.text
    assert "message.completed" not in response.text
    # The unanswered user message is removed, the lock is released.
    assert [m["role"] for m in api.messages(owner, thread_id)] == ["assistant"]
    assert generating_since(thread_id) is None

    fake_llm.fail_after = None
    retry = api.send(owner, thread_id, "Hello there")
    assert "message.completed" in retry.text


@pytest.mark.parametrize("tokens", [[], [""], ["  ", "\n"]])
def test_empty_llm_response_is_an_error_not_a_blank_message(
    login, api, fake_llm, tokens
):
    owner, thread_id = started(login, api)
    fake_llm.tokens = tokens

    response = api.send(owner, thread_id)

    assert "message.error" in response.text
    assert len(api.messages(owner, thread_id)) == 1


def test_parallel_generation_is_blocked(login, api):
    owner, thread_id = started(login, api)
    assert acquire_lock(thread_id)  # another request is mid-reply

    response = api.send(owner, thread_id)

    assert response.status_code == 409
    assert len(api.messages(owner, thread_id)) == 1


def test_lost_race_for_the_lock_saves_nothing(login, api, monkeypatch):
    owner, thread_id = started(login, api)
    assert acquire_lock(thread_id)
    # Simulate two requests passing the early check at the same moment.
    monkeypatch.setattr("services.threads.is_generating", lambda t: False)

    response = api.send(owner, thread_id)

    assert "already being generated" in response.text
    assert len(api.messages(owner, thread_id)) == 1


def test_stale_lock_expires(login, api):
    from datetime import datetime, timedelta, timezone

    owner, thread_id = started(login, api)
    with SessionLocal() as db:
        db.get(Thread, thread_id).generating_since = datetime.now(
            timezone.utc
        ) - timedelta(minutes=10)
        db.commit()

    assert "message.completed" in api.send(owner, thread_id).text


def test_max_turns_completes_the_thread(login, api):
    owner = login("a@example.com")
    thread_id = api.start(owner, private_scenario(owner), max_turns=2).json()[
        "id"
    ]

    first = api.send(owner, thread_id)
    second = api.send(owner, thread_id)

    assert '"completion_reason":null' in first.text.replace(" ", "")
    assert "max_turns" in second.text
    assert owner.get(f"{API}/threads/{thread_id}").json()["status"] == (
        "completed"
    )
    assert api.send(owner, thread_id).status_code == 409


def test_scenario_completion_marker_only_offers_to_finish(login, api, fake_llm):
    from llm.roleplay import MIN_LEARNER_MESSAGES_BEFORE_END

    owner, thread_id = started(login, api)
    for number in range(MIN_LEARNER_MESSAGES_BEFORE_END - 1):
        api.send(owner, thread_id, f"Message {number}")
    fake_llm.tokens = ["Thanks, ", "agreed.", " [[E", "ND]]"]

    response = api.send(owner, thread_id, "Final point")

    assert "scenario_completed" in response.text
    assert "[[" not in response.text and "END" not in response.text
    assert api.messages(owner, thread_id)[-1]["content"] == ("Thanks, agreed.")
    # The conversation stays open until the learner chooses to finish.
    assert owner.get(f"{API}/threads/{thread_id}").json()["status"] == "active"

    fake_llm.tokens = ["Let's keep going."]
    assert "message.completed" in api.send(owner, thread_id, "Still talking").text


def test_completion_marker_is_ignored_before_the_minimum_exchanges(login, api, fake_llm):
    from llm.roleplay import MIN_LEARNER_MESSAGES_BEFORE_END

    owner, thread_id = started(login, api)
    fake_llm.tokens = ["Fine, ", "let's talk.", " [[END]]"]

    for number in range(MIN_LEARNER_MESSAGES_BEFORE_END - 1):
        response = api.send(owner, thread_id, f"Message {number}")
        assert "scenario_completed" not in response.text


def test_early_completion_marker_is_ignored(login, api, fake_llm):
    owner, thread_id = started(login, api)
    fake_llm.tokens = ["Okay, ", "let's talk. ", "[[END]]"]

    response = api.send(owner, thread_id)

    assert "scenario_completed" not in response.text
    assert "[[" not in response.text
    assert api.messages(owner, thread_id)[-1]["content"] == "Okay, let's talk."
    assert owner.get(f"{API}/threads/{thread_id}").json()["status"] == "active"


def test_max_turns_is_validated(login, api):
    owner = login("a@example.com")
    scenario_id = private_scenario(owner)
    assert api.start(owner, scenario_id, max_turns=0).status_code == 422
    assert api.start(owner, scenario_id, max_turns=999).status_code == 422


def test_opening_failure_returns_502_and_creates_nothing(
    login, api, fake_llm, monkeypatch
):
    owner = login("a@example.com")
    scenario_id = private_scenario(owner)

    async def boom(system_prompt, messages, response_format):
        raise RuntimeError("down")

    monkeypatch.setattr(fake_llm, "run", boom)

    assert api.start(owner, scenario_id).status_code == 502
    assert owner.get(f"{API}/threads").json() == []


def test_foreign_keys_are_enforced():
    from sqlalchemy import text

    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
