const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");
const load = (file, deps = {}) => {
  const filename = path.resolve(file),
    m = new Module(filename, module);
  m.paths = module.paths;
  const req = m.require.bind(m);
  m.require = (id) => deps[id] ?? req(id);
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    filename,
  );
  return m.exports;
};
const d = load("lib/document.ts"),
  i = load("lib/interactions.ts", { "./document": d });
const source = {
  id: "a",
  kind: "note",
  x: 300,
  y: 300,
  w: 100,
  h: 100,
  text: "Quelle",
  fill: "#ffb575",
  bold: true,
};
const ref = { ...source, id: "b", x: 700, y: 500, w: 200, h: 180 };
test("Schnellerstellung ist leer, erhält Stil und richtet alle vier Kindpositionen aus", () => {
  for (const side of i.sides) {
    const n = i.quickNode(source, side, "child");
    assert.equal(n.text, "");
    assert.equal(n.bold, true);
    assert.equal(n.fill, source.fill);
    assert.equal(n.w, source.w);
    assert.equal(n.h, source.h);
    assert.notEqual(n.id, source.id);
    assert.deepEqual(source.text, "Quelle");
    if (side === "right") assert.equal(n.x, 516);
    if (side === "left") assert.equal(n.x, 84);
    if (side === "top") assert.equal(n.y, 52);
    if (side === "bottom") assert.equal(n.y, 548);
  }
});
test("Verbindungspunktabstand bleibt über 50/100/200 Prozent bedienbar", () => {
  for (const zoom of [0.5, 1, 2]) {
    const p = i.anchorPoint(source, "right", zoom);
    assert.equal((p.x - source.x - source.w) * zoom, 18 + 4 * zoom);
    assert.equal(p.y, 350);
  }
});
test("Menüerstellung verankert die gewählte Objektkante am freien Endpunkt", () => {
  for (const side of i.sides) {
    const n = i.placeAtEndpoint(source, side, { x: 500, y: 200 }, "child");
    const doc = { ...d.emptyDocument(), nodes: [n] };
    assert.deepEqual(
      d.endpoint({ nodeId: n.id, side, point: { x: 0, y: 0 } }, doc),
      { x: 500, y: 200 },
    );
  }
});
test("Zielsuche ignoriert die Quelle, wählt vorderes gültiges Ziel und nutzt Screen-Toleranz", () => {
  const target = { ...source, id: "target", x: 600, y: 300 },
    doc = { ...d.emptyDocument(), nodes: [source, target] };
  assert.equal(
    i.connectionTarget(doc, { x: 350, y: 350 }, source.id, 1).nodeId,
    undefined,
  );
  for (const z of [0.5, 1, 2]) {
    assert.equal(
      i.connectionTarget(doc, { x: 600 - 7 / z, y: 350 }, source.id, z).nodeId,
      "target",
    );
    assert.equal(
      i.connectionTarget(doc, { x: 600 - 9 / z, y: 350 }, source.id, z).nodeId,
      undefined,
    );
  }
});
test("Notizskalierung projiziert horizontale und vertikale Griffbewegung proportional", () => {
  assert.deepEqual(i.resizeBox(source, "se", { x: 100, y: 0 }, true), {
    x: 300,
    y: 300,
    w: 150,
    h: 150,
  });
  assert.deepEqual(i.resizeBox(source, "se", { x: 0, y: 100 }, true), {
    x: 300,
    y: 300,
    w: 150,
    h: 150,
  });
  assert.deepEqual(i.resizeBox(source, "nw", { x: -100, y: -100 }, true), {
    x: 200,
    y: 200,
    w: 200,
    h: 200,
  });
  assert.deepEqual(i.resizeBox(source, "se", { x: 100, y: 20 }, false), {
    x: 300,
    y: 300,
    w: 200,
    h: 120,
  });
});
test("Breite und Höhe vergleichen getrennt; beide passenden Maße ergeben beide Marker", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  for (const [w, h, axes] of [
    [200, 145, ["width"]],
    [170, 180, ["height"]],
    [200, 180, ["width", "height"]],
  ]) {
    const r = i.resizeGuides({ x: 0, y: 0, w, h }, b, "se", [ref], 1, false);
    assert.deepEqual(
      r.guides.filter((g) => g.kind === "size").map((g) => g.axis),
      axes,
    );
  }
});
test("Rast- und Einblendtoleranz werden aus Bildschirm-Pixeln umgerechnet", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  for (const z of [0.5, 1, 2]) {
    let r = i.resizeGuides(
      { x: 0, y: 0, w: 200 - 2 / z, h: 140 },
      b,
      "se",
      [ref],
      z,
      false,
    );
    assert.equal(r.box.w, 200);
    assert.equal(
      r.guides.find((g) => g.kind === "size" && g.axis === "width").snapped,
      true,
    );
    r = i.resizeGuides(
      { x: 0, y: 0, w: 200 - 5 / z, h: 140 },
      b,
      "se",
      [ref],
      z,
      false,
    );
    assert.equal(r.box.w, 200 - 5 / z);
    assert.ok(r.guides.some((g) => g.kind === "size" && g.axis === "width"));
    r = i.resizeGuides(
      { x: 0, y: 0, w: 200 - 7 / z, h: 140 },
      b,
      "se",
      [ref],
      z,
      false,
    );
    assert.ok(!r.guides.some((g) => g.kind === "size" && g.axis === "width"));
  }
});
test("Nur sichtbare unselektierte Objekte dienen als Größenreferenz; keine Verbindungen", () => {
  const off = { ...ref, id: "off", x: 4000 },
    doc = { ...d.emptyDocument(), nodes: [source, ref, off] };
  assert.deepEqual(
    i
      .visibleReferences(doc, ["a"], { x: 0, y: 0, w: 1400, h: 1000 })
      .map((n) => n.id),
    ["b"],
  );
});
test("Positionsausrichtung erzeugt keine Größenmarker und rastet unabhängig ein", () => {
  const r = i.alignMove({ x: 698, y: 200, w: 100, h: 100 }, [ref], 1);
  assert.equal(r.dx, 2);
  assert.ok(r.guides.every((g) => g.kind === "position"));
});

test("Mehrere passende Vergleichsobjekte werden gleichzeitig markiert", () => {
  const refs = [ref, { ...ref, id: "c", x: 1000, h: 150 }];
  const r = i.resizeGuides(
    { x: 0, y: 0, w: 200, h: 180 },
    { x: 0, y: 0, w: 100, h: 100 },
    "se",
    refs,
    1,
    false,
  );
  assert.equal(
    r.guides.filter((g) => g.kind === "size" && g.axis === "width").length,
    2,
  );
  assert.equal(
    r.guides.filter((g) => g.kind === "size" && g.axis === "height").length,
    1,
  );
});

test('Ein vorher erstellter freier Pfeil verbindet sich nachträglich mit einer Notiz',()=>{
 const edge={id:'arrow',from:{point:{x:100,y:100}},to:{point:{x:400,y:100}},style:'curve',color:'#4262ff',labels:[{id:'label',text:'Verknüpfung',position:.5}]};
 const note={...source,id:'late',x:600,y:300};
 const doc={...d.emptyDocument(),nodes:[note],edges:[edge]};
 const result=i.reconnectEndpoint(doc,'arrow','to',{x:650,y:350},1);
 assert.equal(result.targetId,'late');assert.equal(result.doc.edges[0].to.nodeId,'late');assert.equal(result.doc.edges[0].to.binding,'auto');
 assert.deepEqual(result.doc.edges[0].from,edge.from);assert.deepEqual(result.doc.edges[0].labels,edge.labels);assert.equal(result.doc.edges[0].color,edge.color);
 assert.equal(doc.edges[0].to.nodeId,undefined);
});
test('Beide Pfeilenden lassen sich umhängen und in der leeren Fläche wieder lösen',()=>{
 const a={...source,id:'a'},b={...source,id:'b',x:600},c={...source,id:'c',x:900};
 const edge={id:'arrow',from:{nodeId:'a',binding:'auto',point:{x:350,y:350}},to:{nodeId:'b',binding:'auto',point:{x:650,y:350}}};
 const doc={...d.emptyDocument(),nodes:[a,b,c],edges:[edge]};
 const changed=i.reconnectEndpoint(doc,'arrow','from',{x:950,y:350},1);
 assert.equal(changed.doc.edges[0].from.nodeId,'c');assert.equal(changed.doc.edges[0].to.nodeId,'b');
 const detached=i.reconnectEndpoint(changed.doc,'arrow','to',{x:800,y:600},1);
 assert.deepEqual(detached.doc.edges[0].to,{point:{x:800,y:600}});assert.equal(detached.targetId,undefined);
});
test('Nachträgliches Verbinden berücksichtigt Zoom und verhindert Verbindungen mit sich selbst',()=>{
 const n={...source,id:'target',x:600};
 const doc={...d.emptyDocument(),nodes:[n],edges:[{id:'e',from:{point:{x:100,y:100}},to:{point:{x:300,y:100}}}]};
 for(const zoom of [.5,1,2]){
  assert.equal(i.reconnectEndpoint(doc,'e','to',{x:600-7/zoom,y:350},zoom).targetId,'target');
  assert.equal(i.reconnectEndpoint(doc,'e','to',{x:600-9/zoom,y:350},zoom).targetId,undefined);
 }
 const attached=i.reconnectEndpoint(doc,'e','to',{x:650,y:350},1).doc;
 assert.equal(i.reconnectEndpoint(attached,'e','from',{x:650,y:350},1).targetId,undefined);
 assert.equal(i.reconnectEndpoint(doc,'missing','to',{x:650,y:350},1).doc,doc);
});
