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


def test_students_cannot_create_scenarios(login):
    student = login("a@example.com")

    assert student.post(API, json=BODY).status_code == 403
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
