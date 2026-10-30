import { test, expect } from "./fixtures";
const nodes = [
  { id: "a", kind: "note", x: 250, y: 200, w: 150, h: 150, text: "Idee A", fill: "#fff0a6" },
  { id: "b", kind: "note", x: 250, y: 600, w: 150, h: 150, text: "Idee B", fill: "#81e7de" },
  { id: "t", kind: "note", x: 900, y: 400, w: 150, h: 150, text: "Ziel", fill: "#fd9ae7" },
];

test("Zwei sichtbare Anschlussgriffe erzeugen getrennte Pfeile zur selben Zielnotiz", async ({ page, request }) => {
  const result = await request.post("/api/boards", { data: { action: "create", doc: { version: 1, title: "Pfeilanordnung", nodes, edges: [] } } });
  const s = await result.json(), headers = { Authorization: `Bearer ${s.token}` };
  try {
    await page.goto(`/board?board=${s.id}#token=${s.token}`);
    await expect(page.getByTestId("board-node")).toHaveCount(3);
    for (const id of ["a", "b"]) {
      await page.locator(`[data-id="${id}"]`).click();
      const box = (await page.getByTestId("connection-right").boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(975, 475, { steps: 12 }); await page.mouse.up();
    }
    await expect(page.getByTestId("edge")).toHaveCount(2);
    const ports = await page.getByTestId("edge-path").evaluateAll(paths => paths.map(element => {
      const path = element as SVGPathElement, length = path.getTotalLength(), end = path.getPointAtLength(length), before = path.getPointAtLength(length - 1);
      return { x: end.x, y: end.y, angle: Math.atan2(end.y - before.y, end.x - before.x) };
    }));
    expect(ports.every(p => p.x === 900 && Math.abs(p.angle) < .001)).toBeTruthy();
    expect(Math.abs(ports[0].y - ports[1].y)).toBeGreaterThan(30);
    await expect.poll(async () => (await (await request.get(`/api/boards?id=${s.id}`, { headers })).json()).doc.edges.length).toBe(2);
    await page.reload();
    await expect(page.getByTestId("edge")).toHaveCount(2);
    const saved = (await (await request.get(`/api/boards?id=${s.id}`, { headers })).json()).doc;
    expect(saved.edges.every((edge: { from: { binding: string }; to: { binding: string } }) => edge.from.binding === "fixed" && edge.to.binding === "auto")).toBeTruthy();
  } finally { await request.post(`/api/boards?id=${s.id}`, { headers, data: { action: "delete" } }); }
});

test("Alte Verbindungen mit gleichem Zielanker werden automatisch geordnet", async ({ page, request }) => {
  const edges = ["a", "b"].map((id, i) => ({
    id: `e${i}`, style: "elbow", from: { nodeId: id, side: "right", point: { x: 400, y: nodes[i].y + 75 } },
    to: { nodeId: "t", side: "top", point: { x: 975, y: 400 } },
  }));
  const result = await request.post("/api/boards", { data: { action: "create", doc: { version: 1, title: "Alte Verbindungen", nodes, edges } } });
  const s = await result.json(), headers = { Authorization: `Bearer ${s.token}` };
  try {
    await page.goto(`/board?board=${s.id}#token=${s.token}`);
    await expect(page.getByTestId("edge")).toHaveCount(2);
    const ends = await page.getByTestId("edge-path").evaluateAll(paths => paths.map(element => {
      const path = element as SVGPathElement, point = path.getPointAtLength(path.getTotalLength()); return { x: point.x, y: point.y };
    }));
    expect(ends[0].x).toBe(900); expect(ends[1].x).toBe(900); expect(ends[0].y).toBeLessThan(ends[1].y);
    // Stored legacy anchors need no document migration or destructive rewrite.
    const saved = (await (await request.get(`/api/boards?id=${s.id}`, { headers })).json()).doc;
    expect(saved.edges.map((e: { to: { side: string } }) => e.to.side)).toEqual(["top", "top"]);
  } finally { await request.post(`/api/boards?id=${s.id}`, { headers, data: { action: "delete" } }); }
});
