import pytest
from fastapi.testclient import TestClient

from auth import SESSION_COOKIE, SESSION_TTL_SECONDS
from main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "board.sqlite3")) as test_client:
        yield test_client


def login(client, username="user", password="password"):
    return client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )


def test_health_is_public(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_missing_session(client):
    assert client.get("/api/auth/session").status_code == 401


@pytest.mark.parametrize(
    ("username", "password"),
    [("other", "password"), ("user", "wrong")],
)
def test_invalid_credentials(client, username, password):
    response = login(client, username, password)
    assert response.status_code == 401
    assert "Set-Cookie" not in response.headers


def test_login_creates_session(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    cookie = response.headers["Set-Cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert client.get("/api/auth/session").json() == {"username": "user"}


def test_session_expires(client, monkeypatch):
    monkeypatch.setattr("auth.monotonic", lambda: 0)
    login(client)
    monkeypatch.setattr("auth.monotonic", lambda: SESSION_TTL_SECONDS)
    assert client.get("/api/auth/session").status_code == 401


def test_logout_invalidates_session(client):
    login(client)
    token = client.cookies.get(SESSION_COOKIE)
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    assert client.cookies.get(SESSION_COOKIE) is None
    old_session = client.get(
        "/api/auth/session", headers={"Cookie": f"{SESSION_COOKIE}={token}"}
    )
    assert old_session.status_code == 401
