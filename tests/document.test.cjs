const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const filename = require("node:path").resolve("lib/document.ts");
const compiled = new Module(filename, module);
compiled._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  filename,
);
const { emptyDocument, attach, endpoint, edgePath, bounds, parseDocument } =
  compiled.exports;
const fixture = () => ({
  ...emptyDocument(),
  nodes: [
    {
      id: "a",
      kind: "note",
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      text: "Idee",
      fill: "#fff0a6",
    },
    {
      id: "b",
      kind: "rect",
      x: 400,
      y: 130,
      w: 200,
      h: 120,
      text: "Ziel",
      fill: "transparent",
    },
  ],
  edges: [
    {
      id: "e",
      from: { nodeId: "a", side: "right", point: { x: 200, y: 150 } },
      to: { nodeId: "b", side: "left", point: { x: 400, y: 190 } },
    },
  ],
});
test("Verbindung behält beim Verschieben und Skalieren den Randanker", () => {
  const d = fixture(),
    before = edgePath(d.edges[0], d);
  d.nodes[1] = { ...d.nodes[1], x: 500, y: 250, w: 280, h: 170 };
  assert.deepEqual(endpoint(d.edges[0].to, d), { x: 500, y: 335 });
  assert.deepEqual(endpoint(d.edges[0].from, d), { x: 200, y: 150 });
  assert.notEqual(edgePath(d.edges[0], d), before);
  assert.ok(edgePath(d.edges[0], d).endsWith("500 335"));
});
test("Anheften nutzt den nächstgelegenen Objektrand, freier Endpunkt bleibt frei", () => {
  const d = fixture();
  for (const [p, side] of [
    [{ x: 99, y: 150 }, "left"],
    [{ x: 201, y: 150 }, "right"],
    [{ x: 150, y: 99 }, "top"],
    [{ x: 150, y: 201 }, "bottom"],
  ]) {
    const ep = attach(p, d);
    assert.equal(ep.nodeId, "a");
    assert.equal(ep.side, side);
  }
  assert.deepEqual(attach({ x: 800, y: 800 }, d), {
    point: { x: 800, y: 800 },
  });
});
test("Gemeinsamer Auswahlrahmen enthält Objekte und angeschlossene Linie", () => {
  const d = fixture();
  assert.deepEqual(bounds(d, ["a", "b", "e"]), {
    x: 100,
    y: 100,
    w: 500,
    h: 150,
  });
  assert.equal(bounds(d, []), null);
});
test("Gemeinsame Translation erhält relative Abstände und verbundene Endpunkte", () => {
  const d = fixture(),
    a = endpoint(d.edges[0].from, d),
    b = endpoint(d.edges[0].to, d);
  const moved = {
    ...d,
    nodes: d.nodes.map((n) => ({ ...n, x: n.x + 40, y: n.y + 60 })),
  };
  const aa = endpoint(moved.edges[0].from, moved),
    bb = endpoint(moved.edges[0].to, moved);
  assert.equal(bb.x - aa.x, b.x - a.x);
  assert.equal(bb.y - aa.y, b.y - a.y);
  assert.deepEqual(aa, { x: a.x + 40, y: a.y + 60 });
});
test("JSON-Rundlauf bewahrt Dokumentdaten einschließlich mehrzeiligem Text", () => {
  const d = fixture();
  d.nodes[0].text = "ÄÖÜ\n日本語";
  assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(d))), d);
});
test("Import weist defekte Geometrie, doppelte IDs und verwaiste Verbindungen zurück", () => {
  for (const change of [
    (d) => {
      d.nodes[0].w = -1;
    },
    (d) => {
      d.nodes[0].x = NaN;
    },
    (d) => {
      d.nodes[1].id = "a";
    },
    (d) => {
      d.edges[0].id = "a";
    },
    (d) => {
      d.edges[0].to.nodeId = "fehlt";
    },
    (d) => {
      d.version = 2;
    },
    (d) => {
      d.nodes[0].fontSize = -2;
    },
    (d) => {
      d.nodes[0].align = "diagonal";
    },
    (d) => {
      d.edges[0].style = "unknown";
    },
    (d) => {
      d.edges[0].arrow = "yes";
    },
  ]) {
    const d = fixture();
    change(d);
    assert.throws(() => parseDocument(d));
  }
});

test("Dreieckverbindungen liegen auf der sichtbaren schrägen Kante", () => {
  const d = fixture();
  d.nodes[1].kind = "triangle";
  assert.deepEqual(endpoint(d.edges[0].to, d), { x: 450, y: 190 });
  d.nodes[1].w = 400;
  assert.deepEqual(endpoint(d.edges[0].to, d), { x: 500, y: 190 });
});

test("Verbindungsbeschriftungen bleiben auf geraden, gebogenen und gewinkelten Linien", () => {
  const { edgePointAt, edgePositionAt } = compiled.exports;
  for (const style of ["straight", "curve", "elbow"]) {
    const doc = fixture(), edge = { ...doc.edges[0], style };
    for (const position of [.1, .3, .5, .8, .95]) {
      const p = edgePointAt(edge, doc, position);
      assert.ok(Math.abs(edgePositionAt(edge, doc, p) - position) < .001, `${style} at ${position}`);
    }
  }
});
test("Gewinkelte Beschriftungen nutzen die Länge der Linie statt der Endpunktdiagonale", () => {
  const { edgePointAt } = compiled.exports;
  const doc = { version: 1, title: "", nodes: [], edges: [] };
  const edge = {id:"e",style:"elbow",from:{side:"bottom",point:{x:0,y:0}},to:{point:{x:300,y:100}}};
  assert.deepEqual(edgePointAt(edge,doc,.5),{x:150,y:50});
  assert.deepEqual(edgePointAt(edge,doc,.125),{x:0,y:50});
});
test("Beschriftungen folgen bewegten Randankern, und die Auswahl enthält den Text", () => {
  const { edgeLabelLayout, edgePointAt } = compiled.exports;
  const doc=fixture(), edge=doc.edges[0];
  edge.labels=[{id:"label",text:"Eine lange Beschriftung\nmit zweiter Zeile",position:.5,fontSize:24}];
  const first=edgePointAt(edge,doc,.5);
  doc.nodes[1].x+=200;doc.nodes[1].y+=100;
  const next=edgePointAt(edge,doc,.5);
  assert.notDeepEqual(first,next);
  const label=edgeLabelLayout(edge,edge.labels[0],doc),box=bounds(doc,[edge.id]);
  assert.ok(box.x<=label.x && box.y<=label.y && box.x+box.w>=label.x+label.w && box.y+box.h>=label.y+label.h);
  assert.ok(label.lines.length>=2);
});
test("JSON erhält mehrere Beschriftungen einschließlich Position, Schriftgröße und Farbe", () => {
  const doc=fixture();doc.edges[0].labels=[{id:"l1",text:"Ja",position:.25},{id:"l2",text:"ÄÖÜ – 日本語\nNein",position:.75,fontSize:24,color:"#4262ff"}];
  assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(doc))),doc);
});
test("Ungültige oder doppelte Beschriftungsdaten werden vor dem Speichern verworfen", () => {
  for(const label of [
    {id:"a",text:"Konflikt mit Knoten",position:.5},
    {id:"l",text:"",position:-.1},
    {id:"l",text:"",position:1.1},
    {id:"l",text:"",position:NaN},
    {id:"l",text:12,position:.5},
    {id:"l",text:"",position:.5,fontSize:0},
    {id:"l",text:"",position:.5,color:10},
  ]) {const doc=fixture();doc.edges[0].labels=[label];assert.throws(()=>parseDocument(doc));}
  const doc=fixture();doc.edges[0].labels=[{id:"l",text:"A",position:.2},{id:"l",text:"B",position:.7}];assert.throws(()=>parseDocument(doc));
});
test("Null-Längen und lange Wörter ergeben endliche Beschriftungskoordinaten", () => {
  const { edgePointAt, edgePositionAt, edgeLabelLayout }=compiled.exports;
  const doc={version:1,title:"",nodes:[],edges:[]};
  const edge={id:"e",style:"straight",from:{point:{x:15,y:20}},to:{point:{x:15,y:20}}};
  assert.deepEqual(edgePointAt(edge,doc,.5),{x:15,y:20});assert.equal(edgePositionAt(edge,doc,{x:10,y:10}),.5);
  const label=edgeLabelLayout(edge,{id:"l",text:"W".repeat(200),fontSize:32,position:.5},doc);
  assert.ok([label.x,label.y,label.w,label.h].every(Number.isFinite));assert.ok(label.lines.length>1);
});

const routingFixture=(style='elbow')=>({version:1,title:'Zwei auf eine Notiz',nodes:[
 {id:'s1',kind:'note',x:200,y:200,w:100,h:100,text:'A',fill:'#fff0a6'},
 {id:'s2',kind:'note',x:200,y:500,w:100,h:100,text:'B',fill:'#81e7de'},
 {id:'t',kind:'note',x:700,y:350,w:100,h:100,text:'Ziel',fill:'#fd9ae7'}],edges:[
 {id:'e1',style,from:{nodeId:'s1',side:'right',point:{x:300,y:250}},to:{nodeId:'t',side:'top',point:{x:750,y:350}}},
 {id:'e2',style,from:{nodeId:'s2',side:'right',point:{x:300,y:550}},to:{nodeId:'t',side:'top',point:{x:750,y:350}}}]});
const inside=(p,n)=>p.x>n.x+.001&&p.x<n.x+n.w-.001&&p.y>n.y+.001&&p.y<n.y+n.h-.001;
test('Zwei Pfeile auf dieselbe Notiz haben getrennte geordnete Anschlüsse auf der passenden Seite',()=>{
 const {connectionGeometry}=compiled.exports;
 for(const style of ['straight','curve','elbow']){
  const doc=routingFixture(style),a=connectionGeometry(doc.edges[0],doc),b=connectionGeometry(doc.edges[1],doc);
  assert.equal(a.toSide,'left');assert.equal(b.toSide,'left');assert.equal(a.to.x,700);assert.equal(b.to.x,700);
  assert.ok(a.to.y<b.to.y && a.to.y>350 && b.to.y<450);
  assert.ok(Math.hypot(a.to.x-b.to.x,a.to.y-b.to.y)>20);
  assert.ok(a.points.every(p=>!doc.nodes.some(n=>inside(p,n))));assert.ok(b.points.every(p=>!doc.nodes.some(n=>inside(p,n))));
 }
});
test('Anschlussreihenfolge ist unabhängig von der Speicherreihenfolge der Verbindungen',()=>{
 const {connectionGeometry}=compiled.exports,doc=routingFixture();
 const first=doc.edges.map(e=>connectionGeometry(e,doc).to);
 doc.edges.reverse();assert.deepEqual(doc.edges.map(e=>connectionGeometry(e,doc).to).reverse(),first);
});
test('Automatische Verbindungen wechseln nach dem Verschieben die Anschlussseite',()=>{
 const {connectionGeometry}=compiled.exports,doc=routingFixture();
 assert.equal(connectionGeometry(doc.edges[0],doc).toSide,'left');
 doc.nodes[2].x=250;doc.nodes[2].y=0;
 for(const edge of doc.edges){const route=connectionGeometry(edge,doc);assert.equal(route.fromSide,'top');assert.equal(route.toSide,'bottom');assert.ok(route.points.every(p=>!doc.nodes.some(n=>inside(p,n))));}
});
test('Bewusst gewählte feste Seiten bleiben erhalten und Pfeilspitzen folgen dem tatsächlichen Endsegment',()=>{
 const {connectionGeometry}=compiled.exports,doc=routingFixture();doc.edges=doc.edges.slice(0,1);
 doc.edges[0].from.binding='fixed';doc.edges[0].to.binding='fixed';
 const route=connectionGeometry(doc.edges[0],doc);assert.equal(route.fromSide,'right');assert.equal(route.toSide,'top');
 assert.ok(Math.abs(route.arrowAngle-Math.PI/2)<.0001);
 const last=route.points.at(-1),before=route.points.at(-2);assert.equal(last.x,before.x);assert.ok(last.y>before.y);
});
test('Gewinkelte und gebogene Verbindungen umgehen eine dazwischenliegende Notiz',()=>{
 const {connectionGeometry}=compiled.exports;
 for(const style of ['elbow','curve']){
  const doc=routingFixture(style);doc.edges=doc.edges.slice(0,1);doc.nodes[2].x=850;doc.nodes[2].y=200;
  const block={...doc.nodes[1],x:470,y:130,w:180,h:300};doc.nodes[1]=block;
  const route=connectionGeometry(doc.edges[0],doc);
  assert.ok(route.points.length>=4);assert.ok(route.points.every(p=>!doc.nodes.some(n=>inside(p,n))));
  assert.ok(route.points.some(p=>p.y<=block.y||p.y>=block.y+block.h));
 }
});
test('Gleichseitige Fan-in-Pfeile teilen sich keine langen Liniensegmente',()=>{
 const {connectionGeometry}=compiled.exports,doc=routingFixture();doc.nodes[0].y=100;doc.nodes[1].y=220;doc.nodes[2].y=500;
 const a=connectionGeometry(doc.edges[0],doc).points,b=connectionGeometry(doc.edges[1],doc).points;
 for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const x=a[i-1],y=a[i],u=b[j-1],v=b[j];
  if(x.x===y.x&&u.x===v.x&&x.x===u.x)assert.ok(Math.min(Math.max(x.y,y.y),Math.max(u.y,v.y))-Math.max(Math.min(x.y,y.y),Math.min(u.y,v.y))<=.001);
  if(x.y===y.y&&u.y===v.y&&x.y===u.y)assert.ok(Math.min(Math.max(x.x,y.x),Math.max(u.x,v.x))-Math.max(Math.min(x.x,y.x),Math.min(u.x,v.x))<=.001);
 }
});
test('Automatische und feste Bindungen werden gespeichert und ungültige Bindungsarten abgewiesen',()=>{
 const doc=routingFixture();doc.edges[0].from.binding='fixed';doc.edges[0].to.binding='auto';assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(doc))),doc);
 doc.edges[0].to.binding='invalid';assert.throws(()=>parseDocument(doc));
});
test('Feste Quellseiten bleiben auch mit enger Lücke und einer dritten Notiz im Weg orthogonal',()=>{
 const {connectionGeometry}=compiled.exports,doc=routingFixture();
 doc.nodes[0].x=200;doc.nodes[0].y=200;doc.nodes[1].x=200;doc.nodes[1].y=350;doc.nodes[2].x=200;doc.nodes[2].y=75;
 for(const edge of doc.edges){edge.from.binding='fixed';edge.to.binding='auto';const route=connectionGeometry(edge,doc);
  assert.equal(route.toSide,'bottom');
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i];assert.ok(Math.abs(a.x-b.x)<.001||Math.abs(a.y-b.y)<.001);
   for(let k=0;k<=50;k++){const p={x:a.x+(b.x-a.x)*k/50,y:a.y+(b.y-a.y)*k/50};assert.ok(!doc.nodes.some(n=>inside(p,n)));}
  }
 }
});
test('Anheften am Körper ist automatisch, Anheften am Rand fixiert die gewählte Seite',()=>{
 const doc=routingFixture();assert.equal(attach({x:250,y:250},doc).binding,'auto');
 const edge=attach({x:299,y:250},doc);assert.equal(edge.binding,'fixed');assert.equal(edge.side,'right');
});
