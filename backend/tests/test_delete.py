from sqlalchemy import func, select

from db.db import Evaluation, Message, MessageEdit, Thread, Turn, utc_now
from db.session import SessionLocal

API = "/api/v1"


def stored(thread_ids):
    """Row counts in every table that can hold data for these conversations."""
    with SessionLocal() as db:
        return {
            "threads": db.scalar(select(func.count()).select_from(Thread).where(Thread.id.in_(thread_ids))),
            "messages": db.scalar(select(func.count()).select_from(Message).where(Message.thread_id.in_(thread_ids))),
            "turns": db.scalar(select(func.count()).select_from(Turn).where(Turn.thread_id.in_(thread_ids))),
            "evaluations": db.scalar(
                select(func.count()).select_from(Evaluation).where(Evaluation.thread_id.in_(thread_ids))
            ),
            "edits": db.scalar(
                select(func.count()).select_from(MessageEdit).where(MessageEdit.thread_id.in_(thread_ids))
            ),
        }


EMPTY = {"threads": 0, "messages": 0, "turns": 0, "evaluations": 0, "edits": 0}


def add_legacy_branch(parent_id):
    """A child conversation from before editing was in place. Only old data can have these."""
    with SessionLocal() as db:
        parent = db.get(Thread, parent_id)
        child = Thread(
            user_id=parent.user_id,
            scenario_id=parent.scenario_id,
            scenario_snapshot=parent.scenario_snapshot,
            mode="simulation",
            max_turns=parent.max_turns,
            parent_thread_id=parent_id,
            created_at=utc_now(),
        )
        db.add(child)
        db.flush()
        db.add(Message(thread_id=child.id, role="user", content="Old branch", created_at=utc_now()))
        db.commit()
        return child.id


def test_delete_removes_conversation_report_edit_history_and_legacy_branches(login, api, make_public_scenario):
    owner = login("a@example.com")
    scenario_id = make_public_scenario()
    thread_id = api.start(owner, scenario_id).json()["id"]
    api.send(owner, thread_id, "One")
    api.send(owner, thread_id, "Two")
    first_user = next(m for m in api.messages(owner, thread_id) if m["role"] == "user")
    owner.patch(
        f"/api/v1/threads/{thread_id}/messages/{first_user['id']}",
        json={"content": "One, reworded"},
    )
    branch_id = add_legacy_branch(thread_id)
    assert owner.post(f"{API}/threads/{thread_id}/complete").status_code == 200
    assert owner.post(f"{API}/threads/{branch_id}/complete").status_code == 200

    before = stored([thread_id, branch_id])
    assert before["threads"] == 2 and before["messages"] > 0 and before["evaluations"] == 2
    assert before["edits"] == 1

    response = owner.delete(f"{API}/threads/{thread_id}")

    assert response.status_code == 204
    assert stored([thread_id, branch_id]) == EMPTY
    assert owner.get(f"{API}/threads/{thread_id}").status_code == 404


def test_delete_removes_guided_turns(login, api, make_public_scenario):
    owner = login("a@example.com")
    thread_id = api.start(owner, make_public_scenario(), mode="guided").json()["id"]
    assert owner.post(f"{API}/threads/{thread_id}/turns", json={"content": "A draft"}).status_code == 201

    assert stored([thread_id])["turns"] == 1

    assert owner.delete(f"{API}/threads/{thread_id}").status_code == 204
    assert stored([thread_id]) == EMPTY


def test_delete_keeps_other_conversations_and_the_scenario(login, api, make_public_scenario):
    owner = login("a@example.com")
    scenario_id = make_public_scenario()
    doomed = api.start(owner, scenario_id).json()["id"]
    kept = api.start(owner, scenario_id).json()["id"]
    api.send(owner, kept, "Still here")

    owner.delete(f"{API}/threads/{doomed}")

    assert stored([kept])["messages"] >= 2
    assert owner.get(f"{API}/threads/{kept}").status_code == 200
    assert owner.get(f"{API}/scenarios/{scenario_id}").status_code == 200


def test_another_user_cannot_delete_and_nothing_is_removed(login, api, make_public_scenario):
    owner = login("a@example.com")
    intruder = login("b@example.com")
    thread_id = api.start(owner, make_public_scenario()).json()["id"]
    api.send(owner, thread_id, "Mine")
    before = stored([thread_id])

    assert intruder.delete(f"{API}/threads/{thread_id}").status_code == 404
    assert stored([thread_id]) == before


def test_delete_unknown_conversation_is_404(login):
    owner = login("a@example.com")

    assert owner.delete(f"{API}/threads/does-not-exist").status_code == 404


def test_delete_is_refused_while_a_reply_is_generating(login, api, make_public_scenario):
    owner = login("a@example.com")
    thread_id = api.start(owner, make_public_scenario()).json()["id"]
    with SessionLocal() as db:
        db.get(Thread, thread_id).generating_since = utc_now()
        db.commit()

    response = owner.delete(f"{API}/threads/{thread_id}")

    assert response.status_code == 409
    assert stored([thread_id])["threads"] == 1
