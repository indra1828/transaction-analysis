from db.db import User
from db.session import SessionLocal

API = "/api/v1"
SCENARIO = {"title": "Shared", "config": {"persona": "Boss"}}


def user_id(email):
    with SessionLocal() as db:
        return db.query(User).filter(User.email == email).one().id


def test_new_users_are_students(login):
    assert login("a@example.com").get(f"{API}/auth/me").json()["role"] == "student"


def test_superadmin_email_is_granted_on_sign_in(login):
    assert login("root@example.com").get(f"{API}/auth/me").json()["role"] == "superadmin"


def test_superadmin_is_removed_when_dropped_from_the_env_list(login, monkeypatch):
    login("root@example.com")
    monkeypatch.setenv("SUPERADMIN_EMAILS", "")

    assert login("root@example.com").get(f"{API}/auth/me").json()["role"] == "student"


def test_teacher_role_survives_sign_in(make_teacher):
    teacher = make_teacher("t@example.com")
    assert teacher.get(f"{API}/auth/me").json()["role"] == "teacher"

    teacher.post(f"{API}/auth/logout")
    again = make_teacher("t@example.com")
    assert again.get(f"{API}/auth/me").json()["role"] == "teacher"


def test_superadmin_promotes_a_user_to_teacher(login):
    root, student = login("root@example.com"), login("a@example.com")
    student_id = user_id("a@example.com")

    response = root.patch(f"{API}/admin/users/{student_id}/role", json={"role": "teacher"})

    assert response.status_code == 200
    assert response.json()["role"] == "teacher"
    assert student.post(f"{API}/scenarios", json=SCENARIO).status_code == 201


def test_superadmin_can_demote_a_teacher(make_teacher, login):
    root = login("root@example.com")
    make_teacher("t@example.com")
    teacher_id = user_id("t@example.com")

    root.patch(f"{API}/admin/users/{teacher_id}/role", json={"role": "student"})

    assert login("t@example.com").post(f"{API}/scenarios", json=SCENARIO).json()["is_shared"] is False


def test_superadmin_role_cannot_be_changed_through_the_api(login):
    root = login("root@example.com")
    root_id = user_id("root@example.com")

    response = root.patch(f"{API}/admin/users/{root_id}/role", json={"role": "student"})

    assert response.status_code == 409


def test_only_student_and_teacher_roles_can_be_assigned(login):
    root = login("root@example.com")
    login("a@example.com")
    student_id = user_id("a@example.com")

    assert root.patch(f"{API}/admin/users/{student_id}/role", json={"role": "superadmin"}).status_code == 422


def test_teachers_and_students_cannot_manage_roles(make_teacher, login):
    teacher, student = make_teacher("t@example.com"), login("a@example.com")
    student_id = user_id("a@example.com")

    assert teacher.get(f"{API}/admin/users").status_code == 403
    assert teacher.patch(f"{API}/admin/users/{student_id}/role", json={"role": "teacher"}).status_code == 403
    assert student.get(f"{API}/admin/users").status_code == 403


def test_superadmin_lists_users(login):
    root = login("root@example.com")
    login("a@example.com")

    emails = {user["email"] for user in root.get(f"{API}/admin/users").json()}

    assert {"root@example.com", "a@example.com"} <= emails


def test_admin_routes_require_login(anon):
    assert anon.get(f"{API}/admin/users").status_code == 401


def test_demoted_teacher_keeps_edit_and_delete_for_their_scenarios(make_teacher, login):
    root, teacher = login("root@example.com"), make_teacher("t@example.com")
    scenario_id = teacher.post(f"{API}/scenarios", json=SCENARIO).json()["id"]
    teacher_id = user_id("t@example.com")

    root.patch(f"{API}/admin/users/{teacher_id}/role", json={"role": "student"})

    assert teacher.get(f"{API}/scenarios/{scenario_id}").json()["editable"] is True
    assert teacher.patch(f"{API}/scenarios/{scenario_id}", json={"title": "Mine"}).status_code == 200
    assert teacher.delete(f"{API}/scenarios/{scenario_id}").status_code == 204


def test_demoted_teacher_loses_teacher_only_features(make_teacher, login):
    root, teacher = login("root@example.com"), make_teacher("t@example.com")
    teacher_id = user_id("t@example.com")

    root.patch(f"{API}/admin/users/{teacher_id}/role", json={"role": "student"})

    created = teacher.post(f"{API}/scenarios", json={**SCENARIO, "is_shared": True}).json()

    assert created["is_shared"] is False
    assert teacher.get(f"{API}/teacher/scenarios").status_code == 403
