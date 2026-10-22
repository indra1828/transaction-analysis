API = "/api/v1"


def create_scenario(teacher, title):
    return teacher.post(f"{API}/scenarios", json={"title": title, "config": {"persona": "Boss"}}).json()["id"]


def test_scenario_list_is_paginated(make_teacher, login):
    teacher = make_teacher("t@example.com")
    for title in ["A", "B", "C"]:
        create_scenario(teacher, title)
    learner = login("a@example.com")

    assert [s["title"] for s in learner.get(f"{API}/scenarios?limit=2").json()] == ["A", "B"]
    assert [s["title"] for s in learner.get(f"{API}/scenarios?limit=2&offset=2").json()] == ["C"]


def test_thread_list_is_paginated_newest_first(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher, "S")
    learner = login("a@example.com")
    first = api.start(learner, scenario_id).json()["id"]
    second = api.start(learner, scenario_id).json()["id"]

    assert [t["id"] for t in learner.get(f"{API}/threads?limit=1").json()] == [second]
    assert [t["id"] for t in learner.get(f"{API}/threads?limit=1&offset=1").json()] == [first]


def test_thread_response_carries_the_scenario_title(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher, "Salary talk")
    thread = api.start(login("a@example.com"), scenario_id).json()

    assert thread["scenario_title"] == "Salary talk"


def test_submissions_respect_the_page_limit_bounds(make_teacher):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher, "S")

    assert teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations?limit=0").status_code == 422
    assert teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations?limit=51").status_code == 422
