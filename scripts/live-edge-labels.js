async (host) => {
  const browser=host.context().browser(), owner=await browser.newContext({viewport:{width:1440,height:1000}}), guest=await browser.newContext({viewport:{width:1440,height:1000}});
  const a=await owner.newPage(),b=await guest.newPage(),passed=[],errors=[];
  [a,b].forEach(p=>p.on("pageerror",e=>errors.push(e.message)));
  const wait=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error(label);};
  const check=(value,label)=>{if(!value)throw Error(label);};
  let session;
  try{
    const created=await host.request.post("http://localhost:3001/api/boards",{data:{action:"create",doc:{version:1,title:"Verbindungstexte",nodes:[
      {id:"source",kind:"rect",x:150,y:250,w:150,h:100,text:"Start",fill:"#fff0a6"},
      {id:"target",kind:"rect",x:850,y:250,w:150,h:100,text:"Ziel",fill:"#81e7de"}],
      edges:[{id:"line",style:"straight",from:{nodeId:"source",side:"right",point:{x:300,y:300}},to:{nodeId:"target",side:"left",point:{x:850,y:300}}}]}}});
    session=await created.json();check(created.ok(),"Create fixture");
    const api=async()=>{const r=await host.request.get(`http://localhost:3001/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.token}`}});return (await r.json()).doc;};
    await a.goto(`http://localhost:3001/board?board=${session.id}#token=${session.token}`);
    await a.getByTestId("edge").waitFor({state:"attached"});
    await a.mouse.dblclick(575,300);
    await a.getByLabel("Verbindungstext bearbeiten").fill("führt zum Ziel");
    await a.keyboard.press("Enter");
    await wait(async()=>await a.getByTestId("edge-label").count()===1,"Label rendered");
    await wait(async()=>(await api()).edges[0].labels?.[0]?.text==="führt zum Ziel","Label persisted");
    passed.push("Double-click connection creates text","Label persisted on server");
    const label=a.getByTestId("edge-label").first(),box=await label.boundingBox();
    const ink=await a.getByTestId("board-canvas").evaluate((canvas,box)=>{
      const pixels=canvas.getContext("2d").getImageData(Math.ceil((box.x+5)*devicePixelRatio),Math.ceil((box.y+5)*devicePixelRatio),Math.floor((box.width-10)*devicePixelRatio),Math.floor((box.height-10)*devicePixelRatio)).data;
      let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<100&&pixels[i+1]<140&&pixels[i+2]<130&&pixels[i+3]>0)dark++;
      return dark;
    },box);check(ink>10,"Canvas actually draws label text");passed.push("Text is drawn on Canvas");
    await label.dblclick();await a.getByLabel("Verbindungstext bearbeiten").fill("geänderter Text\nzweite Zeile");await a.keyboard.press("Escape");
    await wait(async()=>await label.textContent()==="geänderter Text\nzweite Zeile","Edit label");
    await a.getByRole("button",{name:"Verbindungstext hinzufügen",exact:true}).click();
    await a.getByLabel("Verbindungstext bearbeiten").fill("zweites Label");await a.keyboard.press("Enter");
    check(await a.getByTestId("edge-label").count()===2,"Multiple labels");
    await wait(async()=>(await api()).edges[0].labels?.length===2,"Multiple persisted");
    passed.push("Existing text edits and multiple lines","Toolbar adds a second label");
    const second=a.getByTestId("edge-label").filter({hasText:"zweites Label"});
    const before=(await api()).edges[0].labels.find(l=>l.text==="zweites Label").position;
    const secondBox=await second.boundingBox();await a.mouse.move(secondBox.x+secondBox.width/2,secondBox.y+secondBox.height/2);await a.mouse.down();await a.mouse.move(760,300,{steps:12});await a.mouse.up();
    await wait(async()=>Math.abs((await api()).edges[0].labels.find(l=>l.text==="zweites Label").position-before)>.1,"Drag along line");
    await a.getByLabel("Schriftgröße der Beschriftung").selectOption("24");
    await a.getByLabel("Textfarbe der Beschriftung").fill("#4262ff");
    await wait(async()=>{const label=(await api()).edges[0].labels.find(l=>l.text==="zweites Label");return label.fontSize===24&&label.color==="#4262ff";},"Label formatting");
    passed.push("Drag label along connection","Font size and text color persist");
    const beforeMove=await second.boundingBox();await a.mouse.move(910,290);await a.mouse.down();await a.mouse.move(1070,410,{steps:12});await a.mouse.up();
    const afterMove=await second.boundingBox();check(Math.abs(beforeMove.x-afterMove.x)>50||Math.abs(beforeMove.y-afterMove.y)>40,"Label follows connected object");
    passed.push("Text follows moved connected object");
    await second.click();await a.getByRole("button",{name:"Beschriftung löschen",exact:true}).click();
    check(await a.getByTestId("edge").count()===1&&await a.getByTestId("edge-label").count()===1,"Delete label preserves edge");
    await a.getByRole("button",{name:"Rückgängig machen",exact:true}).click();check(await a.getByTestId("edge-label").count()===2,"Undo label deletion");
    await a.getByRole("button",{name:"Wiederherstellen",exact:true}).click();check(await a.getByTestId("edge-label").count()===1,"Redo label deletion");
    passed.push("Delete only text","Undo and redo label deletion");
    // The remaining label is copied with a new globally unique ID.
    await a.getByTestId("edge-label").first().click();await a.getByRole("button",{name:"Duplizieren",exact:true}).click();
    check(await a.getByTestId("edge-label").count()===2,"Duplicate label");
    await wait(async()=>(await api()).edges[0].labels.length===2,"Duplicate persisted");
    const persisted=await api();check(new Set(persisted.edges[0].labels.map(l=>l.id)).size===2,"Unique label IDs");
    passed.push("Duplicate text receives a unique ID");
    await a.reload();await wait(async()=>await a.getByTestId("edge-label").count()===2,"Labels restored");
    passed.push("Labels restored after reload");
    await b.goto(`http://localhost:3001/board?board=${session.id}#token=${session.shareToken}`);
    await wait(async()=>await b.getByTestId("edge-label").count()===2,"Guest sees labels");
    await b.getByTestId("edge-label").first().dblclick();check(await b.getByLabel("Verbindungstext bearbeiten").count()===0,"Viewer cannot edit");
    const permission=await host.request.post(`http://localhost:3001/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.token}`},data:{action:"sharing",role:"edit"}});check(permission.ok(),"Grant guest editing");
    await wait(async()=>!await b.getByLabel("Boardname").evaluate(e=>e.readOnly),"Guest editor");
    await b.getByTestId("edge-label").first().dblclick();await b.getByLabel("Verbindungstext bearbeiten").fill("Gastbeschriftung");await b.keyboard.press("Enter");
    await wait(async()=>await a.getByTestId("edge-label").filter({hasText:"Gastbeschriftung"}).count()===1,"Guest label sync");
    passed.push("Guests see connection texts","Viewers cannot edit labels","Guest label edits synchronize");
    check(errors.length===0,errors.join("; "));
    return {passed,pageErrors:errors};
  }catch(error){return {passed,error:String(error),pageErrors:errors,body:(await a.locator("body").innerText()).slice(-1000)};}
  finally{if(session?.id)await host.request.post(`http://localhost:3001/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.token}`},data:{action:"delete"}});await owner.close();await guest.close();}
}
