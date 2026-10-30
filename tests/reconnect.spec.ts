import { test, expect } from "./fixtures";

test("Ein früher angelegter Pfeil verbindet sich nachträglich mit einer Notiz", async ({ page, request }) => {
  const created = await request.post("/api/boards", { data: { action: "create", doc: { version: 1, title: "Nachträglich verbinden", nodes: [], edges: [] } } });
  const s = await created.json(), headers = { Authorization: `Bearer ${s.token}` };
  const read = async () => (await (await request.get(`/api/boards?id=${s.id}`, { headers })).json()).doc;
  try {
    await page.goto(`/board?board=${s.id}#token=${s.token}`);
    await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeEnabled();
    await page.getByRole("application").focus();
    await page.keyboard.press("l");
    await page.mouse.move(350, 300); await page.mouse.down(); await page.mouse.move(650, 300, { steps: 8 }); await page.mouse.up();
    await page.mouse.dblclick(500, 300);
    await page.getByLabel("Verbindungstext bearbeiten").fill("Vorhandener Text"); await page.keyboard.press("Enter");
    await page.keyboard.press("n"); await page.mouse.click(900, 350);
    await page.getByLabel("Objekttext bearbeiten").fill("Später erstellte Notiz"); await page.keyboard.press("Escape");
    await expect.poll(async () => (await read()).nodes.length).toBe(1);
    const noteId = (await read()).nodes[0].id;
    await page.mouse.click(400, 300);
    const handle = (await page.getByTestId("edge-endpoint-to").boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(900, 350, { steps: 12 });
    await expect(page.getByTestId("connection-target")).toBeVisible(); await page.mouse.up();
    await expect.poll(async () => (await read()).edges[0].to.nodeId).toBe(noteId);
    expect((await read()).edges[0].labels[0].text).toBe("Vorhandener Text");
    await page.getByRole("button", { name: "Rückgängig machen", exact: true }).click();
    await expect.poll(async () => (await read()).edges[0].to.nodeId).toBeUndefined();
    expect((await read()).nodes).toHaveLength(1);
    await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
    await expect.poll(async () => (await read()).edges[0].to.nodeId).toBe(noteId);
    // Attached handles remain above the note's hit region and can be detached.
    await page.mouse.click(400, 300);
    const attached = (await page.getByTestId("edge-endpoint-to").boundingBox())!;
    await page.mouse.move(attached.x + attached.width / 2, attached.y + attached.height / 2); await page.mouse.down();
    await page.mouse.move(1100, 700, { steps: 12 }); await page.mouse.up();
    await expect.poll(async () => (await read()).edges[0].to.nodeId).toBeUndefined();
    expect((await read()).edges[0].labels[0].text).toBe("Vorhandener Text");
  } finally { await request.post(`/api/boards?id=${s.id}`, { headers, data: { action: "delete" } }); }
});
