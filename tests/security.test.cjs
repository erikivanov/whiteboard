const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function load(file) {
  const m = new Module(require('node:path').resolve(file), module);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
  return m.exports;
}
const security = load('lib/api-security.ts');
const { readBoundedJson, sameOriginRequest, MAX_BODY_BYTES } = security;
const { parseDocument, emptyDocument } = load('lib/document.ts');
const request = body => new Request('http://localhost:3001/api/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
test('Größenlimit gilt auch ohne Content-Length und bei gestreamten Daten', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_BODY_BYTES)); c.enqueue(new Uint8Array(1)); c.close(); } });
  await assert.rejects(readBoundedJson(request(stream)), e => e.status === 413);
  assert.deepEqual(await readBoundedJson(request('{"action":"create"}')), { action: 'create' });
});
test('Langsame Uploads, ungültiges JSON und falscher Medientyp werden abgewiesen', async () => {
  await assert.rejects(readBoundedJson(request(new ReadableStream({})), 10), e => e.status === 408);
  await assert.rejects(readBoundedJson(request('[]')), e => e.status === 400);
  await assert.rejects(readBoundedJson(request('{')), e => e.status === 400);
  await assert.rejects(readBoundedJson(new Request('http://localhost:3001', {method:'POST',body:'{}'})), e => e.status === 415);
});
test('Ursprungsprüfung vertraut weder Host-Header noch fremdem Protokoll', () => {
  for (const origin of ['https://localhost:3001', 'null', 'bad origin', 'https://evil.test'])
    assert.equal(sameOriginRequest(new Request('http://localhost:3001', {headers:{origin,host:'evil.test'}}), 'http://localhost:3001'), false);
  assert.equal(sameOriginRequest(new Request('http://localhost:3001', {headers:{origin:'http://localhost:3001'}}), 'http://localhost:3001'), true);
  assert.equal(sameOriginRequest(new Request('http://localhost:3001', {headers:{'sec-fetch-site':'cross-site'}}), 'http://localhost:3001'), false);
});
test('Dokumente begrenzen Elementanzahl, Beschriftung und Endpunkttypen', () => {
  assert.throws(() => parseDocument({...emptyDocument(), title:'x'.repeat(1001)}));
  assert.throws(() => parseDocument({...emptyDocument(), nodes:Array(2001).fill({})}));
  const edge={id:'e',from:{nodeId:0,point:{x:0,y:0}},to:{point:{x:1,y:1}}};
  assert.throws(() => parseDocument({...emptyDocument(),edges:[edge]}));
  delete edge.from.nodeId;
  edge.labels=Array(65).fill({});
  assert.throws(() => parseDocument({...emptyDocument(),edges:[edge]}));
});

test('Board-API erzwingt Gastrechte, Größenlimits und begrenzte Anwesenheit', async () => {
  const path = require('node:path'), os = require('node:os');
  const cwd = process.cwd(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'whiteboard-security-'));
  function withDeps(file, deps) {
    const m = new Module(path.resolve(cwd, file), module); m.paths = module.paths;
    const original = m.require.bind(m); m.require = id => deps[id] ?? original(id);
    m._compile(ts.transpileModule(fs.readFileSync(path.join(cwd, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop:true } }).outputText, file);
    return m.exports;
  }
  process.chdir(temporary);
  try {
    const api = withDeps('app/api/boards/route.ts', {
      '@/lib/document': load(path.join(cwd, 'lib/document.ts')),
      '@/lib/collaboration': load(path.join(cwd, 'lib/collaboration.ts')),
      '@/lib/api-security': security,
      '@/lib/auth': {appOrigin:()=> 'http://localhost:3001',getOwner:async req=> req.headers.get('cookie') === 'owner=fixture' ? {id:60944586} : null},
    });
    const call = async (body, {owner=false, id='', token='', origin='http://localhost:3001'}={}) => {
      const req = request(JSON.stringify(body));
      req.nextUrl = new URL('http://localhost:3001/api/boards'+(id?'?id='+id:''));
      if (owner) req.headers.set('cookie','owner=fixture');
      if (token) req.headers.set('authorization','Bearer '+token);
      req.headers.set('origin',origin);
      return api.POST(req);
    };
    assert.equal((await call({action:'create',doc:emptyDocument()})).status,401);
    const created = await call({action:'create',doc:emptyDocument()},{owner:true});
    assert.equal(created.status,200); const board = await created.json();
    const owner={owner:true,id:board.id,token:board.token}, guest={id:board.id,token:board.shareToken};
    const patch={nodes:[],edges:[],deletedNodes:[],deletedEdges:[],title:'Gaständerung'};
    assert.equal((await call({patch},guest)).status,403);
    assert.equal((await call({action:'delete'},guest)).status,403);
    assert.equal((await call({action:'sharing',role:'edit'},guest)).status,403);
    assert.equal((await call({}, {id:board.id,token:board.token})).status,401);
    assert.equal((await call({action:'sharing',role:'edit'},owner)).status,200);
    assert.equal((await call({patch},guest)).status,200);
    assert.equal((await call({action:'sharing',role:'view'},owner)).status,200);
    assert.equal((await call({patch},guest)).status,403);
    assert.equal((await call({}, {...owner,origin:'https://localhost:3001'})).status,403);
    assert.equal((await call({}, {...owner,origin:'malformed'})).status,403);
    for(let i=0;i<105;i++){
      const r=await call({presence:{id:'guest-'+i,name:'Gast',color:'#aabbcc',point:{x:1,y:2,extra:'discard'}}},guest);
      assert.equal(r.status,200);const data=await r.json();assert.ok(data.members.length<=100);
      assert.deepEqual(data.members[0].point,{x:1,y:2});
    }
    assert.equal((await call({presence:{id:'x'.repeat(81),name:'Gast',color:'#aabbcc',point:null}},guest)).status,400);
    assert.equal((await call({action:'delete'},owner)).status,200);
  } finally {process.chdir(cwd);fs.rmSync(temporary,{recursive:true,force:true});}
});
