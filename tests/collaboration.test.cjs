const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const filename=require('node:path').resolve('lib/collaboration.ts');
const compiled=new Module(filename,module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {diff,merge}=compiled.exports;
const note=(id,x=100)=>({id,kind:'note',x,y:100,w:100,h:100,text:id,fill:'#fff0a6'});
const fixture=()=>({version:1,title:'Board',nodes:[note('a'),note('b')],edges:[]});
test('Änderungen verschiedener Nutzer an getrennten Objekten bleiben erhalten',()=>{
 const base=fixture(),a=structuredClone(base),b=structuredClone(base);a.nodes[0].x=222;b.nodes[1].text='Gast';
 const result=merge(merge(base,diff(base,a)),diff(base,b));assert.equal(result.nodes[0].x,222);assert.equal(result.nodes[1].text,'Gast');
});
test('Lokale Änderungen während einer Serverantwort bleiben erhalten',()=>{
 const base=fixture(),server=structuredClone(base),local=structuredClone(base);server.nodes.push(note('remote'));local.nodes[0].text='Noch in Eingabe';
 const result=merge(server,diff(base,local));assert.equal(result.nodes[0].text,'Noch in Eingabe');assert.equal(result.nodes.length,3);
});
test('Undo entfernt nur eigene neu hinzugefügte Objekte',()=>{
 const before=fixture(),after={...before,nodes:[...before.nodes,note('own')]};
 const remote={...after,nodes:[...after.nodes,note('guest')]};
 const undo=merge(remote,diff(after,before));assert.deepEqual(undo.nodes.map(n=>n.id),['a','b','guest']);
 assert.deepEqual(merge(undo,diff(before,after)).nodes.map(n=>n.id),['a','b','own','guest']);
});
test('Löschen entfernt auch verwaiste Verbindungen',()=>{
 const base=fixture();base.edges=[{id:'e',from:{nodeId:'a',point:{x:0,y:0}},to:{nodeId:'b',point:{x:1,y:1}}}];
 const result=merge(base,{nodes:[],edges:[],deletedNodes:['a'],deletedEdges:[]});assert.equal(result.edges.length,0);assert.equal(result.nodes.length,1);
});
test('Ebenenreihenfolge wird synchronisiert, fremde neue Objekte bleiben erhalten',()=>{
 const base=fixture(),after={...base,nodes:[base.nodes[1],base.nodes[0]]},remote={...base,nodes:[...base.nodes,note('remote')]};
 assert.deepEqual(merge(remote,diff(base,after)).nodes.map(n=>n.id),['b','a','remote']);
});
