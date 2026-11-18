# Kanban Studio

Start Docker Desktop, then run `.\scripts\start.ps1` from the project root in PowerShell. Open http://127.0.0.1:8000.

Sign in with username `user` and password `password`.

Board edits persist in SQLite. To use AI chat, set `OPENROUTER_API_KEY` in the project root `.env` and start the app again. Chat sends the current board and conversation to OpenRouter.

Run `.\scripts\stop.ps1` to stop the app and retain its Docker data volume.
