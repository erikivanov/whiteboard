import { authenticateContext } from "./auth-support";
import { test, expect } from "./fixtures";

const fixture = {
  version: 1, title: "Beschriftete Verbindungen",
  nodes: [
    { id: "source", kind: "rect", x: 150, y: 250, w: 150, h: 100, text: "Start", fill: "#fff0a6" },
    { id: "target", kind: "rect", x: 850, y: 250, w: 150, h: 100, text: "Ziel", fill: "#81e7de" },
  ],
  edges: [{ id: "line", style: "straight", from: { nodeId: "source", side: "right", point: { x: 300, y: 300 } }, to: { nodeId: "target", side: "left", point: { x: 850, y: 300 } } }],
};

test("Verbindungstexte bearbeiten, verschieben, löschen und wiederherstellen", async ({ page, request }) => {
  const created = await request.post("/api/boards", { data: { action: "create", doc: fixture } });
  const s = await created.json();
  const auth = { Authorization: `Bearer ${s.token}` };
  try {
    await page.goto(`/board?board=${s.id}#token=${s.token}`);
    await expect(page.getByTestId("edge")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeEnabled();
    await page.mouse.dblclick(575, 300);
    await page.getByLabel("Verbindungstext bearbeiten").fill("führt zum Ziel");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("edge-label")).toHaveText("führt zum Ziel");
    await page.getByRole("button", { name: "Verbindungstext hinzufügen", exact: true }).click();
    await page.getByLabel("Verbindungstext bearbeiten").fill("zweite Beschriftung\nzweite Zeile");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("edge-label")).toHaveCount(2);
    const second = page.getByTestId("edge-label").filter({ hasText: "zweite Beschriftung" });
    const box = (await second.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(760, 300, { steps: 12 }); await page.mouse.up();
    const moved = (await second.boundingBox())!;
    expect(moved.x - box.x).toBeGreaterThan(100);
    await page.getByLabel("Schriftgröße der Beschriftung").selectOption("24");
    await page.getByLabel("Textfarbe der Beschriftung").fill("#4262ff");
    await page.getByRole("button", { name: "Beschriftung löschen", exact: true }).click();
    await expect(page.getByTestId("edge-label")).toHaveCount(1);
    await expect(page.getByTestId("edge")).toHaveCount(1);
    await page.getByRole("button", { name: "Rückgängig machen", exact: true }).click();
    await expect(page.getByTestId("edge-label")).toHaveCount(2);
    await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
    await expect(page.getByTestId("edge-label")).toHaveCount(1);
    await expect.poll(async () => {
      const response = await request.get(`/api/boards?id=${s.id}`, { headers: auth });
      return (await response.json()).doc.edges[0].labels.length;
    }).toBe(1);
    await page.reload();
    await expect(page.getByTestId("edge-label")).toHaveText("führt zum Ziel");
    // Duplicate the entire connection; labels need fresh IDs as well.
    await page.mouse.click(420, 300);
    await page.keyboard.press("ControlOrMeta+d");
    await expect(page.getByTestId("edge")).toHaveCount(2);
    await expect.poll(async () => {
      const response = await request.get(`/api/boards?id=${s.id}`, { headers: auth });
      const doc = (await response.json()).doc;
      return { edges: doc.edges.length, labels: new Set(doc.edges.flatMap((edge: { labels: { id: string }[] }) => edge.labels.map(label => label.id))).size };
    }).toEqual({ edges: 2, labels: 2 });
  } finally { await request.post(`/api/boards?id=${s.id}`, { headers: auth, data: { action: "delete" } }); }
});

test("Gasttexte synchronisieren; Ansichtsrechte schützen auch Verbindungsbeschriftungen", async ({ browser, request, baseURL }) => {
  const doc = { ...fixture, edges: [{ ...fixture.edges[0], labels: [{ id: "caption", text: "Eine Beziehung", position: .5 }] }] };
  const response = await request.post("/api/boards", { data: { action: "create", doc } });
  const s = await response.json();
  const owner = await browser.newContext(), guest = await browser.newContext();
  await authenticateContext(owner,baseURL);
  const a = await owner.newPage(), b = await guest.newPage();
  const auth = { Authorization: `Bearer ${s.token}` };
  try {
    await a.goto(`${baseURL}/board?board=${s.id}#token=${s.token}`);
    await b.goto(`${baseURL}/board?board=${s.id}#token=${s.shareToken}`);
    await expect(b.getByTestId("edge-label")).toHaveText("Eine Beziehung");
    await b.getByTestId("edge-label").dblclick();
    await expect(b.getByLabel("Verbindungstext bearbeiten")).toHaveCount(0);
    await request.post(`/api/boards?id=${s.id}`, { headers: auth, data: { action: "sharing", role: "edit" } });
    await expect(b.getByLabel("Boardname")).not.toHaveAttribute("readonly");
    await b.getByTestId("edge-label").dblclick();
    await b.getByLabel("Verbindungstext bearbeiten").fill("Vom Gast ergänzt");
    await b.keyboard.press("Enter");
    await expect(a.getByTestId("edge-label")).toHaveText("Vom Gast ergänzt");
    await request.post(`/api/boards?id=${s.id}`, { headers: auth, data: { action: "sharing", role: "view" } });
    await expect(b.getByLabel("Boardname")).toHaveAttribute("readonly", "");
    await b.getByTestId("edge-label").dblclick();
    await expect(b.getByLabel("Verbindungstext bearbeiten")).toHaveCount(0);
  } finally {
    await request.post(`/api/boards?id=${s.id}`, { headers: auth, data: { action: "delete" } });
    await owner.close(); await guest.close();
  }
});
