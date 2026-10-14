from db.db import Evaluation, Thread
from db.session import SessionLocal

API = "/api/v1"


def chat(login, api, text="hi"):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios",
        json={"title": "S", "config": {"objectives": ["Stay calm"]}},
    ).json()["id"]
    thread_id = api.start(owner, scenario_id).json()["id"]
    api.send(owner, thread_id, text)
    return owner, thread_id


def test_complete_creates_a_grounded_report(login, api):
    owner, thread_id = chat(login, api)

    response = owner.post(f"{API}/threads/{thread_id}/complete")

    assert response.status_code == 200
    report = response.json()["report"]
    user_message = api.messages(owner, thread_id)[1]

    # Only the cue quoting a real message survives, with the real id.
    assert [c["note"] for c in report["ego_state_cues"]] == [
        "May suggest an Adult cue."
    ]
    assert report["ego_state_cues"][0]["message_id"] == user_message["id"]
    # A reference to a non-existent message is dropped.
    assert report["turning_point"] is None
    # Alternatives are only kept for the user's own messages.
    assert [a["message_id"] for a in report["alternatives"]] == [
        user_message["id"]
    ]
    # The tentative, non-diagnostic caveat is set by the server.
    assert "not a diagnosis" in report["caveat"]
    assert owner.get(f"{API}/threads/{thread_id}").json()["status"] == (
        "completed"
    )


def test_evaluation_can_be_read_after_completion(login, api):
    owner, thread_id = chat(login, api)
    owner.post(f"{API}/threads/{thread_id}/complete")

    response = owner.get(f"{API}/threads/{thread_id}/evaluation")

    assert response.status_code == 200
    assert response.json()["thread_id"] == thread_id


def test_evaluation_before_completion_is_404(login, api):
    owner, thread_id = chat(login, api)
    assert (
        owner.get(f"{API}/threads/{thread_id}/evaluation").status_code == 404
    )


def test_completing_twice_returns_the_same_evaluation(login, api, fake_llm):
    owner, thread_id = chat(login, api)

    first = owner.post(f"{API}/threads/{thread_id}/complete").json()
    second = owner.post(f"{API}/threads/{thread_id}/complete").json()

    assert first == second
    assert fake_llm.structured_calls == 1
    with SessionLocal() as db:
        assert db.query(Evaluation).count() == 1


def test_thread_without_user_messages_cannot_be_completed(login, api):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios", json={"title": "S", "config": {}}
    ).json()["id"]
    thread_id = api.start(owner, scenario_id).json()["id"]

    response = owner.post(f"{API}/threads/{thread_id}/complete")

    assert response.status_code == 409


def test_failed_evaluation_leaves_the_thread_open(login, api, fake_llm):
    owner, thread_id = chat(login, api)
    fake_llm.fail_structured = True

    response = owner.post(f"{API}/threads/{thread_id}/complete")

    assert response.status_code == 502
    with SessionLocal() as db:
        assert db.get(Thread, thread_id).status == "active"
        assert db.query(Evaluation).count() == 0

    fake_llm.fail_structured = False
    assert owner.post(f"{API}/threads/{thread_id}/complete").status_code == 200


def test_other_users_cannot_evaluate_or_read(login, api):
    owner, thread_id = chat(login, api)
    other = login("b@example.com")
    owner.post(f"{API}/threads/{thread_id}/complete")

    assert other.post(f"{API}/threads/{thread_id}/complete").status_code == 404
    assert (
        other.get(f"{API}/threads/{thread_id}/evaluation").status_code == 404
    )


def test_evaluation_waits_for_a_running_reply(login, api):
    from services.threads import acquire_lock

    owner, thread_id = chat(login, api)
    assert acquire_lock(thread_id)

    assert owner.post(f"{API}/threads/{thread_id}/complete").status_code == 409
