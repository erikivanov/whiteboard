async (hostPage) => {
  const browser = hostPage.context().browser();
  if (!browser) throw Error("Kein Browserkontext für isolierte Prüfung");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await context.newPage();
  const results = [];
  try {
    const errors = [],
      consoleErrors = [],
      failures = [],
      responses = [];
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("requestfailed", (r) => {
      if (r.url().startsWith("http://localhost:3001/"))
        failures.push({
          path: new URL(r.url()).pathname,
          error: r.failure()?.errorText,
        });
    });
    p.on("response", (r) => {
      if (r.url().startsWith("http://localhost:3001/") && r.status() >= 400)
        responses.push({ path: new URL(r.url()).pathname, status: r.status() });
    });
    const check = (v, m) => {
      if (!v) throw Error(m);
    };
    await p.goto("http://localhost:3001/board");
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).waitFor();
    const n = () => p.getByTestId("board-node").first();
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("Sicherung");
    await p.keyboard.press("Escape");
    await p.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("whiteboard.document.v1"))?.nodes?.[0]
          ?.text === "Sicherung",
    );
    await p.reload();
    await p.waitForFunction(
      () =>
        document.querySelector("[data-testid=board-node]")?.textContent ===
        "Sicherung",
    );
    results.push("Lokales Speichern und Wiederherstellen bestanden");
    await n().dblclick();
    await p
      .getByRole("textbox", { name: "Objekttext bearbeiten" })
      .selectText();
    await p.keyboard.insertText("Vor Escape");
    await p.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("whiteboard.document.v1"))?.nodes?.[0]
          ?.text === "Vor Escape",
    );
    await p.reload();
    await p.waitForFunction(
      () =>
        document.querySelector("[data-testid=board-node]")?.textContent ===
        "Vor Escape",
    );
    results.push("Speicherung laufender Texteingabe bestanden");
    await n().dblclick();
    await p
      .getByRole("textbox", { name: "Objekttext bearbeiten" })
      .selectText();
    await p.keyboard.insertText("Nachher");
    await p.keyboard.press("Escape");
    await p.locator("textarea").waitFor({ state: "detached" });
    await p.keyboard.press("ControlOrMeta+z");
    check((await n().textContent()) === "Vor Escape", "Text-Undo");
    await p.keyboard.press("ControlOrMeta+Shift+z");
    check((await n().textContent()) === "Nachher", "Text-Redo");
    results.push("Text-Undo/Redo bestanden");
    const download = p.waitForEvent("download");
    await p.getByRole("button", { name: "Exportieren", exact: true }).click();
    const d = await download;
    check(d.suggestedFilename() === "whiteboard.json", "Exportname");
    await d.saveAs(
      "/Users/erikivanov/Desktop/miro-free/test-results/live-export.json",
    );
    check((await d.failure()) === null, "Exportdownload");
    results.push("JSON-Exportdownload bestanden");
    const importData = async (value) => {
      await p.locator("input[type=file]").evaluate((input, value) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([JSON.stringify(value)], "test.json", {
            type: "application/json",
          }),
        );
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    };
    await importData({ version: 2 });
    await p
      .getByRole("alert")
      .filter({ hasText: "Import fehlgeschlagen" })
      .waitFor();
    check(
      (await n().textContent()) === "Nachher",
      "Ungültiger Import erhält Board",
    );
    results.push("Importvalidierung bestanden");
    await p.getByRole("button", { name: "Hinweis schließen" }).click();
    const fixture = {
      version: 1,
      title: "Prüfboard",
      nodes: [
        {
          id: "note-test",
          kind: "note",
          x: 300,
          y: 250,
          w: 100,
          h: 100,
          text: "Importiert",
          fill: "#fff79e",
        },
        {
          id: "rect-test",
          kind: "rect",
          x: 650,
          y: 250,
          w: 200,
          h: 120,
          text: "Form B",
          fill: "transparent",
        },
      ],
      edges: [
        {
          id: "edge-test",
          from: {
            nodeId: "note-test",
            side: "right",
            point: { x: 400, y: 300 },
          },
          to: { nodeId: "rect-test", side: "left", point: { x: 650, y: 310 } },
        },
      ],
    };
    await importData(fixture);
    await p.waitForFunction(
      () =>
        document.querySelector("[data-id=note-test]")?.textContent ===
        "Importiert",
    );
    check((await p.getByTestId("edge").count()) === 1, "Importverbindung");
    await p
      .getByRole("button", { name: "Rückgängig machen", exact: true })
      .click();
    check((await n().textContent()) === "Nachher", "Import-Undo");
    await p
      .getByRole("button", { name: "Wiederherstellen", exact: true })
      .click();
    results.push("JSON-Import mit Undo/Redo bestanden");
    await p.mouse.click(525, 305);
    await p
      .getByRole("combobox", { name: "Linientyp" })
      .selectOption("straight");
    check(
      (await p.getByTestId("edge-path").getAttribute("d")).includes(" L "),
      "Gerade Linie",
    );
    await p.getByRole("combobox", { name: "Linientyp" }).selectOption("elbow");
    check(
      (await p.getByTestId("edge-path").getAttribute("d")).split(" L ")
        .length === 4,
      "Gewinkelte Linie",
    );
    await p.getByRole("button", { name: "Pfeilspitze", exact: true }).click();
    check(
      (await p.getByTestId("edge-path").getAttribute("marker-end")) === null,
      "Pfeilspitze aus",
    );
    await p.getByRole("button", { name: "Pfeilspitze", exact: true }).click();
    results.push("Linientypen und Pfeilspitze bestanden");
    await p.getByRole("button", { name: "Text", exact: true }).click();
    await p.mouse.click(1000, 300);
    await p.keyboard.insertText(
      "ÄÖÜ – 日本語\nZwei\nDrei\nVier\nFünf\nSechs\nSieben\nAcht",
    );
    await p.keyboard.press("Escape");
    await p.locator("textarea").waitFor({ state: "detached" });
    const free = p.locator("[data-kind=text]");
    check((await free.textContent()).includes("日本語"), "Sonderzeichen");
    check(
      Number(await free.locator("rect").getAttribute("height")) > 100,
      "Text wächst mit Inhalt",
    );
    results.push("Mehrzeilige Texte/Sonderzeichen/Textwachstum bestanden");
    await p.getByRole("button", { name: "Formen und Linien" }).click();
    await p.getByRole("button", { name: "Dreieck", exact: true }).click();
    await p.mouse.move(1000, 600);
    await p.mouse.down();
    await p.mouse.move(1200, 730, { steps: 12 });
    await p.mouse.up();
    check(
      (await p.locator("[data-kind=triangle]").count()) === 1,
      "Dreieck zeichnen",
    );
    results.push("Dreieck aufziehen bestanden");
    await p.getByRole("button", { name: "Pfeillinie", exact: true }).click();
    await p.mouse.move(400, 300);
    await p.mouse.down();
    await p.mouse.move(1050, 665, { steps: 12 });
    await p.mouse.up();
    check(
      (await p.getByTestId("edge-path").last().getAttribute("d")).endsWith(
        "1050 665",
      ),
      "Dreieck-Randanker",
    );
    await p.mouse.move(1100, 665);
    await p.mouse.down();
    await p.mouse.move(1140, 665, { steps: 12 });
    await p.mouse.up();
    check(
      (await p.getByTestId("edge-path").last().getAttribute("d")).endsWith(
        "1090 665",
      ),
      "Dreieck-Verbindung folgt",
    );
    results.push("Verbindung an sichtbarer Dreieckkante bestanden");

    await p.mouse.click(1200, 850);
    const before = await p.getByTestId("viewport").getAttribute("transform");
    await p.keyboard.down("Space");
    await p.mouse.move(1200, 850);
    await p.mouse.down();
    await p.mouse.move(1240, 890, { steps: 8 });
    await p.mouse.up();
    await p.keyboard.up("Space");
    check(
      (await p.getByTestId("viewport").getAttribute("transform")) !== before,
      "Leertaste verschiebt Ansicht",
    );
    await p.mouse.move(1200, 850);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, -50);
    await p.keyboard.up("Control");
    await p.waitForFunction(
      () =>
        document.querySelector(".zoom-value").textContent.trim() !== "100 %",
    );
    results.push("Leertaste und Mausradzoom bestanden");
    check(errors.length === 0, "Browserfehler: " + errors.join(";"));
    check(
      consoleErrors.length === 0,
      "Konsolenfehler: " + consoleErrors.join(";"),
    );
    results.push("Keine pageerror-Ereignisse");
    return {
      results,
      pageErrors: errors,
      consoleErrors,
      failedLocalRequests: failures,
      localHttpErrors: responses,
    };
  } catch (e) {
    return { results, error: String(e) };
  } finally {
    await context.close();
  }
}
