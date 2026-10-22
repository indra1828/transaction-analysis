API = "/api/v1/scenarios"
BODY = {"title": "My practice", "config": {"persona": "Boss"}}


def test_teacher_scenario_is_shared_with_every_user(make_teacher, login):
    teacher, learner = make_teacher("t@example.com"), login("b@example.com")
    created = teacher.post(API, json=BODY)

    assert created.status_code == 201
    body = created.json()
    assert body["is_shared"] is True
    assert body["is_public"] is False
    assert body["editable"] is True

    assert [s["id"] for s in learner.get(API).json()] == [body["id"]]
    shared = learner.get(f"{API}/{body['id']}").json()
    assert shared["editable"] is False


def test_private_teacher_scenario_is_visible_only_to_its_creator(make_teacher, login):
    teacher, learner = make_teacher("t@example.com"), login("b@example.com")
    created = teacher.post(API, json={**BODY, "is_shared": False}).json()

    assert created["is_shared"] is False
    assert created["editable"] is True
    assert [s["id"] for s in teacher.get(API).json()] == [created["id"]]
    assert learner.get(API).json() == []
    assert learner.get(f"{API}/{created['id']}").status_code == 404


def test_student_scenario_is_private_even_when_shared_is_requested(login):
    student, learner = login("a@example.com"), login("b@example.com")
    created = student.post(API, json={**BODY, "is_shared": True})

    assert created.status_code == 201
    body = created.json()
    assert body["is_shared"] is False
    assert body["editable"] is True
    assert [s["id"] for s in student.get(API).json()] == [body["id"]]
    assert learner.get(API).json() == []
    assert learner.get(f"{API}/{body['id']}").status_code == 404


def test_student_cannot_share_a_scenario(login):
    student = login("a@example.com")
    created = student.post(API, json=BODY).json()

    assert student.patch(f"{API}/{created['id']}", json={"is_shared": True}).status_code == 403
    assert student.get(f"{API}/{created['id']}").json()["is_shared"] is False


def test_student_can_draft_a_scenario_without_saving_it(login, monkeypatch):
    student = login("a@example.com")

    async def fake_draft(data):
        return {"title": data.title, "config": {"persona": "Boss", "user_role": "Me", "context": "x", "objectives": ["o"], "stopping_conditions": ["s"]}}

    monkeypatch.setattr("routes.scenario.draft_scenario", fake_draft)
    response = student.post(
        f"{API}/draft",
        json={
            "title": "Raise talk",
            "situation": "I want a raise after a good year.",
            "user_role": "Employee",
            "ai_role": "Manager",
            "goals": ["Ask for a raise"],
        },
    )

    assert response.status_code == 200
    assert student.get(API).json() == []


def test_client_cannot_make_scenario_public(make_teacher, login):
    teacher, other = make_teacher("t@example.com"), login("b@example.com")
    created = teacher.post(
        API,
        json={**BODY, "is_public": True, "created_by": "someone-else"},
    ).json()

    assert created["is_public"] is False
    assert created["is_shared"] is True
    assert other.get(f"{API}/{created['id']}").status_code == 200


def test_public_scenario_is_visible_to_everyone(login, make_public_scenario):
    scenario_id = make_public_scenario()
    user = login("a@example.com")

    assert [s["id"] for s in user.get(API).json()] == [scenario_id]
    assert user.get(f"{API}/{scenario_id}").status_code == 200


def test_unknown_scenario_returns_404(login):
    assert login("a@example.com").get(f"{API}/nope").status_code == 404
