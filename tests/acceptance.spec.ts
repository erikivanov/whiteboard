import { authenticateContext } from "./auth-support";
import { test, expect, Page } from "./fixtures";
import fs from "node:fs";
import path from "node:path";
let page: Page;
const node = (kind: string) =>
  page.locator(`[data-testid="board-node"][data-kind="${kind}"]`);
async function drag(x: number, y: number, toX: number, toY: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}
async function type(text: string) {
  await page.keyboard.insertText(text);
  await page.keyboard.press("Escape");
  await page.locator("textarea").waitFor({ state: "detached" });
}
async function edit(kind: string, text: string) {
  await node(kind).dblclick();
  await page
    .getByRole("textbox", { name: "Objekttext bearbeiten" })
    .selectText();
  await type(text);
}
async function stored() {
  await expect(page.getByRole("status")).toContainText("Lokal gespeichert");
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("whiteboard.document.v1")!),
  );
}
export async function staticRoute(p: Page) {
  const origin = new URL(
    process.env.WHITEBOARD_BASE_URL ?? "http://localhost:3001",
  ).origin;
  await p.route(origin + "/**", async (route) => {
    const u = new URL(route.request().url());
    const root = process.cwd();
    const file =
      u.pathname === "/board"
        ? path.join(root, ".next/server/app/board.html")
        : u.pathname.startsWith("/_next/static/")
          ? path.join(
              root,
              ".next/static",
              u.pathname.slice("/_next/static/".length),
            )
          : null;
    if (file && fs.existsSync(file)) {
      const ext = path.extname(file);
      await route.fulfill({
        body: fs.readFileSync(file),
        contentType:
          ext === ".html"
            ? "text/html"
            : ext === ".js"
              ? "application/javascript"
              : ext === ".css"
                ? "text/css"
                : "application/octet-stream",
      });
    } else await route.fulfill({ status: 404, body: "" });
  });
}
test.describe("Dokumentierte Abnahme A01–A16", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await authenticateContext(page.context());
    if (process.env.WHITEBOARD_STATIC_TEST) await staticRoute(page);
    await page.goto("/board");
    await expect(
      page.getByRole("button", { name: "Erste Notiz anlegen" }),
    ).toBeVisible();
  });
  test.afterAll(async () => {
    await page?.close();
  });
  test("A01 · hellgelbe Notiz mit zentriertem Text", async () => {
    await page.getByRole("button", { name: "Notiz", exact: true }).click();
    await page
      .getByRole("button", { name: "Hellgelbe Notiz anbringen" })
      .click();
    await page.mouse.click(360, 300);
    await type("Testnotiz A");
    await page.mouse.click(1150, 700);
    await expect(node("note")).toHaveCount(1);
    await expect(node("note")).toHaveText("Testnotiz A");
    const noteData = (await stored()).nodes.find((n: any) => n.kind === "note");
    expect(noteData.fill).toBe("#fff79e");
    expect(noteData.align ?? "center").toBe("center");
    await expect(page.getByTestId("board-canvas")).toBeVisible();
  });
  test("A02 · Notiz ersetzen und verschieben", async () => {
    await edit("note", "Notiz A geändert");
    await drag(360, 300, 400, 400);
    await expect(node("note")).toHaveText("Notiz A geändert");
    await expect(node("note")).toHaveAttribute(
      "transform",
      "translate(350 350)",
    );
  });
  test("A03 · Rechteck aufziehen und beschriften", async () => {
    await page.getByRole("button", { name: "Formen und Linien" }).click();
    await page.getByRole("button", { name: "Rechteck", exact: true }).click();
    await drag(650, 300, 850, 420);
    await edit("rect", "Form B");
    await expect(node("rect")).toHaveText("Form B");
    await expect(node("rect").locator("rect")).toHaveAttribute("width", "200");
    await expect(node("rect").locator("rect")).toHaveAttribute("height", "120");
    expect((await stored()).nodes.find((n: any) => n.kind === "rect").kind).toBe("rect");
  });
  test("A04 · freier mehrzeiliger Text", async () => {
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.mouse.click(360, 620);
    await page.keyboard.insertText("Freier Text");
    await page.keyboard.press("Enter");
    await type("Zweite Zeile");
    await expect(node("text")).toHaveText("Freier Text\nZweite Zeile");
  });
  test("A05 · Text ersetzen ohne Duplikat", async () => {
    await edit("text", "Text geändert");
    await page.mouse.click(1150, 700);
    await expect(node("text")).toHaveCount(1);
    await expect(node("text")).toHaveText("Text geändert");
  });
  test("A06 · verbundener Pfeil", async () => {
    await page.getByRole("button", { name: "Pfeillinie", exact: true }).click();
    await drag(450, 400, 650, 360);
    await page.mouse.click(1150, 700);
    await expect(page.getByTestId("edge")).toHaveCount(1);
    const d = await stored();
    expect(d.edges[0].from.nodeId).toBe(
      d.nodes.find((n: any) => n.kind === "note").id,
    );
    expect(d.edges[0].to.nodeId).toBe(
      d.nodes.find((n: any) => n.kind === "rect").id,
    );
    expect(d.edges[0].arrow).not.toBe(false);
  });
  test("A07 · Pfeil folgt beim Verschieben", async () => {
    const before = await page.getByTestId("edge-path").getAttribute("d");
    await drag(750, 360, 850, 480);
    await expect(node("note")).toHaveAttribute(
      "transform",
      "translate(350 350)",
    );
    await expect(node("rect")).toHaveAttribute(
      "transform",
      "translate(750 420)",
    );
    await expect(page.getByTestId("edge-path")).not.toHaveAttribute(
      "d",
      before!,
    );
    await expect(page.getByTestId("edge-path")).toHaveAttribute(
      "d",
      /750 480$/,
    );
  });
  test("A08 · Eckgriff skaliert Form und Verbindung", async () => {
    const handle = page.getByTestId("resize-se");
    await expect(handle).toBeVisible();
    await drag(950, 540, 1030, 590);
    await expect(node("rect").locator("rect")).toHaveAttribute("width", "280");
    await expect(node("rect").locator("rect")).toHaveAttribute("height", "170");
    await expect(node("rect")).toHaveText("Form B");
    await expect(page.getByTestId("edge-path")).toHaveAttribute(
      "d",
      /750 505$/,
    );
  });
  test("A09 · Auswahlrahmen umfasst drei Objekte", async () => {
    await drag(270, 240, 1100, 610);
    await expect(page.locator(".contextbar")).toContainText("3 Objekte");
    await expect(page.getByTestId("selection")).toHaveCount(1);
  });
  test("A10 · gemeinsame Bewegung", async () => {
    await drag(400, 400, 440, 460);
    await expect(node("note")).toHaveAttribute(
      "transform",
      "translate(390 410)",
    );
    await expect(node("rect")).toHaveAttribute(
      "transform",
      "translate(790 480)",
    );
    await expect(node("text")).toHaveAttribute(
      "transform",
      "translate(360 620)",
    );
    await expect(page.getByTestId("edge-path")).toHaveAttribute(
      "d",
      /790 565$/,
    );
  });
  test("A11 · gemeinsame Löschung", async () => {
    await page.keyboard.press("Backspace");
    await expect(node("note")).toHaveCount(0);
    await expect(node("rect")).toHaveCount(0);
    await expect(page.getByTestId("edge")).toHaveCount(0);
    await expect(node("text")).toHaveText("Text geändert");
  });
  test("A12 · Undo, Redo, Undo der gemeinsamen Löschung", async () => {
    await page
      .getByRole("button", { name: "Rückgängig machen", exact: true })
      .click();
    await expect(node("note")).toHaveAttribute(
      "transform",
      "translate(390 410)",
    );
    await expect(node("rect")).toHaveAttribute(
      "transform",
      "translate(790 480)",
    );
    await expect(page.getByTestId("edge")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Wiederherstellen", exact: true })
      .click();
    await expect(page.getByTestId("board-node")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Rückgängig machen", exact: true })
      .click();
    await expect(page.getByTestId("board-node")).toHaveCount(3);
    await expect(node("text")).toHaveText("Text geändert");
  });
  test("A13 · Shift-Auswahl von zwei Objekten", async () => {
    await page.mouse.click(1150, 700);
    await node("note").click();
    await node("rect").click({ modifiers: ["Shift"] });
    await expect(page.locator(".contextbar")).toContainText("2 Objekte");
  });
  test("A14 · Zoom 100 → 125 → 100", async () => {
    const b = await node("rect").boundingBox();
    await page.getByRole("button", { name: "Vergrößern", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Zoom und Navigation" }),
    ).toHaveText("125 %");
    const bigger = await node("rect").boundingBox();
    expect(bigger!.width / b!.width).toBeCloseTo(1.25, 1);
    await page
      .getByRole("button", { name: "Verkleinern", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Zoom und Navigation" }),
    ).toHaveText("100 %");
  });
  test("A15 · Leertaste und Ziehen verschiebt die Ansicht", async () => {
    await page.mouse.click(1150, 750);
    const before = await node("rect").boundingBox(),
      toolbar = await page.locator(".toolrail").boundingBox();
    await page.keyboard.down("Space");
    await drag(1150, 750, 1230, 820);
    await page.keyboard.up("Space");
    const after = await node("rect").boundingBox();
    expect(after!.x - before!.x).toBeCloseTo(80);
    expect(after!.y - before!.y).toBeCloseTo(70);
    expect(await page.locator(".toolrail").boundingBox()).toEqual(toolbar);
    await expect(
      page.getByRole("button", { name: "Zoom und Navigation" }),
    ).toHaveText("100 %");
    await expect(page.locator("#grid")).toHaveAttribute("x", "80");
  });
  test("A16 · Auswahl erscheint und verschwindet", async () => {
    await node("note").click();
    await expect(page.getByTestId("selection")).toHaveCount(1);
    await page.mouse.click(1250, 800);
    await expect(page.getByTestId("selection")).toHaveCount(0);
    await page.screenshot({ path: "test-results/acceptance-final.png" });
  });
});

test.describe("Ergänzende Prüfungen", () => {
  test.beforeEach(async ({ page: p }) => {
    if (process.env.WHITEBOARD_STATIC_TEST) await staticRoute(p);
    await p.goto("/board");
    await expect(
      p.getByRole("button", { name: "Erste Notiz anlegen" }),
    ).toBeVisible();
  });
  test("lokales Speichern und Wiederherstellen nach Neuladen", async ({
    page: p,
  }) => {
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("Bleibt erhalten");
    await p.keyboard.press("Escape");
    await expect(p.getByRole("status")).toContainText("Lokal gespeichert");
    await p.reload();
    await expect(p.getByTestId("board-node")).toHaveText("Bleibt erhalten");
  });
  test("laufende Texteingabe wird vor Escape gespeichert", async ({
    page: p,
  }) => {
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("Noch im Editor");
    await expect(p.getByRole("status")).toContainText("Lokal gespeichert");
    await p.reload();
    await expect(p.getByTestId("board-node")).toHaveText("Noch im Editor");
  });
  test("Textänderung rückgängig und erneut ausführen", async ({ page: p }) => {
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("Vorher");
    await p.keyboard.press("Escape");
    await p.getByTestId("board-node").dblclick();
    await p
      .getByRole("textbox", { name: "Objekttext bearbeiten" })
      .selectText();
    await p.keyboard.insertText("Nachher");
    await p.keyboard.press("Escape");
    await p.keyboard.press("ControlOrMeta+z");
    await expect(p.getByTestId("board-node")).toHaveText("Vorher");
    await p.keyboard.press("ControlOrMeta+Shift+z");
    await expect(p.getByTestId("board-node")).toHaveText("Nachher");
  });
  test("JSON-Export und Import", async ({ page: p }) => {
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("Sicherung");
    await p.keyboard.press("Escape");
    const download = p.waitForEvent("download");
    await p.getByRole("button", { name: "Exportieren" }).click();
    const d = await download;
    const loc = await d.path();
    const data = JSON.parse(fs.readFileSync(loc!, "utf8"));
    expect(data.nodes[0].text).toBe("Sicherung");
    data.nodes[0].text = "Importiert";
    await p.locator("input[type=file]").setInputFiles({
      name: "board.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
    await expect(p.getByTestId("board-node")).toHaveText("Importiert");
    await p
      .getByRole("button", { name: "Rückgängig machen", exact: true })
      .click();
    await expect(p.getByTestId("board-node")).toHaveText("Sicherung");
  });
  test("ungültiger Import erhält das Board", async ({ page: p }) => {
    await p.locator("input[type=file]").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":2}'),
    });
    await expect(p.getByRole("alert")).toContainText("Import fehlgeschlagen");
    await expect(p.getByTestId("board-node")).toHaveCount(0);
  });
  test("Oval und Raute", async ({ page: p }) => {
    for (const label of ["Oval", "Raute"]) {
      await p.getByRole("button", { name: "Formen und Linien" }).click();
      await p.getByRole("button", { name: label, exact: true }).click();
      await p.mouse.move(300, 300);
      await p.mouse.down();
      await p.mouse.move(500, 430, { steps: 10 });
      await p.mouse.up();
    }
    await expect(p.getByTestId("board-node")).toHaveCount(2);
    await expect(p.locator("[data-kind=ellipse]")).toHaveCount(1);
    await expect(p.locator("[data-kind=diamond]")).toHaveCount(1);
    await expect(p.getByTestId("board-canvas")).toBeVisible();
  });
  test("keine Browserfehler beim Anlegen und Bearbeiten", async ({
    page: p,
  }) => {
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.getByRole("button", { name: "Erste Notiz anlegen" }).click();
    await p.mouse.click(300, 300);
    await p.keyboard.insertText("ÄÖÜ – 日本語");
    await p.keyboard.press("Escape");
    await expect(p.getByTestId("board-node")).toHaveText("ÄÖÜ – 日本語");
    expect(errors).toEqual([]);
  });
});
