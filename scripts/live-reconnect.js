async(host)=>{
 const browser=host.context().browser(),c=await browser.newContext({viewport:{width:1440,height:1000}}),g=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),guest=await g.newPage();
 const passed=[],errors=[];[p,guest].forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
 const wait=async(fn,label)=>{for(let i=0;i<90;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error(label);};
 const check=(ok,label)=>{if(!ok)throw Error(label);};let s;
 const dragEnd=async(end,to,highlight=false)=>{
  const b=await p.getByTestId(`edge-endpoint-${end}`).boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:10});
  if(highlight)check(await p.getByTestId('connection-target').count()===1,'Target highlight');await p.mouse.up();
 };
 const selectEdge=async()=>{const point=await p.getByTestId('edge-path').evaluate(path=>{const point=path.getPointAtLength(path.getTotalLength()*.2).matrixTransform(path.getScreenCTM());return{x:point.x,y:point.y};});await p.mouse.click(point.x,point.y);};
 try{
  const r=await host.request.post('http://localhost:3001/api/boards',{data:{action:'create',doc:{version:1,title:'Pfeil zuerst, Notiz danach',nodes:[],edges:[]}}});s=await r.json();check(r.ok(),'Create fixture');
  const api=async()=>{const r=await host.request.get(`http://localhost:3001/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`}});return(await r.json()).doc;};
  await p.goto(`http://localhost:3001/board?board=${s.id}#token=${s.token}`);await wait(async()=>await p.getByRole('button',{name:'Teilen',exact:true}).isEnabled(),'Owner ready');
  await p.getByRole('application').focus();await p.keyboard.press('l');await p.mouse.move(350,300);await p.mouse.down();await p.mouse.move(650,300,{steps:8});await p.mouse.up();
  await p.mouse.dblclick(500,300);await p.getByLabel('Verbindungstext bearbeiten').fill('Vorhandener Pfeil');await p.keyboard.press('Enter');
  await p.keyboard.press('n');await p.mouse.click(900,350);await p.getByLabel('Objekttext bearbeiten').fill('Später erstellte Notiz');await p.keyboard.press('Escape');
  await wait(async()=>(await api()).nodes.length===1,'Late note saved');const first=(await api()).nodes[0].id;
  await selectEdge();await dragEnd('to',{x:900,y:350},true);
  await wait(async()=>(await api()).edges[0].to.nodeId===first,'Late note attached');
  check((await api()).edges[0].labels[0].text==='Vorhandener Pfeil','Label retained');
  passed.push('Arrow created before note attaches through draggable tip','Drop target is highlighted','Existing label retained');
  await p.getByRole('button',{name:'Rückgängig machen',exact:true}).click();await wait(async()=>!(await api()).edges[0].to.nodeId,'Undo attach');check((await api()).nodes.length===1,'Undo preserves later note');
  await p.getByRole('button',{name:'Wiederherstellen',exact:true}).click();await wait(async()=>(await api()).edges[0].to.nodeId===first,'Redo attach');
  passed.push('Reconnect is one undo step','Redo restores attachment');
  await p.locator(`[data-id="${first}"]`).click();await p.mouse.move(900,350);await p.mouse.down();await p.mouse.move(1000,550,{steps:10});await p.mouse.up();
  const end=await p.getByTestId('edge-path').evaluate(path=>{const point=path.getPointAtLength(path.getTotalLength());return{x:point.x,y:point.y};});check(end.x===950&&end.y===550,'Attached tip follows note');
  passed.push('Arrow follows moved later-created note');
  await p.getByRole('application').focus();await p.keyboard.press('n');await p.mouse.click(650,650);await p.getByLabel('Objekttext bearbeiten').fill('Andere Notiz');await p.keyboard.press('Escape');
  await wait(async()=>(await api()).nodes.length===2,'Second note saved');const second=(await api()).nodes.find(n=>n.id!==first).id;
  await selectEdge();await dragEnd('to',{x:650,y:650},true);await wait(async()=>(await api()).edges[0].to.nodeId===second,'Tip reattached');
  await dragEnd('from',{x:1000,y:550},true);await wait(async()=>(await api()).edges[0].from.nodeId===first,'Start attached');
  passed.push('Attached handles remain draggable above notes','Tip reattaches to another note','Arrow start attaches independently');
  await dragEnd('to',{x:1150,y:750});await wait(async()=>!(await api()).edges[0].to.nodeId,'Detached in blank area');
  check((await api()).edges[0].from.nodeId===first,'Other end unchanged');passed.push('Dragging into blank area disconnects only that endpoint');
  await p.getByRole('button',{name:'Rückgängig machen',exact:true}).click();await wait(async()=>(await api()).edges[0].to.nodeId===second,'Undo detach');await selectEdge();
  const before=JSON.stringify((await api()).edges[0]);const handle=await p.getByTestId('edge-endpoint-to').boundingBox();await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(1100,800,{steps:8});await p.keyboard.press('Escape');await p.mouse.up();
  await wait(async()=>JSON.stringify((await api()).edges[0])===before,'Escape restores original edge');passed.push('Escape cancels endpoint dragging');
  await selectEdge();await p.getByTestId('edge-endpoint-to').click();await p.getByRole('application').focus();await p.keyboard.press('ControlOrMeta+z');await wait(async()=>!(await api()).edges[0].from.nodeId,'Click creates no history entry');
  await p.keyboard.press('ControlOrMeta+Shift+z');await wait(async()=>(await api()).edges[0].from.nodeId===first,'Restore start');passed.push('Clicking a handle does not alter the edge or undo history');
  await selectEdge();
  for(const zoom of [50,200]){
   await p.locator('.zoom-value').click();await p.getByRole('menuitem',{name:`${zoom} %`,exact:true}).click();
   await dragEnd('to',{x:1000,y:600});await wait(async()=>!(await api()).edges[0].to.nodeId,'Zoomed disconnect');
   const box=await p.locator(`[data-id="${second}"]`).boundingBox();await dragEnd('to',{x:box.x+box.width/2,y:box.y+box.height/2},true);
   await wait(async()=>(await api()).edges[0].to.nodeId===second,'Zoomed reconnect');passed.push(`Endpoint reconnects at ${zoom}% zoom`);
  }
  await guest.goto(`http://localhost:3001/board?board=${s.id}#token=${s.shareToken}`);await wait(async()=>await guest.getByTestId('edge').count()===1,'Guest loaded');
  const original=JSON.stringify((await api()).edges[0]);const point=await guest.getByTestId('edge-path').evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.2);return{x:p.x,y:p.y};});await guest.mouse.click(point.x,point.y);
  check(await guest.getByTestId('edge-endpoint-to').count()===0,'Viewer cannot drag endpoints');check(JSON.stringify((await api()).edges[0])===original,'Viewer edge unchanged');
  passed.push('Viewer has no editable endpoint handles');
  await p.reload();await wait(async()=>await p.getByTestId('edge').count()===1,'Reload');const saved=(await api()).edges[0];check(saved.from.nodeId===first&&saved.to.nodeId===second,'Bindings persist');check(saved.labels[0].text==='Vorhandener Pfeil','Label persists');
  passed.push('Both attachments and label survive reload');check(errors.length===0,errors.join(';'));return{passed,pageErrors:errors};
 }catch(e){return{passed,error:String(e),pageErrors:errors,body:(await p.locator('body').innerText()).slice(-1000)};}
 finally{if(s?.id)await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`},data:{action:'delete'}});await c.close();await g.close();}
}
