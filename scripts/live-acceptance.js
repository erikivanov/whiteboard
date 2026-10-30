async (hostPage) => {
  const p = hostPage
    .context()
    .pages()
    .find((p) => p.url().startsWith("http://localhost:3001/"));
  if (!p) throw Error("Lokaler Tab auf Port 3001 fehlt");
  await p.bringToFront();
  await p.reload();
  await p
    .getByRole("status")
    .filter({ hasText: "Lokal gespeichert" })
    .waitFor();
  await p.setViewportSize({ width: 1440, height: 1000 });
  const results = [];
  const check = (ok, label) => {
    if (!ok) throw Error(label);
  };
  const near = (a, b) => Math.abs(a - b) < 1;
  const node = (k) => p.locator(`[data-testid="board-node"][data-kind="${k}"]`);
  const box = async (k) => {
    const b = await node(k).evaluate((el) => {
      const r = el.firstElementChild.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (!b) throw Error("Objekt fehlt: " + k);
    return b;
  };
  const drag = async (x, y, a, b) => {
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(a, b, { steps: 12 });
    await p.mouse.up();
  };
  const text = async (t) => {
    await p.keyboard.insertText(t);
    await p.keyboard.press("Escape");
    await p.locator("textarea").waitFor({ state: "detached" });
  };
  const edit = async (k, t) => {
    await node(k).dblclick();
    await p
      .getByRole("textbox", { name: "Objekttext bearbeiten" })
      .selectText();
    await text(t);
  };
  const end = async () => {
    const d = await p.getByTestId("edge-path").getAttribute("d");
    const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
  };
  const reset = p.getByRole("button", { name: "Auswahl", exact: true });
  await reset.click();
  await p.mouse.click(1200, 750);
  await p.keyboard.press("ControlOrMeta+a");
  await p.keyboard.press("Backspace");
  const steps = [
    [
      "A01",
      async () => {
        await p.getByRole("button", { name: "Notiz", exact: true }).click();
        await p
          .getByRole("button", { name: /^Hellgelbe Notiz anbringen/i })
          .click();
        await p.mouse.click(360, 300);
        await text("Testnotiz A");
        await p.mouse.click(1200, 750);
        check((await node("note").count()) === 1, "Genau eine Notiz");
        check(
          (await node("note").textContent()) === "Testnotiz A",
          "Unmittelbare Texteingabe",
        );
        check(
          (await node("note")
            .locator(".object-text")
            .evaluate((e) => getComputedStyle(e).textAlign)) === "center",
          "Zentrierung",
        );
      },
    ],
    [
      "A02",
      async () => {
        await edit("note", "Notiz A geändert");
        const b = await box("note");
        await drag(
          b.x + b.width / 2,
          b.y + b.height / 2,
          b.x + b.width / 2 + 40,
          b.y + b.height / 2 + 100,
        );
        const a = await box("note");
        check(near(a.x - b.x, 40) && near(a.y - b.y, 100), "Notizbewegung");
        check(
          (await node("note").textContent()) === "Notiz A geändert",
          "Text ersetzt",
        );
      },
    ],
    [
      "A03",
      async () => {
        await p.getByRole("button", { name: "Formen und Linien" }).click();
        await p.getByRole("button", { name: "Rechteck", exact: true }).click();
        await drag(650, 300, 850, 420);
        await edit("rect", "Form B");
        const b = await box("rect");
        check(
          near(b.width, 200) && near(b.height, 120),
          "Formgröße " + JSON.stringify(b),
        );
        check((await node("rect").textContent()) === "Form B", "Formtext");
      },
    ],
    [
      "A04",
      async () => {
        await p.getByRole("button", { name: "Text", exact: true }).click();
        await p.mouse.click(360, 620);
        await p.keyboard.insertText("Freier Text");
        await p.keyboard.press("Enter");
        await text("Zweite Zeile");
        check(
          (await node("text").textContent()) === "Freier Text\nZweite Zeile",
          "Mehrzeiliger Text",
        );
      },
    ],
    [
      "A05",
      async () => {
        await edit("text", "Text geändert");
        await p.mouse.click(1200, 750);
        check(
          (await node("text").count()) === 1 &&
            (await node("text").textContent()) === "Text geändert",
          "Freier Text ersetzt",
        );
      },
    ],
    [
      "A06",
      async () => {
        const a = await box("note"),
          b = await box("rect");
        await p
          .getByRole("button", { name: "Pfeillinie", exact: true })
          .click();
        await drag(a.x + a.width, a.y + a.height / 2, b.x, b.y + b.height / 2);
        await p.mouse.click(1200, 750);
        check((await p.getByTestId("edge").count()) === 1, "Pfeil sichtbar");
        check(
          (await p.getByTestId("edge-path").getAttribute("marker-end")) ===
            "url(#arrow)",
          "Pfeilspitze",
        );
      },
    ],
    [
      "A07",
      async () => {
        const a = await box("note"),
          b = await box("rect");
        await drag(
          b.x + b.width / 2,
          b.y + b.height / 2,
          b.x + b.width / 2 + 100,
          b.y + b.height / 2 + 120,
        );
        const c = await box("rect"),
          n = await box("note"),
          e = await end();
        check(near(c.x - b.x, 100) && near(c.y - b.y, 120), "Formbewegung");
        check(near(n.x, a.x) && near(n.y, a.y), "Notiz unverändert");
        check(
          near(e.x, c.x) && near(e.y, c.y + c.height / 2),
          "Gebundener Randanker",
        );
      },
    ],
    [
      "A08",
      async () => {
        const b = await box("rect");
        await drag(
          b.x + b.width,
          b.y + b.height,
          b.x + b.width + 80,
          b.y + b.height + 50,
        );
        const a = await box("rect"),
          e = await end();
        check(
          near(a.width, b.width + 80) && near(a.height, b.height + 50),
          "Skalierung",
        );
        check(
          near(e.x, a.x) && near(e.y, a.y + a.height / 2),
          "Randanker skaliert",
        );
        check(
          (await node("rect").textContent()) === "Form B",
          "Beschriftung bleibt",
        );
      },
    ],
    [
      "A09",
      async () => {
        const a = await box("note"),
          b = await box("rect");
        await drag(
          Math.min(a.x, b.x) - 40,
          Math.min(a.y, b.y) - 40,
          Math.max(a.x + a.width, b.x + b.width) + 30,
          Math.max(a.y + a.height, b.y + b.height) + 20,
        );
        check(
          (await p.locator(".contextbar").textContent()).includes("3 Objekte"),
          "Drei Objekte im Rahmen",
        );
      },
    ],
    [
      "A10",
      async () => {
        const n = await box("note"),
          r = await box("rect"),
          t = await box("text");
        await drag(
          n.x + n.width / 2,
          n.y + n.height / 2,
          n.x + n.width / 2 + 40,
          n.y + n.height / 2 + 60,
        );
        const a = await box("note"),
          b = await box("rect"),
          c = await box("text");
        check(
          near(a.x - n.x, 40) &&
            near(a.y - n.y, 60) &&
            near(b.x - r.x, 40) &&
            near(b.y - r.y, 60),
          "Gemeinsame Bewegung",
        );
        check(near(c.x, t.x) && near(c.y, t.y), "Text bleibt außerhalb");
        const e = await end();
        check(
          near(e.x, b.x) && near(e.y, b.y + b.height / 2),
          "Verbindung bleibt gebunden",
        );
      },
    ],
    [
      "A11",
      async () => {
        await p.keyboard.press("Backspace");
        check(
          (await p.getByTestId("board-node").count()) === 1 &&
            (await p.getByTestId("edge").count()) === 0,
          "Gemeinsame Löschung",
        );
        check(
          (await node("text").textContent()) === "Text geändert",
          "Text erhalten",
        );
      },
    ],
    [
      "A12",
      async () => {
        await p
          .getByRole("button", { name: "Rückgängig machen", exact: true })
          .click();
        check(
          (await p.getByTestId("board-node").count()) === 3 &&
            (await p.getByTestId("edge").count()) === 1,
          "Undo der Gruppe",
        );
        const before = await box("rect");
        await p
          .getByRole("button", { name: "Wiederherstellen", exact: true })
          .click();
        check(
          (await p.getByTestId("board-node").count()) === 1,
          "Redo der Gruppe",
        );
        await p
          .getByRole("button", { name: "Rückgängig machen", exact: true })
          .click();
        const after = await box("rect");
        check(
          near(before.x, after.x) && near(before.y, after.y),
          "Undo stellt Position wieder her",
        );
      },
    ],
    [
      "A13",
      async () => {
        await p.mouse.click(1200, 750);
        await node("note").click();
        await node("rect").click({ modifiers: ["Shift"] });
        check(
          (await p.locator(".contextbar").textContent()).includes("2 Objekte"),
          "Shift-Auswahl",
        );
      },
    ],
    [
      "A14",
      async () => {
        const a = await box("rect");
        await p
          .getByRole("button", { name: "Vergrößern", exact: true })
          .click();
        check(
          (await p.locator(".zoom-value").textContent()).trim() === "125 %",
          "125 % Anzeige",
        );
        const b = await box("rect");
        check(near(b.width / a.width, 1.25), "Zoom skaliert");
        await p
          .getByRole("button", { name: "Verkleinern", exact: true })
          .click();
        check(
          (await p.locator(".zoom-value").textContent()).trim() === "100 %",
          "100 % Anzeige",
        );
      },
    ],
    [
      "A15",
      async () => {
        await p.mouse.click(1200, 760);
        const a = await box("rect"),
          rail = await p.locator(".toolrail").boundingBox();
        await p.keyboard.down("Space");
        await drag(1200, 760, 1280, 830);
        await p.keyboard.up("Space");
        const b = await box("rect"),
          r = await p.locator(".toolrail").boundingBox();
        check(
          near(b.x - a.x, 80) && near(b.y - a.y, 70),
          "Pan verschiebt Objekte",
        );
        check(near(rail.x, r.x) && near(rail.y, r.y), "Feste Werkzeugleiste");
        check(
          (await p.locator(".zoom-value").textContent()).trim() === "100 %",
          "Pan ohne Zoom",
        );
      },
    ],
    [
      "A16",
      async () => {
        await node("note").click();
        check(
          (await p.getByTestId("selection").count()) === 1,
          "Auswahl erscheint",
        );
        await p.mouse.click(1250, 800);
        check(
          (await p.getByTestId("selection").count()) === 0,
          "Auswahl verschwindet",
        );
      },
    ],
  ];
  for (const [id, run] of steps) {
    try {
      await run();
      results.push({ id, status: "bestanden" });
    } catch (e) {
      results.push({ id, status: "fehlgeschlagen", error: String(e) });
      await p.screenshot({
        path:
          "/Users/erikivanov/Desktop/miro-free/docs/comparison/local-" +
          id +
          "-failure.png",
      });
      break;
    }
  }
  await p.screenshot({
    path: "/Users/erikivanov/Desktop/miro-free/docs/comparison/local-acceptance-final.png",
  });
  return results;
}
