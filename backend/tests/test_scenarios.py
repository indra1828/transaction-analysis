API = "/api/v1/scenarios"
BODY = {"title": "My practice", "config": {"persona": "Boss"}}


def test_created_scenario_is_private_to_creator(login):
    owner, other = login("a@example.com"), login("b@example.com")
    created = owner.post(API, json=BODY)

    assert created.status_code == 201
    assert created.json()["is_public"] is False
    scenario_id = created.json()["id"]

    assert [s["id"] for s in owner.get(API).json()] == [scenario_id]
    assert owner.get(f"{API}/{scenario_id}").status_code == 200
    assert other.get(API).json() == []
    assert other.get(f"{API}/{scenario_id}").status_code == 404


def test_client_cannot_make_scenario_public(login):
    owner, other = login("a@example.com"), login("b@example.com")
    created = owner.post(
        API,
        json={**BODY, "is_public": True, "created_by": "someone-else"},
    ).json()

    assert created["is_public"] is False
    assert other.get(f"{API}/{created['id']}").status_code == 404


def test_public_scenario_is_visible_to_everyone(login, make_public_scenario):
    scenario_id = make_public_scenario()
    user = login("a@example.com")

    assert [s["id"] for s in user.get(API).json()] == [scenario_id]
    assert user.get(f"{API}/{scenario_id}").status_code == 200


def test_unknown_scenario_returns_404(login):
    assert login("a@example.com").get(f"{API}/nope").status_code == 404
