import { test, expect } from "./fixtures";

test("Dashboard erstellt unabhängige Boards und erhält Änderungen beim Zurückkehren", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Alle Boards", exact: true })).toBeVisible();
  const create = async (name: string) => {
    await page.getByRole("button", { name: "Neues Board", exact: true }).last().click();
    await page.getByRole("textbox", { name: "Boardname", exact: true }).fill(name);
    await page.getByRole("button", { name: "Board erstellen", exact: true }).click();
    await expect(page).toHaveURL(/\/board\?board=/);
    await expect(page.getByRole("textbox", { name: "Boardname", exact: true })).toHaveValue(name);
    await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeEnabled();
  };
  await create("Projekt Alpha");
  await page.getByRole("button", { name: "Erste Notiz anlegen" }).click();
  await page.mouse.click(400, 350);
  await page.getByLabel("Objekttext bearbeiten").fill("Nur in Alpha");
  // Return while the editor is still focused, before the next sync interval.
  await page.getByRole("link", { name: "Zur Boardübersicht" }).click();
  await expect(page.getByRole("link", { name: "Board öffnen: Projekt Alpha", exact: true })).toBeVisible();
  await create("Projekt Beta");
  await expect(page.getByTestId("board-node")).toHaveCount(0);
  await page.getByRole("link", { name: "Zur Boardübersicht" }).click();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(2);
  await page.getByRole("link", { name: "Board öffnen: Projekt Alpha", exact: true }).click();
  await expect(page.getByTestId("board-node")).toHaveText("Nur in Alpha");
  await page.getByLabel("Boardname").fill("Alpha umbenannt");
  await page.getByRole("link", { name: "Zur Boardübersicht" }).click();
  await expect(page.getByRole("link", { name: "Board öffnen: Alpha umbenannt", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alpha umbenannt als Favorit markieren" }).click();
  await page.getByRole("button", { name: /^Favoriten/ }).click();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(1);
  await page.getByRole("button", { name: "Listenansicht" }).click();
  await expect(page.locator(".dashboard-list")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Alpha umbenannt aus Favoriten entfernen" })).toBeVisible();
  await page.getByLabel("Boards suchen").fill("Beta");
  await expect(page.getByTestId("dashboard-board")).toHaveCount(1);
  await page.getByLabel("Boards suchen").fill("Nicht vorhanden");
  await expect(page.getByRole("heading", { name: "Kein Board gefunden" })).toBeVisible();
});

test("Bestehendes lokales Board wird ohne Datenverlust übernommen", async ({ page }) => {
  const doc = { version: 1, title: "Mein bisheriges Board", nodes: [{ id: "old", kind: "note", x: 300, y: 300, w: 100, h: 100, text: "Bestehende Ideen", fill: "#fff0a6" }], edges: [] };
  await page.goto("/");
  await page.evaluate(d => localStorage.setItem("whiteboard.document.v1", JSON.stringify(d)), doc);
  await page.reload();
  await page.getByRole("link", { name: "Board öffnen: Mein bisheriges Board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByTestId("board-node")).toHaveText("Bestehende Ideen");
  await page.getByRole("link", { name: "Zur Boardübersicht" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("whiteboard.document.v1")!))).toEqual(doc);
});

test("Fehlgeschlagene Erstellung bleibt im Dialog und lässt sich wiederholen", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/boards", route => route.fulfill({ status: 503, json: { error: "Server ist nicht erreichbar" } }));
  await page.getByRole("button", { name: "Neues Board", exact: true }).last().click();
  await page.getByRole("button", { name: "Board erstellen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Server ist nicht erreichbar");
  await expect(page.getByRole("button", { name: "Board erstellen", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Alle Boards", exact: true })).toBeVisible();
});
