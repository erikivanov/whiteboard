// Authentication tests intentionally use an anonymous default context.
import { test, expect } from "@playwright/test";
import { authenticateContext } from "./auth-support";

test("Startseite bietet GitHub an und schützt Dashboard und Board-Erstellung serverseitig", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dein Raum für Ideen.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mit GitHub anmelden", exact: true })).toHaveAttribute("href", "/api/auth/github");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\?login=required/);
  await expect(page.getByRole("heading", { name: "Dein Raum für Ideen.", exact: true })).toBeVisible();
  expect((await request.get("/api/boards")).status()).toBe(401);
  expect((await request.post("/api/boards", { data: { action: "create", doc: { version: 1, title: "Denied", nodes: [], edges: [] } } })).status()).toBe(401);
});

test("OAuth verwendet State und PKCE und verwirft manipulierte Rückrufe", async ({ request }) => {
  const start = await request.get("/api/auth/github", { maxRedirects: 0 });
  const url = new URL(start.headers().location);
  expect(url.origin).toBe("https://github.com");
  expect(url.pathname).toBe("/login/oauth/authorize");
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toHaveLength(43);
  expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/github\/callback$/);
  expect(start.headers()["set-cookie"]).toContain("HttpOnly");
  const callback = await request.get("/api/auth/github/callback?code=invalid&state=wrong", { maxRedirects: 0 });
  expect(new URL(callback.headers().location).searchParams.get("login")).toBe("invalid_state");
  expect((await (await request.get("/api/auth/session")).json()).user).toBeNull();
});

test("Erlaubte Sitzung öffnet Dashboard; Gastlinks bleiben nutzbar; Abmelden sperrt Besitzeraktionen", async ({ browser, baseURL }) => {
  const owner = await browser.newContext(), guest = await browser.newContext();
  const p = await owner.newPage(), g = await guest.newPage();
  let board: { id: string; token: string; shareToken: string } | undefined;
  try {
    // Controlled application session; real provider verification has separate callback tests.
    await authenticateContext(owner, baseURL);
    await p.goto(`${baseURL}/dashboard`);
    await expect(p.getByRole("heading", { name: "Alle Boards", exact: true })).toBeVisible();
    await expect(p.locator(".dashboard-workspace")).toHaveCount(0);
    await expect(p.locator(".dashboard-profile")).toHaveCount(0);
    const created = await p.request.post(`${baseURL}/api/boards`, { data: { action: "create", doc: { version: 1, title: "Auth integration test", nodes: [], edges: [] } } });
    expect(created.ok()).toBeTruthy(); board = await created.json();
    const record = board!;
    await g.goto(`${baseURL}/board?board=${record.id}#token=${record.shareToken}`);
    await expect(g.getByLabel("Boardname")).toHaveValue("Auth integration test");
    await expect(g.getByLabel("Boardname")).toHaveAttribute("readonly", "");
    expect((await g.request.get(`${baseURL}/api/boards?id=${record.id}`, { headers: { Authorization: `Bearer ${record.token}` } })).status()).toBe(401);
    await p.getByRole("button", { name: "Abmelden", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Dein Raum für Ideen.", exact: true })).toBeVisible();
    expect((await (await p.request.get(`${baseURL}/api/auth/session`)).json()).user).toBeNull();
  } finally {
    if (board) { await authenticateContext(owner, baseURL); await p.request.post(`${baseURL}/api/boards?id=${board.id}`, { headers: { Authorization: `Bearer ${board.token}` }, data: { action: "delete" } }); }
    await owner.close(); await guest.close();
  }
});
