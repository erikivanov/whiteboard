async (hostPage) => {
  const p = hostPage
    .context()
    .pages()
    .find((p) => p.url().startsWith("http://localhost:3001/"));
  await p.bringToFront();
  await p.reload();
  await p
    .getByRole("status")
    .filter({ hasText: "Lokal gespeichert" })
    .waitFor();
  const results = [],
    check = (v, m) => {
      if (!v) throw Error(m);
    };
  const originalCount = await p.getByTestId("board-node").count();
  await p.getByRole("button", { name: "Notiz", exact: true }).click();
  check(
    (await p
      .getByRole("dialog", { name: "Notizen", exact: true })
      .getByRole("button")
      .count()) === 16,
    "16 Notizfarben",
  );
  results.push("16-Farben-Palette bestanden");
  await p.screenshot({
    path: "/Users/erikivanov/Desktop/miro-free/docs/comparison/local-note-palette.png",
  });
  await p
    .getByRole("button", { name: "Hellgelbe Notiz anbringen", exact: true })
    .click();
  await p.mouse.click(1200, 280);
  await p.keyboard.insertText("Stiltest");
  await p.keyboard.press("Escape");
  await p.locator("textarea").waitFor({ state: "detached" });
  const targetId = await p
    .getByTestId("board-node")
    .last()
    .getAttribute("data-id");
  const n = p.locator(`[data-id="${targetId}"]`),
    display = n.locator(".object-text");
  check(
    (await n.locator("rect").first().getAttribute("width")) === "100",
    "Notizgröße S",
  );
  await p
    .getByRole("combobox", { name: "Schriftgröße", exact: true })
    .selectOption("24");
  await p.getByRole("button", { name: "Fett", exact: true }).click();
  await p.getByRole("button", { name: "Kursiv", exact: true }).click();
  check(
    await display.evaluate((e) => {
      const c = getComputedStyle(e);
      return (
        c.fontSize === "24px" &&
        c.fontWeight === "700" &&
        c.fontStyle === "italic"
      );
    }),
    "Schriftformatierung",
  );
  await p.keyboard.press("ControlOrMeta+b");
  check(
    (await display.evaluate((e) => getComputedStyle(e).fontWeight)) === "400",
    "Fett-Kürzel",
  );
  await p.keyboard.press("ControlOrMeta+b");
  await p.keyboard.press("ControlOrMeta+i");
  check(
    (await display.evaluate((e) => getComputedStyle(e).fontStyle)) === "normal",
    "Kursiv-Kürzel",
  );
  await p.keyboard.press("ControlOrMeta+i");
  results.push(
    "Schriftgröße/Fett/Kursiv einschließlich Tastenkürzel bestanden",
  );
  await p.getByRole("button", { name: "Ausrichtung", exact: true }).click();
  await p.getByRole("button", { name: "Linksbündig", exact: true }).click();
  await p.getByRole("button", { name: "Oben", exact: true }).click();
  check(
    await display.evaluate((e) => {
      const c = getComputedStyle(e);
      return c.textAlign === "left" && c.alignItems === "flex-start";
    }),
    "Ausrichtung",
  );
  await p.getByRole("button", { name: "Ausrichtung", exact: true }).click();
  results.push("Horizontale/vertikale Ausrichtung bestanden");
  await p.getByRole("button", { name: "Notizgröße S", exact: true }).click();
  await p.getByRole("menuitem", { name: "M", exact: true }).click();
  check(
    (await n.locator("rect").first().getAttribute("width")) === "200",
    "Notizgröße M",
  );
  await p.getByRole("button", { name: "Notizgröße M", exact: true }).click();
  await p.getByRole("menuitem", { name: "L", exact: true }).click();
  check(
    (await n.locator("rect").first().getAttribute("width")) === "400",
    "Notizgröße L",
  );
  await p.getByRole("button", { name: "Notizgröße L", exact: true }).click();
  await p.getByRole("menuitem", { name: "S", exact: true }).click();
  results.push("Notizgrößen S/M/L bestanden");
  await p.getByRole("button", { name: "Füllfarbe", exact: true }).click();
  await p
    .getByRole("button", { name: "Füllfarbe Schwarz", exact: true })
    .click();
  check(
    (await n.locator("rect").first().getAttribute("fill")) === "#151515",
    "Füllfarbe",
  );
  check(
    (await display.evaluate((e) => getComputedStyle(e).color)) ===
      "rgb(255, 255, 255)",
    "Lesbare Schrift auf Schwarz",
  );
  results.push("Füllfarbe und Kontrast bestanden");
  await p.getByRole("combobox", { name: "Objekttyp" }).selectOption("triangle");
  check((await n.locator("polygon").count()) === 1, "Dreieckdarstellung");
  await p.getByRole("combobox", { name: "Objekttyp" }).selectOption("note");
  results.push("Typwechsel/Dreieck bestanden");
  await n.click({ button: "right" });
  await p.getByRole("menuitem", { name: /Duplizieren/ }).click();
  check(
    (await p.getByTestId("board-node").count()) === originalCount + 2,
    "Duplikat",
  );
  await p.keyboard.press("Backspace");
  check(
    (await p.getByTestId("board-node").count()) === originalCount + 1,
    "Duplikat löschen",
  );
  await n.click({ button: "right" });
  await p
    .getByRole("menuitem", { name: "In den Hintergrund", exact: true })
    .click();
  check(
    (await p.getByTestId("board-node").first().getAttribute("data-id")) ===
      targetId,
    "Hintergrund",
  );
  await n.click({ button: "right" });
  await p
    .getByRole("menuitem", { name: "In den Vordergrund", exact: true })
    .click();
  check(
    (await p.getByTestId("board-node").last().getAttribute("data-id")) ===
      targetId,
    "Vordergrund",
  );
  await n.click({ button: "right" });
  await p
    .getByRole("menuitem", { name: "Inhalte löschen", exact: true })
    .click();
  check((await n.textContent()) === "", "Inhalte leeren");
  await n.dblclick();
  await p.keyboard.insertText("Stiltest");
  await p.keyboard.press("Escape");
  await p.locator("textarea").waitFor({ state: "detached" });
  results.push(
    "Rechtsklick/Duplizieren/Löschen/Anordnen/Inhalte leeren bestanden",
  );
  await n.click();
  await p.keyboard.press("ControlOrMeta+d");
  check(
    (await p.getByTestId("board-node").count()) === originalCount + 2,
    "Tastenkürzel Duplizieren",
  );
  await p.keyboard.press("Backspace");
  await n.click();
  await p.keyboard.press("Backspace");
  results.push("Duplizieren per Tastenkürzel bestanden");
  await p.locator(".zoom-value").click();
  await p.getByRole("menuitem", { name: "70 %", exact: true }).click();
  check(
    (await p.locator(".zoom-value").textContent()).trim() === "70 %",
    "Zoomvorgabe",
  );
  await p.locator(".zoom-value").click();
  await p.getByRole("menuitemcheckbox", { name: /Raster/ }).click();
  check(
    (await p.locator(".canvas>rect").getAttribute("fill")) === "transparent",
    "Raster aus",
  );
  await p.getByRole("menuitemcheckbox", { name: /Raster/ }).click();
  await p.getByRole("menuitem", { name: "100 %", exact: true }).click();
  results.push("Zoommenü/Raster bestanden");
  await p.getByRole("button", { name: "Hilfe", exact: true }).click();
  check(
    await p.getByRole("dialog", { name: "Bedienung", exact: true }).isVisible(),
    "Hilfe",
  );
  await p.screenshot({
    path: "/Users/erikivanov/Desktop/miro-free/docs/comparison/local-help-dialog.png",
  });
  await p.getByRole("button", { name: "Schließen", exact: true }).click();
  results.push("Bedienhilfe bestanden");
  return results;
}
