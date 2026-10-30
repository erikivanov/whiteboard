async (host) => {
  const browser = host.context().browser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await context.newPage();
  const results = [],
    errors = [],
    network = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.url().startsWith("http://localhost:3001") && r.status() >= 400)
      network.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  const check = (v, m) => {
    if (!v) throw Error(m);
  };
  const fixture = {
    version: 1,
    title: "Interaktionsprüfung",
    nodes: [
      {
        id: "source",
        kind: "note",
        x: 550,
        y: 450,
        w: 100,
        h: 100,
        text: "Quelle",
        fill: "#ffb575",
        bold: true,
      },
      {
        id: "target",
        kind: "note",
        x: 800,
        y: 300,
        w: 100,
        h: 100,
        text: "Ziel",
        fill: "#81e7de",
      },
      {
        id: "reference",
        kind: "note",
        x: 750,
        y: 500,
        w: 200,
        h: 200,
        text: "Referenz",
        fill: "#fd9ae7",
      },
      {
        id: "width-ref",
        kind: "rect",
        x: 1000,
        y: 580,
        w: 160,
        h: 130,
        text: "160 × 130",
        fill: "transparent",
      },
      {
        id: "height-ref",
        kind: "rect",
        x: 950,
        y: 280,
        w: 130,
        h: 180,
        text: "130 × 180",
        fill: "transparent",
      },
      {
        id: "resize-test",
        kind: "rect",
        x: 400,
        y: 270,
        w: 120,
        h: 120,
        text: "Skalieren",
        fill: "transparent",
      },
    ],
    edges: [],
  };
  const load = async () => {
    await p.locator("input[type=file]").evaluate((input, data) => {
      const t = new DataTransfer();
      t.items.add(
        new File([JSON.stringify(data)], "fixture.json", {
          type: "application/json",
        }),
      );
      input.files = t.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, fixture);
    await p.waitForFunction(
      () =>
        document.querySelectorAll("[data-testid=board-node]").length === 6 &&
        document.querySelectorAll("[data-testid=edge]").length === 0,
    );
    await p.getByRole("button", { name: "Hinweis schließen" }).click();
    await saved();
  };
  const saved = async () => {
    await p
      .getByRole("status")
      .filter({ hasText: "Lokal gespeichert" })
      .waitFor();
  };
  const read = async () => {
    await p.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await saved();
    return p.evaluate(() =>
      JSON.parse(localStorage.getItem("whiteboard.document.v1")),
    );
  };
  const world = async (x, y) =>
    p.getByTestId("viewport").evaluate(
      (el, v) => {
        const q = new DOMPoint(v.x, v.y).matrixTransform(el.getScreenCTM());
        return { x: q.x, y: q.y };
      },
      { x, y },
    );
  const dragStart = async (x, y) => {
    const a = await world(x, y);
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
  };
  const move = async (x, y) => {
    const b = await world(x, y);
    await p.mouse.move(b.x, b.y, { steps: 12 });
  };
  const select = async (id) => {
    await p.locator(`[data-id="${id}"]`).click();
  };
  const shot = async (name) =>
    p.screenshot({
      path: `/Users/erikivanov/Desktop/miro-free/docs/interactions/local-${name}.png`,
    });
  const zoom = async (z) => {
    await p.locator(".zoom-value").click();
    await p
      .getByRole("menuitem", { name: `${z * 100} %`, exact: true })
      .click();
  };
  const reset = async () => {
    await p.keyboard.press("Escape");
    await load();
  };
  try {
    await p.goto("http://localhost:3001/board");
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).waitFor();
    await load();
    for (const z of [0.5, 1, 2]) {
      await zoom(z);
      for (const side of ["top", "right", "bottom", "left"]) {
        await reset();
        await select("source");
        const before = await read();
        const control = p.getByTestId("connection-" + side);
        await control.hover();
        await p.getByTestId("quick-preview").waitFor();
        const b = await control.boundingBox();
        check(
          Math.abs(b.width - 26) < 1 && Math.abs(b.height - 26) < 1,
          "Konstante Trefferfläche " + z + " " + side,
        );
        await p.waitForFunction(({side,z})=>{const e=document.querySelector(`[data-testid="connection-${side}"] .connection-dot`);return e&&Math.abs(parseFloat(getComputedStyle(e).r)-12/z)<.1},{side,z});
        await shot(`anchor-${side}-${z * 100}`);
        check(
          JSON.stringify(await read()) === JSON.stringify(before),
          "Vorschau darf nicht gespeichert werden",
        );
        await control.click();
        await p.waitForFunction(
          () =>
            document.querySelectorAll("[data-testid=board-node]").length === 7,
        );
        let d = await read(),
          child = d.nodes.find(
            (n) => !fixture.nodes.some((s) => s.id === n.id),
          );
        check(
          child &&
            child.text === "" &&
            child.fill === fixture.nodes[0].fill &&
            child.w === 100 &&
            child.h === 100 &&
            child.bold === true,
          "Leere Notiz erbt Eigenschaften",
        );
        check(
          d.edges.length === 1 &&
            d.edges[0].from.nodeId === "source" &&
            d.edges[0].from.side === side &&
            d.edges[0].to.nodeId === child.id,
          "Automatische Verbindung",
        );
        check(
          (await p.locator("textarea").count()) === 0,
          "Neues Objekt wird ausgewählt, nicht automatisch bearbeitet",
        );
        await shot(`created-${side}-${z * 100}`);
        const expected = {
          top: [550, 202],
          right: [766, 450],
          bottom: [550, 698],
          left: [334, 450],
        }[side];
        check(
          Math.abs(child.x - expected[0]) < 0.001 &&
            Math.abs(child.y - expected[1]) < 0.001,
          "Richtungsabstand",
        );
        await p
          .getByRole("button", { name: "Rückgängig machen", exact: true })
          .click();
        check(
          (await p.getByTestId("board-node").count()) === 6 &&
            (await p.getByTestId("edge").count()) === 0,
          "Notiz+Verbindung ein Undo-Schritt",
        );
        await p
          .getByRole("button", { name: "Wiederherstellen", exact: true })
          .click();
        check(
          (await p.getByTestId("board-node").count()) === 7 &&
            (await p.getByTestId("edge").count()) === 1,
          "Gemeinsames Redo",
        );
        results.push({
          zoom: z,
          scenario: "Punkt " + side + " / Vorschau / Erstellen / Undo-Redo",
          status: "bestanden",
        });
      }
      await reset();
      await select("source");
      const c = p.getByTestId("connection-right");
      const cb = await c.boundingBox();
      await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
      await p.mouse.down();
      await move(850, 350);
      await p.getByTestId("connection-target").waitFor();
      await shot(`target-${z * 100}`);
      await p.mouse.up();
      let d = await read();
      check(
        d.edges.length === 1 && d.edges[0].to.nodeId === "target",
        "Bestehendes Ziel verbunden",
      );
      await select("target");
      await dragStart(850, 350);
      await move(890, 375);
      await p.mouse.up();
      d = await read();
      check(
        d.edges[0].to.nodeId === "target",
        "Verbindung bleibt beim Verschieben",
      );
      results.push({
        zoom: z,
        scenario: "Vorhandenes Ziel / Hervorhebung / Verschieben",
        status: "bestanden",
      });
      await reset();
      await select("source");
      let b = await p.getByTestId("connection-right").boundingBox();
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await p.mouse.down();
      await p.mouse.move(1200, 500, { steps: 15 });
      await p.keyboard.press("Escape");
      await p.mouse.up();
      check(
        (await read()).edges.length === 0 &&
          (await p
            .getByRole("menu", { name: "Verbundenes Objekt erstellen" })
            .count()) === 0,
        "Escape während Ziehen",
      );
      await shot(`cancelled-${z * 100}`);
      b = await p.getByTestId("connection-right").boundingBox();
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await p.mouse.down();
      await p.mouse.move(1200, 500, { steps: 15 });
      await p.mouse.up();
      await p
        .getByRole("menu", { name: "Verbundenes Objekt erstellen" })
        .waitFor();
      await shot(`empty-menu-${z * 100}`);
      check((await read()).edges.length === 1, "Loslassen erzeugt freie Linie");
      await p.keyboard.press("Escape");
      check(
        (await read()).edges.length === 1,
        "Escape nach Loslassen schließt nur Menü",
      );
      await p
        .getByRole("button", { name: "Rückgängig machen", exact: true })
        .click();
      check((await read()).edges.length === 0, "Freie Linie ein Undo");
      await select("source");
      b = await p.getByTestId("connection-right").boundingBox();
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await p.mouse.down();
      await p.mouse.move(1200, 500, { steps: 15 });
      await p.mouse.up();
      await p
        .getByRole("menuitem", { name: /Dasselbe Objekt hinzufügen/ })
        .click();
      d = await read();
      check(
        d.nodes.length === 7 && d.edges.length === 1 && d.edges[0].to.nodeId,
        "Menü erstellt verbundenes Objekt",
      );
      await shot(`menu-created-${z * 100}`);
      await p
        .getByRole("button", { name: "Rückgängig machen", exact: true })
        .click();
      d = await read();
      check(
        d.nodes.length === 6 && d.edges.length === 1 && !d.edges[0].to.nodeId,
        "Menüwahl ein Undo-Schritt",
      );
      results.push({
        zoom: z,
        scenario: "Leere Fläche / Escape / Erstellmenü / Undo",
        status: "bestanden",
      });
      for (const [name, w, h] of [
        ["width", 200, 145],
        ["height", 175, 180],
        ["both", 200, 200],
      ]) {
        await reset();
        await select("resize-test");
        await dragStart(520, 390);
        await move(400 + w, 270 + h);
        const wc = await p.getByTestId("size-guide-width").count(),
          hc = await p.getByTestId("size-guide-height").count();
        check(
          wc === (name === "height" ? 0 : 1) &&
            hc === (name === "width" ? 0 : 1),
          "Breite/Höhe getrennt " + name,
        );
        await shot(`guide-${name}-${z * 100}`);
        await p.mouse.up();
        d = await read();
        const n = d.nodes.find((n) => n.id === "resize-test");
        check(n.w === w && n.h === h, "Skalierung " + name);
        check(
          (await p.getByTestId("size-guide-width").count()) === 0 &&
            (await p.getByTestId("position-guide-x").count()) === 0,
          "Hilfen verschwinden nach Abschluss",
        );
        await p
          .getByRole("button", { name: "Rückgängig machen", exact: true })
          .click();
        check(
          (await read()).nodes.find((n) => n.id === "resize-test").w === 120,
          "Größenänderung ein Undo",
        );
        results.push({
          zoom: z,
          scenario: "Größenvergleich " + name,
          status: "bestanden",
        });
      }
      await reset();
      await select("source");
      await dragStart(650, 550);
      await move(750, 550);
      d = await read();
      let n = d.nodes.find((n) => n.id === "source");
      check(
        Math.abs(n.w - 150) < 0.01 && Math.abs(n.h - 150) < 0.01,
        "Notiz proportional bei horizontalem Griffzug",
      );
      await p.keyboard.press("Escape");
      await p.mouse.up();
      check(
        (await read()).nodes.find((n) => n.id === "source").w === 100,
        "Escape rollt aktive Skalierung zurück",
      );
      await select("source");
      await dragStart(650, 550);
      await move(750, 650);
      check(
        (await p.getByTestId("size-guide-width").count()) === 1 &&
          (await p.getByTestId("size-guide-height").count()) === 1,
        "Proportional beide Maße",
      );
      await p.mouse.up();
      await reset();
      await select("resize-test");
      await dragStart(520, 390);
      await move(600 - 2 / z, 415);
      n = (await read()).nodes.find((n) => n.id === "resize-test");
      check(Math.abs(n.w - 200) < 0.01, "Vier-Pixel-Größenrastung");
      await p.mouse.up();
      await reset();
      await select("resize-test");
      await dragStart(520, 390);
      await move(600 - 7 / z, 415);
      check(
        (await p.getByTestId("size-guide-width").count()) === 0,
        "Außerhalb Einblendschwelle",
      );
      await p.mouse.up();
      await reset();
      await select("source");
      await dragStart(600, 500);
      await move(800 - 2 / z, 500);
      check(
        (await p.getByTestId("position-guide-x").count()) === 1 &&
          (await p.getByTestId("size-guide-width").count()) === 0,
        "Positionshilfen getrennt",
      );
      n = (await read()).nodes.find((n) => n.id === "source");
      check(Math.abs(n.x - 750) < 0.01, "Positionsrastung");
      await shot(`alignment-${z * 100}`);
      await p.mouse.up();
      results.push({
        zoom: z,
        scenario: "Proportional / Abbrechen / Schwelle / Positionsausrichtung",
        status: "bestanden",
      });
    }
    await zoom(1);
    await reset();
    await select("source");
    await p.getByTestId("connection-right").click();
    const persisted = await read();
    await p.reload();
    await p.waitForFunction(
      () => document.querySelectorAll("[data-testid=board-node]").length === 7,
    );
    const restored = await read();
    check(
      JSON.stringify(persisted) === JSON.stringify(restored),
      "Speichern und Neuladen",
    );
    check(
      !JSON.stringify(restored).includes("quick-preview") &&
        !("guides" in restored),
      "Keine temporären Daten gespeichert",
    );
    await p.locator("[data-id=source]").dblclick();
    await p
      .getByRole("textbox", { name: "Objekttext bearbeiten" })
      .selectText();
    await p.keyboard.insertText("Text bleibt bearbeitbar");
    await p.keyboard.press("Escape");
    check(
      (await p.locator("[data-id=source]").textContent()) ===
        "Text bleibt bearbeitbar",
      "Textbearbeitung erhalten",
    );
    results.push({
      scenario: "Persistenz / temporäre Daten / Textbearbeitung",
      status: "bestanden",
    });
    check(
      errors.length === 0 && network.length === 0,
      "Browser-/Netzwerkfehler",
    );
    return { results, errors, network };
  } catch (e) {
    await shot("failure");
    return { results, error: String(e), errors, network };
  } finally {
    await context.close();
  }
}
