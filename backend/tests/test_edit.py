from sqlalchemy import func, select

from db.db import Message, MessageEdit, Thread
from db.session import SessionLocal

API = "/api/v1"


def edit(client, thread_id, message_id, content):
    return client.patch(
        f"{API}/threads/{thread_id}/messages/{message_id}",
        json={"content": content},
    )


def thread_count(user_id):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(Thread).where(Thread.user_id == user_id))


def two_exchanges(login, api, make_public_scenario):
    owner = login("a@example.com")
    thread_id = api.start(owner, make_public_scenario()).json()["id"]
    api.send(owner, thread_id, "First question")
    api.send(owner, thread_id, "Second question")
    return owner, thread_id


def test_edit_changes_the_message_in_place_without_a_new_conversation(login, api, make_public_scenario):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")
    before = thread_count(owner.get(f"{API}/auth/me").json()["id"])

    response = edit(owner, thread_id, first["id"], "A better first question")

    assert response.status_code == 200
    assert "message.completed" in response.text
    assert thread_count(owner.get(f"{API}/auth/me").json()["id"]) == before
    edited = next(m for m in api.messages(owner, thread_id) if m["id"] == first["id"])
    assert edited["content"] == "A better first question"


def test_edit_archives_the_replies_after_the_message(login, api, make_public_scenario, fake_llm):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")

    edit(owner, thread_id, first["id"], "Rewritten")

    # Only the opening, the edited message and the new reply are part of the conversation.
    visible = api.messages(owner, thread_id)
    assert [m["content"] for m in visible][:2] == ["Hello, how can I help?", "Rewritten"]
    assert len(visible) == 3
    assert "Second question" not in [m["content"] for m in visible]

    # The character answered from the new text only.
    assert [m.content for m in fake_llm.last_messages] == ["Hello, how can I help?", "Rewritten"]


def test_edit_keeps_an_audit_trail_of_old_text_and_archived_messages(login, api, make_public_scenario):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")

    edit(owner, thread_id, first["id"], "Rewritten")

    with SessionLocal() as db:
        edits = db.scalars(select(MessageEdit).where(MessageEdit.thread_id == thread_id)).all()
        archived = db.scalars(
            select(Message).where(Message.thread_id == thread_id, Message.archived_at.is_not(None))
        ).all()

    assert [e.previous_content for e in edits] == ["First question"]
    assert len(archived) == 3  # the first reply, the second question and its reply


def test_editing_an_assistant_message_is_rejected(login, api, make_public_scenario):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    opening = api.messages(owner, thread_id)[0]

    assert edit(owner, thread_id, opening["id"], "nope").status_code == 409


def test_unknown_or_foreign_messages_are_not_found(login, api, make_public_scenario):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")
    other = login("b@example.com")

    assert edit(owner, thread_id, "does-not-exist", "x").status_code == 404
    assert edit(other, thread_id, first["id"], "x").status_code == 404


def test_completed_conversations_cannot_be_edited(login, api, make_public_scenario):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")
    owner.post(f"{API}/threads/{thread_id}/complete")

    assert edit(owner, thread_id, first["id"], "x").status_code == 409


def test_failed_reply_keeps_the_edited_text(login, api, make_public_scenario, fake_llm):
    owner, thread_id = two_exchanges(login, api, make_public_scenario)
    first = next(m for m in api.messages(owner, thread_id) if m["content"] == "First question")
    fake_llm.fail_after = 0

    response = edit(owner, thread_id, first["id"], "Rewritten")

    assert "message.error" in response.text
    visible = api.messages(owner, thread_id)
    assert visible[-1]["content"] == "Rewritten"
    assert owner.get(f"{API}/threads/{thread_id}").json()["status"] == "active"
