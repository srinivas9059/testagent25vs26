import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from auth import router as auth_router
from board import BoardStore, router as board_router
from chat import router as chat_router

DEFAULT_STATIC_DIR = Path(__file__).resolve().parents[1] / "frontend" / "out"


def create_app(db_path: Path | None = None) -> FastAPI:
    store = BoardStore(db_path or Path(os.getenv("BOARD_DB_PATH", "board.sqlite3")))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store.initialize()
        yield

    app = FastAPI(lifespan=lifespan)
    app.state.sessions = {}
    app.state.boards = store

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(board_router)
    app.include_router(chat_router)

    static_dir = Path(os.getenv("STATIC_DIR", DEFAULT_STATIC_DIR))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True))

    return app


app = create_app()
