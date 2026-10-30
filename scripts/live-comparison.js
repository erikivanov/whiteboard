async (hostPage) => {
  const p = hostPage
    .context()
    .pages()
    .find((p) => p.url().startsWith("http://localhost:3001/"));
  const fixture = {
    version: 1,
    title: "Raum für Ideen",
    nodes: [
      {
        id: "compare-note",
        kind: "note",
        x: 330,
        y: 244,
        w: 100,
        h: 100,
        text: "Vergleich A",
        fill: "#fff79e",
      },
      {
        id: "compare-rect",
        kind: "rect",
        x: 650,
        y: 240,
        w: 200,
        h: 120,
        text: "Form B",
        fill: "transparent",
      },
      {
        id: "compare-text",
        kind: "text",
        x: 360,
        y: 465,
        w: 70,
        h: 60,
        text: "Freier Text\nZweite Zeile",
        fill: "transparent",
      },
      {
        id: "old-note",
        kind: "note",
        x: 530,
        y: 586,
        w: 100,
        h: 100,
        text: "Notiz A geändert",
        fill: "#fff79e",
      },
      {
        id: "old-rect",
        kind: "rect",
        x: 910,
        y: 602,
        w: 277,
        h: 173,
        text: "Form B",
        fill: "transparent",
      },
      {
        id: "old-text",
        kind: "text",
        x: 479,
        y: 738,
        w: 70,
        h: 45,
        text: "Text geändert",
        fill: "transparent",
      },
    ],
    edges: [
      {
        id: "compare-edge",
        from: {
          nodeId: "compare-note",
          side: "right",
          point: { x: 430, y: 294 },
        },
        to: { nodeId: "compare-rect", side: "left", point: { x: 650, y: 300 } },
      },
      {
        id: "old-edge",
        from: { nodeId: "old-note", side: "right", point: { x: 630, y: 636 } },
        to: { nodeId: "old-rect", side: "left", point: { x: 910, y: 688 } },
      },
    ],
  };
  await p.bringToFront();
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.reload();
  await p
    .getByRole("status")
    .filter({ hasText: "Lokal gespeichert" })
    .waitFor();
  await p.locator("input[type=file]").evaluate((input, value) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([JSON.stringify(value)], "comparison.json", {
        type: "application/json",
      }),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, fixture);
  await p.waitForFunction(
    () =>
      document.querySelector("[data-id=compare-note]")?.textContent ===
      "Vergleich A",
  );
  await p.getByRole("button", { name: "Hinweis schließen" }).click();
  await p
    .getByRole("status")
    .filter({ hasText: "Lokal gespeichert" })
    .waitFor();
  const shot = async (name) =>
    p.screenshot({
      path:
        "/Users/erikivanov/Desktop/miro-free/docs/comparison/local-scene-" +
        name +
        ".png",
    });
  await p.mouse.click(1200, 400);
  await shot("normal");
  const n = p.locator("[data-id=compare-note]"),
    r = p.locator("[data-id=compare-rect]");
  await n.click();
  await p.locator(".contextbar").waitFor();
  await shot("selected");
  await r.click({ modifiers: ["Shift"] });
  await shot("multiple");
  await p.mouse.click(1200, 400);
  await n.dblclick();
  await p.getByRole("textbox", { name: "Objekttext bearbeiten" }).waitFor();
  await shot("editing");
  await p.keyboard.press("Escape");
  await p.locator("textarea").waitFor({ state: "detached" });
  await p.getByRole("button", { name: "Füllfarbe", exact: true }).click();
  await shot("fill");
  await p.getByRole("button", { name: "Füllfarbe", exact: true }).click();
  await n.click({ button: "right" });
  await p.getByRole("menu", { name: "Objektaktionen", exact: true }).waitFor();
  await shot("rightclick");
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Formen und Linien" }).click();
  await shot("shapes");
  await p.keyboard.press("Escape");
  await p.locator(".zoom-value").click();
  await shot("zoom");
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Notiz", exact: true }).hover();
  await shot("hover");
  return {
    viewport: p.viewportSize(),
    notes: await p.locator("[data-kind=note]").count(),
    shapes: await p.locator("[data-kind=rect]").count(),
    text: await p.locator("[data-kind=text]").count(),
    edges: await p.getByTestId("edge").count(),
  };
}
