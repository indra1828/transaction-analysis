API = "/api/v1/scenarios"
CONFIG = {"persona": "Boss"}


def create(client, title):
    return client.post(API, json={"title": title, "config": CONFIG})


def test_two_scenarios_cannot_share_a_name(make_teacher):
    teacher = make_teacher("t@example.com")

    assert create(teacher, "Salary talk").status_code == 201
    response = create(teacher, "Salary talk")

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_names_are_compared_ignoring_case_and_extra_spaces(make_teacher):
    teacher = make_teacher("t@example.com")
    create(teacher, "Salary talk")

    assert create(teacher, "  SALARY    talk ").status_code == 409


def test_a_name_is_taken_across_teachers(make_teacher):
    first, second = make_teacher("t1@example.com"), make_teacher("t2@example.com")
    create(first, "Salary talk")

    assert create(second, "Salary talk").status_code == 409


def test_a_name_used_by_a_built_in_scenario_is_taken(make_teacher, make_public_scenario):
    make_public_scenario("Missed Deadline")

    assert create(make_teacher("t@example.com"), "missed deadline").status_code == 409


def test_renaming_to_an_existing_name_is_refused(make_teacher):
    teacher = make_teacher("t@example.com")
    create(teacher, "First")
    second_id = create(teacher, "Second").json()["id"]

    response = teacher.patch(f"{API}/{second_id}", json={"title": "first"})

    assert response.status_code == 409


def test_a_scenario_can_keep_its_own_name(make_teacher):
    teacher = make_teacher("t@example.com")
    scenario_id = create(teacher, "Salary talk").json()["id"]

    assert teacher.patch(f"{API}/{scenario_id}", json={"title": "Salary talk"}).status_code == 200


def test_blank_names_are_rejected(make_teacher):
    teacher = make_teacher("t@example.com")

    assert create(teacher, "").status_code == 422
    assert create(teacher, "    ").status_code == 422


def test_names_are_saved_trimmed_and_single_spaced(make_teacher):
    teacher = make_teacher("t@example.com")

    assert create(teacher, "  Salary    talk  ").json()["title"] == "Salary talk"
