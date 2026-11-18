# SQLite board schema

Keep one board row per user. Store the board as JSON in the same shape the frontend uses. One row is enough to load the complete board and save a change atomically.

## Tables

```sql
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    username TEXT PRIMARY KEY NOT NULL REFERENCES users(username),
    board_json TEXT NOT NULL CHECK (json_valid(board_json)),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
```

Enable foreign keys on each connection. On startup, create the tables if absent and insert the demo username if needed. The backend still checks the demo credentials. The database stores the username as the owner, and future accounts can each have a separate user row and board.

## Board JSON

```json
{
  "columns": [
    {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
    {"id": "col-discovery", "title": "Discovery", "cardIds": []},
    {"id": "col-progress", "title": "In Progress", "cardIds": []},
    {"id": "col-review", "title": "Review", "cardIds": []},
    {"id": "col-done", "title": "Done", "cardIds": []}
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes and metrics."
    }
  }
}
```

- The five column IDs and their order are fixed. Their titles can change.
- Each column's `cardIds` list determines the order of its cards. Each card occurs in exactly one column, and its map key matches its `id`.
- FastAPI validates these rules on every write. SQLite checks that the stored value is valid JSON.

## Reads and writes

1. On first board access, insert a copy of the current demo board for the signed-in user at revision 0 if no board exists. Use the username from the session. Read the saved row after the insert so simultaneous first requests return the same board.
2. Reads return the board and its revision. For a move, the UI changes the affected `cardIds` lists and sends the resulting board along with the revision it read.
3. Update only the row for the signed-in username and the submitted revision. Write the JSON and increment the revision in the same transaction. If the revision is stale, return HTTP 409 and let the client reload the saved board.
4. AI edits use the same revision check with the revision sent to the model. Validate and apply the whole batch as one write.

Docker sets `BOARD_DB_PATH` to `/data/board.sqlite3` on the named Compose volume. The start and stop scripts reuse that volume, so boards survive a container restart.
