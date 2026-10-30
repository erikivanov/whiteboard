async (host) => {
  const browser = host.context().browser();
  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const a = await owner.newPage(), b = await guest.newPage();
  const passed = [], errors = [];
  [a,b].forEach(p => p.on("pageerror", e => errors.push(e.message)));
  const wait = async (fn, label) => {
    for (let i=0; i<100; i++) { if (await fn()) return; await new Promise(r=>setTimeout(r,100)); }
    throw Error(label);
  };
  const check = (ok, label) => { if (!ok) throw Error(label); };
  const auth = token => ({ Authorization: `Bearer ${token}` });
  try {
    const create = await host.request.post("http://localhost:3001/api/boards", { data: {
      action: "create", doc: { version:1, title:"Freigabeprüfung", nodes:[{id:"note",kind:"note",x:300,y:300,w:120,h:120,text:"Gemeinsame Idee",fill:"#fff0a6"}], edges:[] },
    }});
    const s = await create.json(); check(create.ok(), "Create");
    await a.goto(`http://localhost:3001/board?board=${s.id}#token=${s.token}`);
    await wait(async()=>await a.getByRole("button",{name:"Teilen",exact:true}).isEnabled(),"Owner ready");
    check(await a.getByRole("button",{name:"Hand",exact:true}).count()===0,"Hand removed");
    check(await a.locator(".bottom-hint").count()===0,"Bottom hint removed");
    passed.push("Hand tool and bottom hint removed");
    await a.getByRole("button",{name:"Teilen",exact:true}).click();
    await wait(async()=>!await a.getByLabel("Jeder mit diesem Link").isDisabled(),"Share ready");
    const guestLink = await a.getByLabel("Freigabelink").inputValue();
    const publicToken = new URLSearchParams(new URL(guestLink).hash.slice(1)).get("token");
    check(publicToken!==s.token,"Owner token must never be shared");
    await b.goto(guestLink);
    await wait(async()=>await b.getByTestId("board-node").count()===1,"Guest document");
    check(await b.getByLabel("Boardname").getAttribute("readonly")!==null,"Guest readonly");
    check(await b.getByRole("button",{name:"Notiz",exact:true}).isDisabled(),"Guest tools disabled");
    check(await b.getByRole("button",{name:"Teilen",exact:true}).isDisabled(),"Guest cannot manage sharing");
    passed.push("Stable guest link is separate from owner", "Independent guest starts readonly");
    const patch = {title:"Nicht erlaubt",nodes:[],edges:[],deletedNodes:[],deletedEdges:[]};
    const denied = await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:auth(publicToken),data:{patch}});
    check(denied.status()===403,"Server readonly enforcement");
    await a.getByLabel("Jeder mit diesem Link").selectOption("edit");
    await wait(async()=>!await b.getByLabel("Boardname").evaluate(e=>e.readOnly),"Open guest receives edit permission");
    await b.getByLabel("Boardname").fill("Vom Gast geändert");
    await wait(async()=>await a.getByLabel("Boardname").inputValue()==="Vom Gast geändert","Guest edit persisted");
    await wait(async()=>!await a.getByLabel("Jeder mit diesem Link").isDisabled(),"Share saved");
    check(await a.getByLabel("Freigabelink").inputValue()===guestLink,"Link must remain unchanged");
    passed.push("View to edit applies without guest reload", "Guest edits synchronize", "Same link retains updated permissions");
    const guestShare = await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:auth(publicToken),data:{action:"sharing",role:"view"}});
    const guestDelete = await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:auth(publicToken),data:{action:"delete"}});
    check(guestShare.status()===403 && guestDelete.status()===403,"Editing guests cannot manage or delete");
    await b.getByTestId("board-node").dblclick();
    await b.getByLabel("Objekttext bearbeiten").waitFor();
    await a.getByLabel("Jeder mit diesem Link").selectOption("view");
    await wait(async()=>await b.getByLabel("Boardname").evaluate(e=>e.readOnly),"Open guest loses edit permission");
    await wait(async()=>await b.getByLabel("Objekttext bearbeiten").count()===0,"Active guest editor closed");
    const rejected = await host.request.post(`http://localhost:3001/api/boards?id=${s.id}`,{headers:auth(publicToken),data:{patch}});
    check(rejected.status()===403,"Existing link now readonly");
    check(!await a.getByLabel("Boardname").evaluate(e=>e.readOnly),"Owner remains editor");
    passed.push("Editing guests cannot share or delete", "Edit to view revokes active editor", "Server rejects writes after downgrade", "Owner keeps editing rights");
    await a.getByRole("button",{name:"Freigabe schließen"}).click();
    await a.getByRole("link",{name:"Zur Boardübersicht"}).click();
    await a.getByRole("button",{name:"Vom Gast geändert löschen",exact:true}).click();
    await a.getByRole("button",{name:"Abbrechen",exact:true}).click();
    check(await a.getByTestId("dashboard-board").count()===1,"Cancel preserves board");
    await a.getByRole("button",{name:"Vom Gast geändert löschen",exact:true}).click();
    await a.getByRole("button",{name:"Board löschen",exact:true}).click();
    await wait(async()=>await a.getByTestId("dashboard-board").count()===0,"Dashboard removal");
    const gone = await host.request.get(`http://localhost:3001/api/boards?id=${s.id}`,{headers:auth(s.token)});
    check(gone.status()===404,"Server deletion");
    await wait(async()=>await b.getByRole("alert").filter({hasText:"gelöscht"}).count()===1,"Open guest sees deletion");
    await a.reload();
    await a.getByRole("heading",{name:"Alle Boards",exact:true}).waitFor();
    check(await a.getByTestId("dashboard-board").count()===0,"Deletion persists after reload");
    passed.push("Delete cancel preserves board", "Confirmed deletion removes server document", "Guest sees deletion", "Deleted board stays gone after reload");
    // Local legacy documents can be deleted without creating a server document.
    await a.evaluate(()=>localStorage.setItem("whiteboard.document.v1",JSON.stringify({version:1,title:"Lokales Testboard",nodes:[],edges:[]})));
    await a.reload();
    await a.getByRole("button",{name:"Lokales Testboard löschen"}).click();
    await a.getByRole("button",{name:"Board löschen",exact:true}).click();
    await wait(async()=>await a.getByTestId("dashboard-board").count()===0,"Local deletion");
    check(await a.evaluate(()=>localStorage.getItem("whiteboard.document.v1"))===null,"Local source removed");
    await a.reload();
    await a.getByRole("heading",{name:"Alle Boards",exact:true}).waitFor();
    check(await a.getByTestId("dashboard-board").count()===0,"Local deletion persists");
    passed.push("Local boards can be deleted permanently");
    check(errors.length===0,errors.join("; "));
    return {passed,pageErrors:errors};
  } catch(e) { return {passed,error:String(e),pageErrors:errors,ownerBody:(await a.locator("body").innerText()).slice(-1500),guestBody:(await b.locator("body").innerText()).slice(-700)}; }
  finally {await owner.close();await guest.close();}
}
