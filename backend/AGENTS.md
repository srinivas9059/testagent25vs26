# Backend

`main.py` creates the FastAPI app, exposes `GET /api/health`, and serves the frontend export. Register API routes before the static mount at `/`. Docker sets `STATIC_DIR` to the bundled export.

`auth.py` handles demo login, session checking, and logout. The local app keeps expiring sessions in memory and identifies them with an HttpOnly cookie. Use `require_user` to resolve the signed-in username for new API routes.

`board.py` validates the board and persists one JSON snapshot per user in SQLite. `main.py` initializes the database at startup using `BOARD_DB_PATH`. The seed is shared with the frontend in `frontend/src/lib/seed.json`.

`openrouter.py` calls OpenRouter using the runtime key. `chat.py` sends board context and conversation history, validates the returned operations, and saves the whole batch against its original board revision.

The backend uses the dependencies locked in `uv.lock`. From this directory, use `uv sync --locked` to install them and `uv run --locked python -m pytest` to run backend tests.
