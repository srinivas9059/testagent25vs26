# Frontend

This is the Kanban Studio demo. It uses the Next.js App Router, React, TypeScript, Tailwind CSS, and dnd-kit. The `@/` import alias points to `src/`.

## App structure

- `src/app/page.tsx` renders `Workspace` at `/`. `Workspace` checks the FastAPI session and renders either the sign-in form or `KanbanBoard` with a sign-out control. `src/app/layout.tsx` sets metadata and loads Space Grotesk and Manrope. `src/app/globals.css` defines the theme and global styles.
- `BoardWorkspace` loads the saved snapshot, coordinates board writes and chat requests, and refreshes the snapshot after AI edits. `KanbanBoard` passes action handlers down to columns and manages pointer drag and drop with dnd-kit.
- `KanbanColumn` renders a droppable column with an editable title and a `NewCardForm`. `KanbanCard` renders a sortable card with a delete control. `KanbanCardPreview` renders the drag overlay.
- `src/lib/kanban.ts` defines the board types, `moveCard`, and card ID generation. `seed.json` supplies the five fixed columns and starter cards to FastAPI and the test fixtures. Column `cardIds` control card order.
- `ChatSidebar` displays the conversation and keeps its latest messages in the current tab's session storage. `Workspace` clears them when the session ends.

Column renames save on Enter or when the input loses focus. Card creation, editing, deletion, and moves save through FastAPI.

## Development and tests

Run commands from `frontend/`.

- `npm ci` installs dependencies. `npm run dev` starts the development server and forwards API calls to FastAPI on port 8000. `npm run build` writes the static export to `out/` and `npm run lint` runs ESLint.
- `npm run test:unit` runs Vitest with jsdom and Testing Library. Existing tests cover card movement and board rendering, renaming, creation, and deletion.
- `npx playwright install chromium` installs the browser for `npm run test:e2e`. The suite resets the board as part of its setup. Use the disposable Docker project in [README.md](README.md).
