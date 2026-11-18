import json

import pytest
from fastapi import HTTPException

from board import BoardStore, Snapshot, StaleBoard
from chat import apply_operations, parse_reply


@pytest.fixture
def store(tmp_path):
    store = BoardStore(tmp_path / "board.sqlite3")
    store.initialize()
    return store


def provider_reply(operations):
    return {"tool_calls": [{"function": {
        "name": "board_reply",
        "arguments": json.dumps({"reply": "Reply", "operations": operations}),
    }}]}


@pytest.mark.parametrize("message", [
    {"content": "Done"},
    {"tool_calls": [{"function": {"name": "board_reply", "arguments": "{"}}]},
    provider_reply([{"action": "delete", "cardId": "card-1"}]),
    provider_reply([{"action": "edit", "cardId": "card-1", "title": ""}]),
])
def test_malformed_reply_is_rejected(message):
    with pytest.raises(HTTPException, match="unusable"):
        parse_reply(message)


def test_valid_batch_creates_edits_and_moves(store):
    before = store.read("user")
    reply = parse_reply(provider_reply([
        {"action": "create", "columnId": "col-review", "title": "Mockup", "details": ""},
        {"action": "edit", "cardId": "card-1", "details": "Updated"},
        {"action": "move", "cardId": "card-2", "columnId": "col-done"},
    ]))
    updated = apply_operations(before.board, reply)
    created, = set(updated.cards) - set(before.board.cards)
    assert updated.cards[created].title == "Mockup"
    assert created in updated.columns[3].cardIds
    assert updated.cards["card-1"].details == "Updated"
    assert updated.columns[4].cardIds[-1] == "card-2"
    assert "card-2" not in updated.columns[0].cardIds
    assert store.save("user", Snapshot(board=updated, revision=before.revision)).revision == 1


@pytest.mark.parametrize("bad_move", [
    {"action": "move", "cardId": "missing", "columnId": "col-done"},
    {"action": "move", "cardId": "card-2", "columnId": "missing"},
])
def test_invalid_operation_leaves_entire_batch_unapplied(store, bad_move):
    before = store.read("user")
    reply = parse_reply(provider_reply([
        {"action": "edit", "cardId": "card-1", "title": "Must not persist"},
        bad_move,
    ]))
    with pytest.raises((KeyError, ValueError)):
        apply_operations(before.board, reply)
    assert before.board.cards["card-1"].title == "Align roadmap themes"
    assert store.read("user") == before


def test_chat_snapshot_cannot_overwrite_a_later_save(store):
    before = store.read("user")
    reply = parse_reply(provider_reply([{"action": "edit", "cardId": "card-1", "title": "AI title"}]))
    ai_board = apply_operations(before.board, reply)
    user_board = before.board.model_copy(deep=True)
    user_board.cards["card-1"].title = "User title"
    store.save("user", Snapshot(board=user_board, revision=before.revision))
    with pytest.raises(StaleBoard):
        store.save("user", Snapshot(board=ai_board, revision=before.revision))
    assert store.read("user").board.cards["card-1"].title == "User title"
