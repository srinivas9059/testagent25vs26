# Kanban Studio

Start the app using the [project README](../README.md). For frontend development, run `npm ci` and `npm run dev` with FastAPI running on port 8000.

Run `npm run test:unit` for unit tests. For browser tests, start a disposable database from the project root:

```powershell
docker compose -p kanban-studio-mvp-verify run --build -d --rm --name kanban-studio-mvp-verify-app -p 127.0.0.1:8001:8000 app
```

From `frontend/`, run `npx playwright install chromium` once and `npm run test:e2e`. Set `$env:RUN_LIVE_AI = '1'` to also run the live chat test using the key in the root `.env`.

After testing, run `docker stop kanban-studio-mvp-verify-app`, then remove the disposable volume from the project root with `docker compose -p kanban-studio-mvp-verify down --volumes`.
