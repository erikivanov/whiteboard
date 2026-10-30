async (hostPage) => {
  const context = await hostPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage();
  const errors = [], passed = [];
  p.on("pageerror", e => errors.push(e.message));
  const wait = async (fn, label) => {
    for (let i = 0; i < 80; i++) {
      if (await fn()) return;
      await new Promise(r => setTimeout(r, 100));
    }
    throw Error(label);
  };
  try {
    await p.goto("http://localhost:3001/");
    await p.getByRole("heading", { name: "Alle Boards", exact: true }).waitFor();
    const create = async name => {
      await p.getByRole("button", { name: "Neues Board", exact: true }).last().click();
      await p.getByRole("textbox", { name: "Boardname", exact: true }).fill(name);
      await p.getByRole("button", { name: "Board erstellen", exact: true }).click();
      await wait(async () => new URL(p.url()).pathname === "/board", "Board navigation");
      await wait(async () => await p.getByLabel("Boardname").inputValue() === name && await p.getByRole("button", { name: "Teilen", exact: true }).isEnabled(), "Board ready");
    };
    await create("Projekt Alpha");
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(400, 350);
    await p.getByLabel("Objekttext bearbeiten").fill("Nur in Alpha");
    await p.getByRole("link", { name: "Zur Boardübersicht" }).click();
    await p.getByRole("link", { name: "Board öffnen: Projekt Alpha", exact: true }).waitFor();
    await create("Projekt Beta");
    if (await p.getByTestId("board-node").count() !== 0) throw Error("Boards not independent");
    await p.getByRole("link", { name: "Zur Boardübersicht" }).click();
    await wait(async () => await p.getByTestId("dashboard-board").count() === 2, "Two boards");
    await p.getByRole("link", { name: "Board öffnen: Projekt Alpha", exact: true }).click();
    await wait(async () => await p.getByTestId("board-node").count() === 1 && await p.getByTestId("board-node").textContent() === "Nur in Alpha", "Note preserved");
    passed.push("Independent new boards", "Note saved on immediate return", "Reopen board");
    await p.getByLabel("Boardname").fill("Alpha umbenannt");
    await p.getByRole("link", { name: "Zur Boardübersicht" }).click();
    await p.getByRole("link", { name: "Board öffnen: Alpha umbenannt", exact: true }).waitFor();
    passed.push("Renamed title in dashboard");
    await p.getByRole("button", { name: "Alpha umbenannt als Favorit markieren" }).click();
    await p.getByRole("button", { name: /^Favoriten/ }).click();
    if (await p.getByTestId("dashboard-board").count() !== 1) throw Error("Favorites filter");
    await p.getByRole("button", { name: "Listenansicht" }).click();
    await p.locator(".dashboard-list").waitFor();
    await p.reload();
    await wait(async () => await p.getByTestId("dashboard-board").count() === 2, "Reload library");
    await p.getByRole("button", { name: "Alpha umbenannt aus Favoriten entfernen" }).waitFor();
    passed.push("Favorite persisted", "List view", "Dashboard reload");
    await p.getByLabel("Boards suchen").fill("Beta");
    await wait(async () => await p.getByTestId("dashboard-board").count() === 1, "Search");
    await p.getByLabel("Boards suchen").fill("Nicht vorhanden");
    await p.getByRole("heading", { name: "Kein Board gefunden" }).waitFor();
    passed.push("Search", "Empty search state");
    await p.getByLabel("Suche löschen").click();
    const legacy = { version: 1, title: "Bisheriges lokales Board", nodes: [{ id: "old", kind: "note", x: 300, y: 300, w: 100, h: 100, text: "Bestehende Ideen", fill: "#fff0a6" }], edges: [] };
    await p.evaluate(d => localStorage.setItem("whiteboard.document.v1", JSON.stringify(d)), legacy);
    await p.reload();
    await p.getByRole("link", { name: "Board öffnen: Bisheriges lokales Board" }).click();
    await wait(async () => await p.getByTestId("board-node").count() === 1 && await p.getByTestId("board-node").textContent() === "Bestehende Ideen", "Legacy migration");
    await p.getByRole("link", { name: "Zur Boardübersicht" }).click();
    if (await p.evaluate(() => JSON.parse(localStorage.getItem("whiteboard.document.v1")).nodes[0].text) !== "Bestehende Ideen") throw Error("Legacy overwritten");
    passed.push("Legacy migration without data loss");
    await p.route("**/api/boards", route => route.fulfill({ status: 503, json: { error: "Server ist nicht erreichbar" } }));
    await p.getByRole("button", { name: "Neues Board", exact: true }).last().click();
    await p.getByRole("button", { name: "Board erstellen", exact: true }).click();
    await p.getByRole("alert").filter({ hasText: "Server ist nicht erreichbar" }).waitFor();
    if (!await p.getByRole("button", { name: "Board erstellen", exact: true }).isEnabled()) throw Error("Retry disabled");
    await p.keyboard.press("Escape");
    await wait(async () => !await p.getByRole("dialog").isVisible(), "Close dialog");
    passed.push("Failed create can be retried", "Dialog Escape");
    if (errors.length) throw Error(errors.join("; "));
    return { passed, pageErrors: errors };
  } catch (e) {
    return { passed, error: String(e), pageErrors: errors, currentPath: new URL(p.url()).pathname, body: (await p.locator("body").innerText()).slice(-1200) };
  } finally { await context.close(); }
}
