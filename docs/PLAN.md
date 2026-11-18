# Project Management MVP Plan

The MVP runs locally in one Docker container. FastAPI serves the static Next.js app and the API from the same origin. The backend authenticates one demo account, SQLite stores one board per user, and the AI sidebar uses live OpenRouter calls. Windows PowerShell scripts cover start and stop for this MVP. Follow the repository palette and keep the README short.

## Part 1. Plan and document the frontend

- [x] Read the repository instructions and inspect the current frontend, configuration, and tests.
- [x] Expand the ten parts into implementation checklists with verification and success criteria.
- [x] Document the existing frontend in [frontend/AGENTS.md](../frontend/AGENTS.md), including the missing card editor.
- [x] Verify the plan against the MVP requirements and the frontend notes against the source.
- [x] Get the user's approval of this plan before starting Part 2.

**Success criteria.** The plan and frontend notes are ready for review, and the user has approved the plan.

## Part 2. Scaffold FastAPI, Docker, and Windows scripts

- [x] Add a small FastAPI app under `backend/`, manage Python dependencies with `uv`, and document how the backend is organized in `backend/AGENTS.md`.
- [x] Add a Dockerfile and Compose configuration for one app container. Publish the port on localhost and configure a persistent SQLite volume for later phases. Keep the root `.env` out of the image and pass its OpenRouter key to the backend at runtime when needed.
- [x] Serve a temporary hello world page at `/` that calls `GET /api/health` and displays the result.
- [x] Add Windows PowerShell start and stop scripts that locate the Compose project from the script directory, propagate failures, and preserve the data volume when stopping. Document the commands briefly.
- [x] Verify on Windows that the start script builds and starts the container, the page displays the API result, and the stop script stops it. Start it again to check the repeat workflow.

**Success criteria.** A Windows user with Docker can start and stop the local app, and the hello world page demonstrates that static content and API calls work through the same port.

## Part 3. Serve the existing Kanban demo

- [x] Configure Next.js static export and add a frontend build stage that installs from the lockfile and copies the export into the FastAPI image. Check that fonts and assets are available in the export.
- [x] Replace the temporary page with the exported app at `/`. Keep API routes explicit and verify that static serving leaves them reachable.
- [x] Run the frontend unit and component tests for board rendering, column rename, card creation and deletion, and move ordering. Fill any gaps for existing behavior.
- [x] Point a Playwright run at the Docker app and verify that the board and assets load, cards can be added and deleted, columns can be renamed, and cards can be moved within and across columns.

**Success criteria.** The existing interactive demo works from the Docker URL, and health checks, static assets, and browser tests pass against the packaged app.

## Part 4. Add backend sign-in and sign-out

- [x] Add login, session status, and logout endpoints. FastAPI checks the fixed `user` / `password` credentials and creates an expiring server-side session identified by an HttpOnly, SameSite cookie. Logout invalidates the session and clears the cookie. Keep sessions in memory for the single local app process.
- [x] Show the sign-in form at `/` until the backend confirms a session. Show useful feedback for rejected credentials or request failures and return to the form after logout.
- [x] Add backend tests for valid and invalid credentials, missing and expired sessions, and logout invalidation. Add browser tests for initial load, failed login, successful login, refresh, and logout.

**Success criteria.** The board appears only after backend sign-in. A refresh within the session keeps the board visible, and logout takes effect on the server.

## Part 5. Propose the SQLite schema

- [x] Write the [SQLite schema proposal](BOARD_SCHEMA.md). Describe the user key, one board row per user, the board JSON, and a revision used to reject stale writes.
- [x] Base the proposal on the existing ordered columns, ordered card IDs, and card map. Document fixed column IDs and order, unique card IDs and membership, initial board creation, and the persistent database location.
- [x] Review the proposal against the frontend shape and walk through first login, a move, a stale save, and two users with separate boards.
- [x] Get the user's sign-off on the schema before implementing Part 6.

**Success criteria.** The approved schema describes how to create, validate, update, and isolate a single board for each user.

## Part 6. Implement the board API

- [x] Create the SQLite tables when absent and seed a new user's board from the agreed demo data on first access.
- [x] Add authenticated `GET /api/board` and `PUT /api/board` endpoints. Resolve ownership from the session and return the current board and revision on successful reads and writes.
- [x] Validate the board shape and membership before saving. Update the board and revision in a single transaction. Return a conflict for a stale revision.
- [x] Add backend unit and API tests using temporary SQLite databases. Cover fresh database creation, repeated startup, validation, authorized and unauthorized requests, two-user isolation, stale writes, and persistence after reopening the database.

**Success criteria.** A signed-in user can read and update their board, with durable writes and clear errors for invalid or stale updates.

## Part 7. Connect the board UI to the API

- [x] Load the signed-in user's board from FastAPI and save card creation, deletion, drag and drop, and column renames through the API. Add editing for card title and details.
- [x] Keep one save in flight at a time. Use the latest confirmed revision for each save and show failed saves clearly. On conflict, reload the saved board and tell the user that their edit was not saved.
- [x] Verify loading, editing, saving, and failures in frontend tests. Playwright checked that add, edit, delete, moves within and across columns, and renames survive reload. The same snapshot and revision were available after a Docker restart and fresh sign-in.

**Success criteria.** Every supported board action persists, saved changes survive a restart, and the UI reports unsaved changes when the API rejects a write.

## Part 8. Connect to OpenRouter

- [x] Add a backend OpenRouter client for `nvidia/nemotron-3-ultra-550b-a55b:free`. Read the key from `OPENROUTER_API_KEY` at runtime and handle missing configuration, request timeouts, and provider errors.
- [x] Run an explicit live connectivity check through the backend client with `2+2`. The configured model returned `4`.

**Success criteria.** The backend receives a useful reply from the configured model using the real OpenRouter service.

## Part 9. Add board context and structured AI updates

- [x] Add an authenticated chat endpoint. Build each OpenRouter request from the current board JSON read by the backend, the user's message, and prior user and assistant messages. Treat card content and history as data within the model request.
- [x] Ask the model to return a reply and optional create, edit, and move operations through one schema-defined function call. OpenRouter documents function calling for the configured free model and says it lacks `response_format` support. Validate the function arguments in FastAPI and verify this approach live. [OpenRouter model documentation](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b%3Afree)
- [x] Validate all operations against the board before committing the batch in one transaction. Generate new card IDs on the server. Require the board revision to match the one sent to the model so a slow response cannot overwrite intervening edits.
- [x] Reject the entire batch if any operation is invalid or the board changed during the request. Show a clear message that no edits were saved. If the response itself is unusable, show a chat error. A valid reply with zero operations leaves the board revision as it was.
- [x] Test malformed payloads, unknown IDs, all-or-nothing batches, and stale revisions using direct validation and API tests. The live OpenRouter check on a disposable board answered a board question and a follow-up without writing, then created, edited, and moved cards in one verified save.

**Success criteria.** Live chat answers from current board context and history, valid card operations persist together, and invalid or stale operations leave the board intact.

## Part 10. Build the AI chat sidebar

- [x] Add a responsive sidebar using the existing palette. Include message history, a composer, a pending indicator, and readable error and update feedback. Keep history in the current signed-in browser session and clear it on logout.
- [x] Send chats through the authenticated endpoint. Coordinate chat with pending board saves so the backend sees current edits. Refresh the displayed board from the server after a successful AI update.
- [x] Test the sidebar's pending, error, and refresh behavior. Playwright against Docker and live OpenRouter verified a read-only reply, a follow-up using history, and a multi-card edit that refreshed the board and persisted after reload. It also checked sign-out and layout at wide and narrow widths.
- [x] Update the README with the Windows start and stop commands, demo credentials, and the key requirement for AI chat.

**Success criteria.** A signed-in user can use the board and sidebar together, see AI changes appear automatically, and tell when a request failed.
