from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from auth import DEMO_USERNAME, require_user

SEED_FILE = Path(__file__).resolve().parents[1] / "frontend" / "src" / "lib" / "seed.json"
COLUMN_IDS = ("col-backlog", "col-discovery", "col-progress", "col-review", "col-done")
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class BoardModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Card(BoardModel):
    id: str
    title: Title
    details: str


class Column(BoardModel):
    id: str
    title: Title
    cardIds: list[str]


class Board(BoardModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_membership(self):
        if tuple(column.id for column in self.columns) != COLUMN_IDS:
            raise ValueError("The five column IDs and their order are fixed.")
        if any(key != card.id for key, card in self.cards.items()):
            raise ValueError("Card keys must match their IDs.")
        ids = [card_id for column in self.columns for card_id in column.cardIds]
        if len(set(ids)) != len(ids) or set(ids) != self.cards.keys():
            raise ValueError("Each card must appear exactly once on the board.")
        return self


class Snapshot(BoardModel):
    board: Board
    revision: Annotated[int, Field(strict=True, ge=0, le=2**63 - 1)]


class StaleBoard(Exception):
    pass


class BoardStore:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connection(self):
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("PRAGMA foreign_keys = ON")
            yield db

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.seed = Board.model_validate_json(SEED_FILE.read_text(encoding="utf-8"))
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY NOT NULL
                );
                CREATE TABLE IF NOT EXISTS boards (
                    username TEXT PRIMARY KEY NOT NULL REFERENCES users(username),
                    board_json TEXT NOT NULL CHECK (json_valid(board_json)),
                    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
                );
                """)
            db.execute("INSERT INTO users VALUES (?) ON CONFLICT DO NOTHING", (DEMO_USERNAME,))

    def read(self, username: str) -> Snapshot:
        with self.connection() as db:
            query = "SELECT board_json, revision FROM boards WHERE username = ?"
            row = db.execute(query, (username,)).fetchone()
            if row is None:
                db.execute(
                    "INSERT INTO boards (username, board_json) VALUES (?, ?) ON CONFLICT DO NOTHING",
                    (username, self.seed.model_dump_json()),
                )
                row = db.execute(query, (username,)).fetchone()
        return Snapshot(board=Board.model_validate_json(row[0]), revision=row[1])

    def save(self, username: str, snapshot: Snapshot) -> Snapshot:
        with self.connection() as db:
            row = db.execute(
                """
                UPDATE boards SET board_json = ?, revision = revision + 1
                WHERE username = ? AND revision = ?
                RETURNING revision
                """,
                (snapshot.board.model_dump_json(), username, snapshot.revision),
            ).fetchone()
            if row is None:
                raise StaleBoard
        return Snapshot(board=snapshot.board, revision=row[0])


router = APIRouter(prefix="/api")
SignedInUser = Annotated[str, Depends(require_user)]


@router.get("/board")
def get_board(request: Request, response: Response, username: SignedInUser) -> Snapshot:
    response.headers["Cache-Control"] = "no-store"
    return request.app.state.boards.read(username)


@router.put("/board")
def put_board(snapshot: Snapshot, request: Request, username: SignedInUser) -> Snapshot:
    store = request.app.state.boards
    store.read(username)
    try:
        return store.save(username, snapshot)
    except StaleBoard:
        raise HTTPException(409, "The board changed before this edit could be saved.") from None
