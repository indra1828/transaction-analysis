import pytest

API = "/api/v1"


def test_me_requires_login(anon):
    assert anon.get(f"{API}/auth/me").status_code == 401


def test_login_creates_user_and_me_returns_it(login):
    client = login("a@example.com")
    body = client.get(f"{API}/auth/me").json()
    assert body["email"] == "a@example.com"
    assert body["id"]


def test_login_twice_reuses_same_user(login):
    first = login("a@example.com").get(f"{API}/auth/me").json()
    second = login("a@example.com").get(f"{API}/auth/me").json()
    assert first["id"] == second["id"]


def test_unverified_email_is_rejected(login):
    client = login("a@example.com", verified=False)
    assert client.get(f"{API}/auth/me").status_code == 401


def test_same_email_different_google_account_is_rejected(login):
    login("a@example.com", sub="sub-1")
    other = login("a@example.com", sub="sub-2")
    assert other.get(f"{API}/auth/me").status_code == 401


def test_logout_ends_session(login):
    client = login("a@example.com")
    assert client.post(f"{API}/auth/logout").status_code == 200
    assert client.get(f"{API}/auth/me").status_code == 401


def test_copied_cookie_stops_working_after_logout(login):
    from fastapi.testclient import TestClient

    import main

    client = login("a@example.com")
    cookie = client.cookies.get("ta_coach_session")
    assert client.post(f"{API}/auth/logout").status_code == 200

    # Someone who copied the cookie before logout must be rejected.
    copy = TestClient(main.app)
    copy.cookies.set("ta_coach_session", cookie)
    assert copy.get(f"{API}/auth/me").status_code == 401


def test_expired_session_is_rejected(login):
    from db.db import AuthSession, utc_now
    from db.session import SessionLocal

    client = login("a@example.com")
    assert client.get(f"{API}/auth/me").status_code == 200

    with SessionLocal() as db:
        for row in db.query(AuthSession).all():
            row.expires_at = utc_now().replace(year=2000)
        db.commit()

    assert client.get(f"{API}/auth/me").status_code == 401


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/scenarios"),
        ("get", "/scenarios/x"),
        ("post", "/scenarios"),
        ("get", "/threads"),
        ("post", "/threads"),
        ("get", "/threads/x"),
        ("get", "/threads/x/messages"),
        ("post", "/threads/x/messages"),
    ],
)
def test_protected_routes_require_login(anon, method, path):
    response = getattr(anon, method)(
        f"{API}{path}", **({"json": {}} if method == "post" else {})
    )
    assert response.status_code == 401
