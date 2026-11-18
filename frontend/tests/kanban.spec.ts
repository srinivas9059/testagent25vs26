import { expect, test, type Locator, type Page } from "@playwright/test";
import seed from "../src/lib/seed.json";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function resetTestBoard(page: Page) {
  const response = await page.request.get("/api/board");
  expect(response.ok()).toBe(true);
  const { revision } = await response.json();
  const saved = await page.request.put("/api/board", { data: { revision, board: seed } });
  expect(saved.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
}

async function dragCard(page: Page, card: Locator, target: Locator, offsetY?: number) {
  await card.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();
  if (!cardBox || !targetBox) throw new Error("Unable to locate the drag target.");

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + (offsetY ?? targetBox.height / 2),
    { steps: 12 }
  );
  await page.mouse.up();
}

test("signs in after a rejected attempt, keeps the session, and signs out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("column-col-backlog")).toHaveCount(0);
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Incorrect username or password."
  );
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("column-col-backlog")).toHaveCount(0);
});

test.describe("signed-in board", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await resetTestBoard(page);
  });

  test("serves the board, assets, and API", async ({ page, request }) => {
    await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCSS(
      "background-color",
      "rgb(117, 57, 145)"
    );
    const health = await request.get("/api/health");
    expect(health.ok()).toBe(true);
    expect(await health.json()).toEqual({ status: "ok" });
  });

  test("renames a column", async ({ page }) => {
    const backlog = page.getByTestId("column-col-backlog");
    const title = backlog.getByRole("textbox", { name: "Column title" });
    await title.fill("Incoming");
    await title.press("Enter");
    await expect(title).toHaveValue("Incoming");
    await expect(title).toBeEnabled();
    await page.reload();
    await expect(title).toHaveValue("Incoming");
  });

  test("adds, edits and removes a card across reloads", async ({ page }) => {
    const backlog = page.getByTestId("column-col-backlog");
    await backlog.getByRole("button", { name: /add a card/i }).click();
    await backlog.getByPlaceholder("Card title").fill("Playwright card");
    await backlog.getByPlaceholder("Details").fill("Added via e2e.");
    await backlog.getByRole("button", { name: /add card/i }).click();
    await expect(backlog.getByText("Playwright card")).toBeVisible();
    await page.reload();
    await backlog.getByRole("button", { name: "Edit Playwright card", exact: true }).click();
    await backlog.getByLabel("Card title").fill("Edited Playwright card");
    await backlog.getByLabel("Card details").fill("Persisted notes.");
    await backlog.getByRole("button", { name: "Save card", exact: true }).click();
    await expect(backlog.getByText("Persisted notes.")).toBeVisible();
    await page.reload();
    await expect(backlog.getByText("Edited Playwright card")).toBeVisible();
    await expect(backlog.getByText("Persisted notes.")).toBeVisible();
    await backlog.getByRole("button", { name: "Delete Edited Playwright card", exact: true }).click();
    await expect(backlog.getByText("Edited Playwright card")).toHaveCount(0);
    await page.reload();
    await expect(backlog.getByText("Align roadmap themes")).toBeVisible();
    await expect(backlog.getByText("Edited Playwright card")).toHaveCount(0);
  });

  test("moves a card between columns", async ({ page }) => {
    const card = page.getByTestId("card-card-1");
    const review = page.getByTestId("column-col-review");
    await dragCard(page, card, review, 120);
    await expect(review.getByTestId("card-card-1")).toBeVisible();
    await page.reload();
    await expect(review.getByTestId("card-card-1")).toBeVisible();
  });

  test("reorders cards within a column", async ({ page }) => {
    const backlog = page.getByTestId("column-col-backlog");
    await dragCard(page, backlog.getByTestId("card-card-1"), backlog.getByTestId("card-card-2"));
    await expect(backlog.locator('[data-testid^="card-"]').first()).toHaveAttribute(
      "data-testid",
      "card-card-2"
    );
    await page.reload();
    await expect(backlog.locator('[data-testid^="card-"]').first()).toHaveAttribute(
      "data-testid",
      "card-card-2"
    );
  });

  test("loads the latest board after another session saves first", async ({ page }) => {
    const response = await page.request.get("/api/board");
    const latest = await response.json();
    latest.board.columns[0].title = "Other session";
    expect((await page.request.put("/api/board", { data: latest })).ok()).toBe(true);
    const title = page.getByTestId("column-col-backlog").getByRole("textbox", { name: "Column title" });
    await title.fill("Stale edit");
    await title.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Your edit was not saved." })).toBeVisible();
    await expect(title).toHaveValue("Other session");
  });

  test("reports a board save that could not reach the server", async ({ page }) => {
    await page.route("**/api/board", async (route) => {
      if (route.request().method() === "PUT") await route.abort();
      else await route.continue();
    });
    const title = page.getByTestId("column-col-backlog").getByRole("textbox", { name: "Column title" });
    await title.fill("Failed edit");
    await title.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Your edit was not saved." })).toBeVisible();
    await expect(title).toHaveValue("Backlog");
  });

  test("keeps chat and board usable on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "AI chat" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
  });
});

test("live AI uses history and updates the board without a reload", async ({ page }) => {
  test.skip(process.env.RUN_LIVE_AI !== "1", "Enable live OpenRouter checks on the disposable board.");
  test.setTimeout(420_000);
  await signIn(page);
  await resetTestBoard(page);
  const chat = page.getByRole("complementary", { name: "AI chat" });
  const input = chat.getByRole("textbox", { name: "Message" });
  const send = chat.getByRole("button", { name: "Send" });
  const latestReply = chat.getByRole("log").locator("p").filter({ hasText: /^Assistant/ }).last();
  const before = await (await page.request.get("/api/board")).json();

  await input.fill("Which card is in Review? Include reference WREN-309 in your reply. Do not change the board.");
  await send.click();
  await expect(chat.getByText("Assistant is working…")).toBeVisible();
  await expect(latestReply).toContainText("QA micro-interactions", { timeout: 130_000 });
  await input.fill("What reference did I give you? Do not change the board.");
  await send.click();
  await expect(input).toHaveValue("", { timeout: 130_000 });
  await expect(latestReply).toContainText("WREN-309");
  expect(await (await page.request.get("/api/board")).json()).toEqual(before);

  await input.fill("Rename Align roadmap themes to Browser roadmap. Move Gather customer signals to Review. Apply both changes.");
  await send.click();
  await expect(chat.getByText("Board updated.")).toBeVisible({ timeout: 130_000 });
  await expect(page.getByText("Browser roadmap", { exact: true })).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-2")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Browser roadmap", { exact: true })).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-2")).toBeVisible();
  await expect(chat.getByRole("log").getByText(/Rename Align roadmap themes/)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page);
  await expect(chat.getByRole("log").getByText(/Rename Align roadmap themes/)).toHaveCount(0);
});
