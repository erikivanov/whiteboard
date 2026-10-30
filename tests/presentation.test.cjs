const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const filename=require('node:path').resolve('lib/presentation.ts');
const compiled=new Module(filename,module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {nodeTextLayout,nodeFontSize}=compiled.exports;
const note=(text,w=100,h=100)=>({id:'n',kind:'note',x:0,y:0,w,h,text,fill:'#fff0a6'});
const fits=n=>{const layout=nodeTextLayout(n);assert.ok(layout.lines.length*layout.lineHeight<=n.h-2*layout.padding-4+.001);return layout;};
test('Auto verkleinert lange Texte einschließlich Umbrüchen und Sonderzeichen vollständig',()=>{
 for(const text of ['Ein längerer Satz mit mehreren Wörtern. '.repeat(20),'W'.repeat(500),'Zeile\n'.repeat(50),'日本語 😊 ÄÖÜ '.repeat(50),'eins\tzwei\n'.repeat(30)]){
  const n=note(text);const layout=fits(n);assert.ok(layout.fontSize<18 && layout.fontSize>0);
 }
});
test('Notizen erhalten nach Vergrößern oder Entfernen von Text wieder größere Schrift',()=>{
 const text='Ein längerer Satz. '.repeat(25),small=note(text),large=note(text,200,200);
 assert.ok(fits(large).fontSize>fits(small).fontSize);
 assert.ok(nodeFontSize(note('Kurz'))>nodeFontSize(small));
});
test('Manuell gewählte Schriftgröße bleibt unabhängig von der Textmenge unverändert',()=>{
 const n={...note('Text '.repeat(200)),fontSize:24};assert.equal(nodeFontSize(n),24);
 assert.equal(nodeFontSize({...n,text:'Kurz'}),24);
});
test('Auto passt auch unterhalb der manuellen Mindestschriftgröße, Cache erkennt Änderungen',()=>{
 const n=note('Kurz');const before=nodeFontSize(n);n.text='W'.repeat(1500);
 assert.ok(fits(n).fontSize<8);assert.ok(nodeFontSize(n)<before);
 n.text='Kurz';assert.equal(nodeFontSize(n),before);
});
test('Fett und kursiv sowie sehr kleine Notizen liefern endliche Layoutwerte',()=>{
 for(const n of [{...note('Text '.repeat(20)),bold:true,italic:true},note('Ein Text',10,10)]){
  const layout=fits(n);assert.ok(Number.isFinite(layout.fontSize)&&layout.fontSize>0);
 }
});
