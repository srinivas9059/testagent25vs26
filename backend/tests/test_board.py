from copy import deepcopy
from time import monotonic

import pytest
from fastapi.testclient import TestClient

from auth import SESSION_COOKIE, Session
from main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "data" / "board.sqlite3")) as client:
        yield client


def sign_in(client):
    assert client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    ).status_code == 200


def test_board_and_chat_require_session(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"revision": 0}).status_code == 401
    assert client.post("/api/chat", json={"message": "What's in Review?"}).status_code == 401


def test_first_read_seeds_board_and_save_checks_revision(client):
    sign_in(client)
    state = client.get("/api/board").json()
    assert state["revision"] == 0
    assert len(state["board"]["columns"]) == 5
    assert len(state["board"]["cards"]) == 8
    state["board"]["columns"][0]["title"] = "Incoming"
    saved = client.put("/api/board", json=state)
    assert saved.status_code == 200
    assert saved.json() == {**state, "revision": 1}
    assert client.put("/api/board", json=state).status_code == 409
    assert client.get("/api/board").json() == saved.json()


def test_concurrent_saves_use_one_revision(client):
    from concurrent.futures import ThreadPoolExecutor

    sign_in(client)
    first = client.get("/api/board").json()
    second = deepcopy(first)
    first["board"]["columns"][0]["title"] = "First"
    second["board"]["columns"][0]["title"] = "Second"
    with ThreadPoolExecutor(max_workers=2) as pool:
        writes = list(pool.map(lambda payload: client.put("/api/board", json=payload), [first, second]))
    assert sorted(response.status_code for response in writes) == [200, 409]
    assert client.get("/api/board").json() == next(response.json() for response in writes if response.is_success)


@pytest.mark.parametrize("defect", ["order", "duplicate", "missing", "orphan", "id", "empty-title"])
def test_invalid_board_leaves_saved_state_intact(client, defect):
    sign_in(client)
    initial = client.get("/api/board").json()
    payload = deepcopy(initial)
    columns = payload["board"]["columns"]
    cards = payload["board"]["cards"]
    if defect == "order":
        columns.reverse()
    elif defect == "duplicate":
        columns[0]["cardIds"].append("card-1")
    elif defect == "missing":
        del cards["card-1"]
    elif defect == "orphan":
        columns[0]["cardIds"].remove("card-1")
    elif defect == "id":
        cards["card-1"]["id"] = "wrong"
    else:
        cards["card-1"]["title"] = " "
    assert client.put("/api/board", json=payload).status_code == 422
    assert client.get("/api/board").json() == initial


def test_users_have_separate_boards(client):
    sign_in(client)
    state = client.get("/api/board").json()
    state["board"]["columns"][0]["title"] = "User only"
    assert client.put("/api/board", json=state).status_code == 200
    with client.app.state.boards.connection() as db:
        db.execute("INSERT INTO users VALUES ('second')")
    client.app.state.sessions["second-token"] = Session("second", monotonic() + 60)
    second = client.get("/api/board", headers={"Cookie": f"{SESSION_COOKIE}=second-token"}).json()
    assert second["revision"] == 0
    assert second["board"]["columns"][0]["title"] == "Backlog"
    assert client.get("/api/board").json()["board"]["columns"][0]["title"] == "User only"


def test_board_survives_app_restart(tmp_path):
    path = tmp_path / "board.sqlite3"
    assert not path.exists()
    with TestClient(create_app(path)) as client:
        assert path.exists()
        sign_in(client)
        first = client.get("/api/board").json()
        first["board"]["cards"]["card-1"]["details"] = "Saved before restart"
        updated = client.put("/api/board", json=first).json()
    with TestClient(create_app(path)) as client:
        sign_in(client)
        assert client.get("/api/board").json() == updated
