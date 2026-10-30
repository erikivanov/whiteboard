async(host)=>{
 const browser=host.context().browser(),c=await browser.newContext({viewport:{width:1440,height:1000}}),g=await browser.newContext({viewport:{width:1440,height:1000}});
 const p=await c.newPage(),guest=await g.newPage(),passed=[],errors=[];
 [p,guest].forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
 const wait=async(fn,label)=>{for(let i=0;i<80;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error(label);};
 const check=(ok,label)=>{if(!ok)throw Error(label);};let s;
 const drag=async(a,b)=>{await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:14});await p.mouse.up();};
 try{
  const create=await host.request.post('http://localhost:3001/api/boards',{data:{action:'create',doc:{version:1,title:'Zwei Notizen → ein Ziel',nodes:[
   {id:'a',kind:'note',x:250,y:200,w:150,h:150,text:'Idee A',fill:'#fff0a6'},
   {id:'b',kind:'note',x:250,y:600,w:150,h:150,text:'Idee B',fill:'#81e7de'},
   {id:'t',kind:'note',x:900,y:400,w:150,h:150,text:'Gemeinsames Ziel',fill:'#fd9ae7'}],edges:[]}}});s=await create.json();check(create.ok(),'Create fixture');
  const api=async()=>{const r=await host.request.get(`http://localhost:3001/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`}});return(await r.json()).doc;};
  await p.goto(`http://localhost:3001/board?board=${s.id}#token=${s.token}`);await p.getByTestId('board-node').first().waitFor();
  for(const id of ['a','b']){
   await p.locator(`[data-id="${id}"]`).click();const anchor=await p.getByTestId('connection-right').boundingBox();
   await drag({x:anchor.x+anchor.width/2,y:anchor.y+anchor.height/2},{x:975,y:475});
  }
  await wait(async()=>(await api()).edges.length===2,'Two connectors saved');
  const inspect=async(page)=>page.getByTestId('edge-path').evaluateAll(paths=>paths.map(path=>{
   const length=path.getTotalLength(),end=path.getPointAtLength(length),previous=path.getPointAtLength(Math.max(0,length-1));
   return{d:path.getAttribute('d'),end:{x:end.x,y:end.y},angle:Math.atan2(end.y-previous.y,end.x-previous.x),samples:Array.from({length:99},(_,i)=>{const p=path.getPointAtLength(length*(i+1)/100);return{x:p.x,y:p.y};})};
  }));
  let routes=await inspect(p),doc=await api();
  check(routes.length===2&&Math.abs(routes[0].end.y-routes[1].end.y)>30,'Distinct target ports');
  check(routes.every(r=>r.end.x===900&&Math.abs(r.angle)<.001),'Left-side arrival and correct arrow direction');
  check(routes.every(r=>r.samples.every(point=>!doc.nodes.some(n=>point.x>n.x+.1&&point.x<n.x+n.w-.1&&point.y>n.y+.1&&point.y<n.y+n.h-.1))),'No line through notes');
  check(doc.edges.every(e=>e.from.binding==='fixed'&&e.to.binding==='auto'),'Pinned source and automatic body target');
  passed.push('Two notes connect to a third through the visible handles','Separated ordered target ports','Arrowheads follow final segment','Lines stay outside notes','Body target is automatic');
  await p.mouse.click(1200,820);await p.screenshot({path:'/Users/erikivanov/Desktop/miro-free/docs/connector-routing-fan-in.png'});
  // Both sources above the shared target must not merge into one vertical track.
  await p.locator('[data-id="b"]').click();await drag({x:325,y:675},{x:325,y:425});
  await p.locator('[data-id="t"]').click();await drag({x:975,y:475},{x:975,y:725});
  routes=await inspect(p);doc=await api();check(Math.abs(routes[0].end.y-routes[1].end.y)>30,'Fan-in remains separated after move');
  passed.push('Moving multiple notes keeps incoming arrows separated');
  await p.mouse.click(1200,820);await p.screenshot({path:'/Users/erikivanov/Desktop/miro-free/docs/connector-routing-same-side.png'});
  // Move target above sources: automatic target ports switch to the bottom.
  await p.locator('[data-id="t"]').click();await drag({x:975,y:725},{x:325,y:100});
  routes=await inspect(p);check(routes.every(r=>Math.abs(r.end.y-175)<1),'Target side updates after moving');
  check(routes.every(r=>Math.abs(r.angle+Math.PI/2)<.001),'Arrowhead points up into target bottom');
  passed.push('Target chooses a new side after moving','Arrowheads adapt after target-side change');
  // Text still follows routed geometry and has no filled background.
  await p.getByRole('application').focus();await p.keyboard.press('Escape');
  const path=p.getByTestId('edge-path').first();const anchor=await path.evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.5);return{x:p.x,y:p.y};});
  await p.mouse.dblclick(anchor.x,anchor.y);await p.getByLabel('Verbindungstext bearbeiten').fill('führt zum Ziel');await p.keyboard.press('Enter');
  await wait(async()=>(await api()).edges.some(e=>e.labels?.some(l=>l.text==='führt zum Ziel')),'Label saved on routed arrow');
  passed.push('Labels work on the new connector path');
  await guest.goto(`http://localhost:3001/board?board=${s.id}#token=${s.shareToken}`);await wait(async()=>await guest.getByTestId('edge').count()===2,'Guest connectors');
  await wait(async()=>JSON.stringify(await guest.getByTestId('edge-path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d'))))===JSON.stringify(await p.getByTestId('edge-path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')))),'Same routes for guest');
  passed.push('Guest sees identical connector geometry');
  await p.reload();await wait(async()=>await p.getByTestId('edge').count()===2,'Reload');check(await p.getByTestId('edge-label').textContent()==='führt zum Ziel','Label restored');
  passed.push('Connections and labels survive reload');check(errors.length===0,errors.join(';'));return{passed,pageErrors:errors};
 }catch(e){return{passed,error:String(e),pageErrors:errors,body:(await p.locator('body').innerText()).slice(-1000)};}
 finally{if(s?.id)await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`},data:{action:'delete'}});await c.close();await g.close();}
}
