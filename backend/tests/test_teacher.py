API = "/api/v1"
SCENARIO = {"title": "Missed deadline", "config": {"persona": "Arjun"}}


def create_scenario(teacher, **extra):
    response = teacher.post(f"{API}/scenarios", json={**SCENARIO, **extra})
    assert response.status_code == 201
    return response.json()["id"]


def conversation(learner, api, scenario_id, submit=True, text="Can we talk about the report?"):
    thread_id = api.start(learner, scenario_id).json()["id"]
    assert api.send(learner, thread_id, text).status_code == 200

    if submit:
        assert learner.post(f"{API}/threads/{thread_id}/complete").status_code == 200

    return thread_id


def submissions(teacher, scenario_id, **params):
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations?{query}").json()["items"]


def test_scenario_card_has_only_the_title(make_teacher):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)

    [card] = teacher.get(f"{API}/teacher/scenarios").json()

    assert card == {"id": scenario_id, "title": "Missed deadline", "is_shared": True}


def test_submissions_report_the_total_across_pages(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    conversation(login("a@example.com"), api, scenario_id)
    conversation(login("b@example.com"), api, scenario_id)
    conversation(login("c@example.com"), api, scenario_id, submit=False)

    page = teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations?limit=1").json()

    assert page["total"] == 2
    assert len(page["items"]) == 1


def test_search_total_counts_only_matches(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    conversation(login("priya@example.com"), api, scenario_id)
    conversation(login("arjun@example.com"), api, scenario_id)

    page = teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations?q=priya").json()

    assert page["total"] == 1


def test_submissions_list_only_submitted_conversations(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    submitted = conversation(login("a@example.com"), api, scenario_id)
    conversation(login("b@example.com"), api, scenario_id, submit=False)

    rows = submissions(teacher, scenario_id)

    assert [row["id"] for row in rows] == [submitted]
    assert rows[0]["learner_email"] == "a@example.com"
    assert rows[0]["status"] == "completed"


def test_unsubmitted_conversation_cannot_be_opened(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    thread_id = conversation(login("a@example.com"), api, scenario_id, submit=False)

    assert teacher.get(f"{API}/teacher/conversations/{thread_id}").status_code == 404


def test_teacher_reads_a_submitted_conversation_with_its_report(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    thread_id = conversation(login("a@example.com"), api, scenario_id)

    detail = teacher.get(f"{API}/teacher/conversations/{thread_id}").json()

    assert detail["learner_email"] == "a@example.com"
    assert detail["scenario_id"] == scenario_id
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert detail["report"]["summary"]


def test_search_matches_learner_email_case_insensitively(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    conversation(login("priya@example.com"), api, scenario_id)
    conversation(login("arjun@example.com"), api, scenario_id)

    rows = submissions(teacher, scenario_id, q="PRIYA")

    assert [row["learner_email"] for row in rows] == ["priya@example.com"]


def test_search_treats_wildcards_as_plain_text(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    conversation(login("a@example.com"), api, scenario_id)

    assert submissions(teacher, scenario_id, q="%") == []


def test_sort_by_time(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    older = conversation(login("a@example.com"), api, scenario_id)
    newer = conversation(login("b@example.com"), api, scenario_id)

    assert [row["id"] for row in submissions(teacher, scenario_id, sort="newest")] == [newer, older]
    assert [row["id"] for row in submissions(teacher, scenario_id, sort="oldest")] == [older, newer]


def test_submissions_are_paginated(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    first = conversation(login("a@example.com"), api, scenario_id)
    second = conversation(login("b@example.com"), api, scenario_id)

    assert [row["id"] for row in submissions(teacher, scenario_id, sort="oldest", limit=1)] == [first]
    assert [row["id"] for row in submissions(teacher, scenario_id, sort="oldest", limit=1, offset=1)] == [second]


def test_scenario_cards_are_paginated(make_teacher):
    teacher = make_teacher("t@example.com")
    create_scenario(teacher, title="A")
    create_scenario(teacher, title="B")

    assert [s["title"] for s in teacher.get(f"{API}/teacher/scenarios?limit=1").json()] == ["A"]
    assert [s["title"] for s in teacher.get(f"{API}/teacher/scenarios?limit=1&offset=1").json()] == ["B"]


def test_only_the_creator_sees_a_scenarios_submissions(make_teacher, login, api):
    creator = make_teacher("t@example.com")
    other_teacher = make_teacher("other@example.com")
    superadmin = login("root@example.com")
    scenario_id = create_scenario(creator)
    thread_id = conversation(login("a@example.com"), api, scenario_id)

    for viewer in (other_teacher, superadmin):
        assert viewer.get(f"{API}/teacher/scenarios/{scenario_id}/conversations").status_code == 404
        assert viewer.get(f"{API}/teacher/conversations/{thread_id}").status_code == 404
        assert all(s["id"] != scenario_id for s in viewer.get(f"{API}/teacher/scenarios").json())


def test_private_scenario_is_closed_to_learners(make_teacher, login, api):
    teacher, learner = make_teacher("t@example.com"), login("a@example.com")
    scenario_id = create_scenario(teacher, is_shared=False)

    assert api.start(learner, scenario_id).status_code == 404

    own = conversation(teacher, api, scenario_id)
    assert [row["id"] for row in submissions(teacher, scenario_id)] == [own]


def test_built_in_scenarios_have_no_teacher_view(make_teacher, make_public_scenario, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = make_public_scenario()
    thread_id = conversation(login("a@example.com"), api, scenario_id)

    assert teacher.get(f"{API}/teacher/scenarios/{scenario_id}/conversations").status_code == 404
    assert teacher.get(f"{API}/teacher/conversations/{thread_id}").status_code == 404


def test_learners_cannot_use_teacher_routes(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    learner = login("a@example.com")
    scenario_id = create_scenario(teacher)
    thread_id = conversation(learner, api, scenario_id)

    assert learner.get(f"{API}/teacher/scenarios").status_code == 403
    assert learner.get(f"{API}/teacher/scenarios/{scenario_id}/conversations").status_code == 403
    assert learner.get(f"{API}/teacher/conversations/{thread_id}").status_code == 403


def test_learner_still_sees_only_their_own_conversation(make_teacher, login, api):
    teacher = make_teacher("t@example.com")
    scenario_id = create_scenario(teacher)
    thread_id = conversation(login("a@example.com"), api, scenario_id)

    assert login("b@example.com").get(f"{API}/threads/{thread_id}").status_code == 404
