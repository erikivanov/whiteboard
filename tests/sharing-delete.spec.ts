import { authenticateContext } from "./auth-support";
import { test, expect } from "./fixtures";

test("Gastberechtigung gilt serverseitig für denselben Link und bereits geöffnete Gäste", async ({ browser, request, baseURL }) => {
  const created = await request.post("/api/boards", { data: { action: "create", doc: {
    version: 1, title: "Gastberechtigung", nodes: [{ id: "n", kind: "note", x: 300, y: 300, w: 120, h: 120, text: "Eine Idee", fill: "#fff0a6" }], edges: [],
  } } });
  const s = await created.json();
  const owner = await browser.newContext(), guest = await browser.newContext();
  await authenticateContext(owner,baseURL);
  const a = await owner.newPage(), b = await guest.newPage();
  const url = (token: string) => `${baseURL}/board?board=${s.id}#token=${token}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  try {
    await a.goto(url(s.token));
    await expect(a.getByRole("button", { name: "Teilen", exact: true })).toBeEnabled();
    await expect(a.getByRole("button", { name: "Hand", exact: true })).toHaveCount(0);
    await expect(a.locator(".bottom-hint")).toHaveCount(0);
    await a.getByRole("button", { name: "Teilen", exact: true }).click();
    await expect(a.getByLabel("Jeder mit diesem Link")).toBeEnabled();
    const link = await a.getByLabel("Freigabelink").inputValue();
    expect(new URLSearchParams(new URL(link).hash.slice(1)).get("token")).not.toBe(s.token);
    await b.goto(link);
    await expect(b.getByTestId("board-node")).toHaveCount(1);
    await expect(b.getByLabel("Boardname")).toHaveAttribute("readonly", "");
    await expect(b.getByRole("button", { name: "Notiz", exact: true })).toBeDisabled();
    await expect(b.getByRole("button", { name: "Teilen", exact: true })).toBeDisabled();
    await a.getByLabel("Jeder mit diesem Link").selectOption("edit");
    await expect(b.getByLabel("Boardname")).not.toHaveAttribute("readonly");
    await b.getByLabel("Boardname").fill("Vom Gast geändert");
    await expect(a.getByLabel("Boardname")).toHaveValue("Vom Gast geändert");
    await expect(a.getByLabel("Freigabelink")).toHaveValue(link);
    for (const action of ["sharing", "delete"]) {
      const response = await request.post(`/api/boards?id=${s.id}`, { headers: auth(s.shareToken), data: { action, role: "edit" } });
      expect(response.status()).toBe(403);
    }
    await b.getByTestId("board-node").dblclick();
    await expect(b.getByLabel("Objekttext bearbeiten")).toBeVisible();
    await a.getByLabel("Jeder mit diesem Link").selectOption("view");
    await expect(b.getByLabel("Boardname")).toHaveAttribute("readonly", "");
    await expect(b.getByLabel("Objekttext bearbeiten")).toHaveCount(0);
    const denied = await request.post(`/api/boards?id=${s.id}`, { headers: auth(s.shareToken), data: { patch: { title: "Verboten", nodes: [], edges: [], deletedNodes: [], deletedEdges: [] } } });
    expect(denied.status()).toBe(403);
    await expect(a.getByLabel("Boardname")).not.toHaveAttribute("readonly");
    await a.getByRole("button", { name: "Freigabe schließen" }).click();
    await a.getByRole("button", { name: "Teilen", exact: true }).click();
    await expect(a.getByLabel("Jeder mit diesem Link")).toHaveValue("view");
  } finally {
    await request.post(`/api/boards?id=${s.id}`, { headers: auth(s.token), data: { action: "delete" } });
    await owner.close(); await guest.close();
  }
});

test("Dashboard löscht erst nach Bestätigung und entfernt Dokument und Freigabe", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Neues Board", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Boardname", exact: true }).fill("Zum Löschen");
  await page.getByRole("button", { name: "Board erstellen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeEnabled();
  const url = new URL(page.url()), id = url.searchParams.get("board"), token = new URLSearchParams(url.hash.slice(1)).get("token");
  await page.getByRole("link", { name: "Zur Boardübersicht" }).click();
  await page.getByRole("button", { name: "Zum Löschen löschen", exact: true }).click();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(1);
  await page.getByRole("button", { name: "Zum Löschen löschen", exact: true }).click();
  await page.getByRole("button", { name: "Board löschen", exact: true }).click();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(0);
  expect((await request.get(`/api/boards?id=${id}`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Alle Boards", exact: true })).toBeVisible();
  await expect(page.getByTestId("dashboard-board")).toHaveCount(0);
});
