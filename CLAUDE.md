# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Kanban Studio: a single-user-per-board project management app. A Next.js frontend is exported statically and served by FastAPI from the same origin, in one Docker container, with SQLite persistence and an OpenRouter-powered chat sidebar that can create, edit, and move cards. Read [AGENTS.md](AGENTS.md) (requirements, color palette, coding standards: keep it simple, no emojis, find root cause before fixing) and [docs/PLAN.md](docs/PLAN.md) first. Each of `backend/`, `frontend/`, and `scripts/` also has its own `AGENTS.md`.

## Commands

Windows PowerShell is the supported platform.

- Run the app: `.\scripts\start.ps1` (docker compose build, up, wait for health) serves http://127.0.0.1:8000. `.\scripts\stop.ps1` stops it and keeps the data volume. Login is hardcoded `user` / `password`.
- Backend (from `backend/`): `uv sync --locked`, then `uv run --locked python -m pytest`. Single test: `uv run --locked python -m pytest tests/test_board.py::test_name`.
- Frontend (from `frontend/`): `npm ci`, `npm run dev` (needs FastAPI on port 8000), `npm run build` (static export to `out/`), `npm run lint`, `npm run test:unit` (Vitest). Single test: `npx vitest run src/lib/kanban.test.ts -t "name"`.
- E2E (Playwright, from `frontend/`): runs against a disposable Docker instance on port 8001, set up as described in [frontend/README.md](frontend/README.md). `npm run test:e2e`; set `$env:RUN_LIVE_AI = '1'` to include the live OpenRouter test.

## Architecture

- One Dockerfile, two stages: Node builds the Next.js static export, which is copied into the Python image at `/app/static`. FastAPI (`backend/main.py`) registers `/api/*` routes first and mounts the static export at `/` last, so API routes must be registered before the mount. `STATIC_DIR` and `BOARD_DB_PATH` env vars configure the paths; compose maps the DB to a named volume at `/data`.
- Auth (`backend/auth.py`): fixed demo credentials, in-memory expiring sessions keyed by an HttpOnly cookie. New API routes get the username via the `require_user` dependency.
- Board storage (`backend/board.py`): one JSON snapshot per user in SQLite with an integer revision. Writes (`PUT /api/board`) validate board shape and membership, and reject stale revisions with a conflict. Schema rationale is in [docs/BOARD_SCHEMA.md](docs/BOARD_SCHEMA.md).
- The seed board lives in `frontend/src/lib/seed.json` and is shared by the frontend tests and the backend (the Dockerfile copies it into the image). The five columns are fixed; only titles are editable.
- AI chat (`backend/chat.py`, `backend/openrouter.py`): the backend reads the current board itself, sends it plus history to OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`, key from `OPENROUTER_API_KEY` in the root `.env`) and requires one function call containing a reply and optional create/edit/move operations. The model has no `response_format` support, hence function calling. Operations are validated and applied as one all-or-nothing transaction, only if the board revision still matches the one sent to the model.
- Frontend: `Workspace` handles session state (sign-in form vs board), `BoardWorkspace` owns loading, one-save-in-flight serialization with the latest confirmed revision, conflict reload, and coordination with chat, and `KanbanBoard` handles dnd-kit drag and drop. API calls are in `src/lib/api.ts`; board types and `moveCard` in `src/lib/kanban.ts`. Chat history lives in sessionStorage and is cleared on logout.
