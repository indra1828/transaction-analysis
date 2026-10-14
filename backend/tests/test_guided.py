from db.db import Thread
from db.session import SessionLocal

API = "/api/v1"


def guided(login, api):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios", json={"title": "S", "config": {}}
    ).json()["id"]
    thread_id = api.start(owner, scenario_id, mode="guided").json()["id"]
    return owner, thread_id


def turns(owner, thread_id):
    return f"{API}/threads/{thread_id}/turns"


def test_guided_thread_rejects_plain_messages(login, api):
    owner, thread_id = guided(login, api)

    assert api.send(owner, thread_id).status_code == 409


def test_turn_apis_reject_simulation_threads(login, api):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios", json={"title": "S", "config": {}}
    ).json()["id"]
    thread_id = api.start(owner, scenario_id).json()["id"]

    response = owner.post(turns(owner, thread_id), json={"content": "Hi"})

    assert response.status_code == 409


def test_draft_gets_feedback_and_a_suggestion(login, api):
    owner, thread_id = guided(login, api)

    response = owner.post(turns(owner, thread_id), json={"content": "Hi"})

    assert response.status_code == 201
    turn = response.json()
    assert turn["number"] == 1 and turn["status"] == "draft"
    assert turn["revisions"][0]["content"] == "Hi"
    assert turn["revisions"][0]["feedback"]["suggested_response"]
    # Nothing is sent to the roleplay yet.
    assert len(api.messages(owner, thread_id)) == 1


def test_only_one_open_turn_at_a_time(login, api):
    owner, thread_id = guided(login, api)
    owner.post(turns(owner, thread_id), json={"content": "Hi"})

    response = owner.post(turns(owner, thread_id), json={"content": "Again"})

    assert response.status_code == 409


def test_revisions_are_kept(login, api):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()

    revised = owner.post(
        f"{turns(owner, thread_id)}/{turn['id']}/revise",
        json={"content": "Hello, can we talk?"},
    )

    assert revised.status_code == 200
    assert [r["content"] for r in revised.json()["revisions"]] == [
        "Hi",
        "Hello, can we talk?",
    ]
    assert len(api.messages(owner, thread_id)) == 1


def test_using_the_suggestion_makes_it_the_final_wording_without_review(
    login, api, fake_llm
):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    suggested = turn["revisions"][0]["feedback"]["suggested_response"]
    fake_llm.structured_calls = 0

    used = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/use-suggestion")

    assert used.status_code == 200
    assert fake_llm.structured_calls == 0  # no second coach review
    latest = used.json()["revisions"][-1]
    assert latest["content"] == suggested
    assert latest["feedback"]["acceptable"] is True
    assert latest["feedback"]["suggested_response"] == suggested

    accepted = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")
    assert "message.completed" in accepted.text
    assert api.messages(owner, thread_id)[1]["content"] == suggested


def test_accept_sends_latest_wording_and_triggers_the_reply(login, api):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    owner.post(
        f"{turns(owner, thread_id)}/{turn['id']}/revise",
        json={"content": "Hello, can we talk?"},
    )

    response = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")

    assert response.status_code == 200
    assert "message.completed" in response.text
    messages = api.messages(owner, thread_id)
    assert [m["role"] for m in messages] == [
        "assistant",
        "user",
        "assistant",
    ]
    assert messages[1]["content"] == "Hello, can we talk?"
    assert messages[1]["feedback"]["suggested_response"]
    stored = owner.get(turns(owner, thread_id)).json()[0]
    assert stored["status"] == "accepted"
    assert stored["accepted_message_id"] == messages[1]["id"]
    assert len(stored["revisions"]) == 2


def test_accepted_turn_cannot_be_accepted_or_revised_again(login, api):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    base = f"{turns(owner, thread_id)}/{turn['id']}"
    owner.post(f"{base}/accept")

    assert owner.post(f"{base}/accept").status_code == 409
    assert (
        owner.post(f"{base}/revise", json={"content": "x"}).status_code == 409
    )
    assert len(api.messages(owner, thread_id)) == 3  # no duplicate message


def test_next_turn_starts_after_acceptance(login, api):
    owner, thread_id = guided(login, api)
    first = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    owner.post(f"{turns(owner, thread_id)}/{first['id']}/accept")

    second = owner.post(turns(owner, thread_id), json={"content": "More"})

    assert second.status_code == 201
    assert second.json()["number"] == 2


def test_failed_reply_reopens_the_turn(login, api, fake_llm):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    fake_llm.fail_after = 0

    failed = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")

    assert "message.error" in failed.text
    assert len(api.messages(owner, thread_id)) == 1
    assert owner.get(turns(owner, thread_id)).json()[0]["status"] == "draft"

    fake_llm.fail_after = None
    retry = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")
    assert "message.completed" in retry.text


def test_unknown_turn_and_other_users(login, api):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    other = login("b@example.com")

    assert (
        owner.post(f"{turns(owner, thread_id)}/nope/accept").status_code == 404
    )
    assert other.get(turns(owner, thread_id)).status_code == 404
    assert (
        other.post(turns(owner, thread_id), json={"content": "x"}).status_code
        == 404
    )
    assert (
        other.post(
            f"{turns(owner, thread_id)}/{turn['id']}/accept"
        ).status_code
        == 404
    )


def test_feedback_failure_returns_502_and_creates_no_turn(
    login, api, fake_llm
):
    owner, thread_id = guided(login, api)
    fake_llm.fail_structured = True

    response = owner.post(turns(owner, thread_id), json={"content": "Hi"})

    assert response.status_code == 502
    assert owner.get(turns(owner, thread_id)).json() == []


def test_simulation_mode_never_uses_the_coach(login, api, fake_llm):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios", json={"title": "S", "config": {}}
    ).json()["id"]
    thread_id = api.start(owner, scenario_id).json()["id"]

    api.send(owner, thread_id, "one")
    api.send(owner, thread_id, "two")

    assert fake_llm.structured_calls == 0


def test_guided_thread_can_be_evaluated(login, api):
    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "hi"}).json()
    owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")
    owner.post(turns(owner, thread_id), json={"content": "unsent draft"})

    response = owner.post(f"{API}/threads/{thread_id}/complete")

    assert response.status_code == 200
    with SessionLocal() as db:
        assert db.get(Thread, thread_id).status == "completed"


def test_guided_turn_limit_completes_the_thread(login, api):
    owner = login("a@example.com")
    scenario_id = owner.post(
        f"{API}/scenarios", json={"title": "S", "config": {}}
    ).json()["id"]
    thread_id = api.start(
        owner, scenario_id, mode="guided", max_turns=1
    ).json()["id"]
    turn = owner.post(turns(owner, thread_id), json={"content": "hi"}).json()

    response = owner.post(f"{turns(owner, thread_id)}/{turn['id']}/accept")

    assert "max_turns" in response.text
    assert (
        owner.post(
            turns(owner, thread_id), json={"content": "more"}
        ).status_code
        == 409
    )


def test_parallel_accept_cannot_double_send(login, api):
    """Two accepts passing the early check: only the first may win."""
    import main
    from db.session import DbSession
    from routes.turn import get_open_turn, get_turn
    from services.threads import GuidedThread

    owner, thread_id = guided(login, api)
    turn = owner.post(turns(owner, thread_id), json={"content": "Hi"}).json()
    url = f"{turns(owner, thread_id)}/{turn['id']}/accept"
    owner.post(url)

    def skip_status_check(turn_id: str, thread: GuidedThread, db: DbSession):
        return get_turn(db, thread.id, turn_id)

    main.app.dependency_overrides[get_open_turn] = skip_status_check
    try:
        second = owner.post(url)
    finally:
        main.app.dependency_overrides.pop(get_open_turn)

    assert "message.error" in second.text
    assert len(api.messages(owner, thread_id)) == 3
    assert owner.get(turns(owner, thread_id)).json()[0]["status"] == (
        "accepted"
    )
