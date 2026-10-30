async(host)=>{
  const c=await host.context().browser().newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();
  const passed=[],errors=[];p.on("pageerror",e=>errors.push(e.message));
  const check=(ok,label)=>{if(!ok)throw Error(label);};
  const metrics=()=>p.getByLabel("Objekttext bearbeiten").evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.clientHeight,scrollHeight:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth}));
  const fits=async(label)=>{const m=await metrics();check(m.scrollHeight<=m.height&&m.scrollWidth<=m.width,label+": "+JSON.stringify(m));return m;};
  try{
    await p.goto("http://localhost:3001/");
    await p.evaluate(()=>localStorage.setItem("whiteboard.document.v1",JSON.stringify({version:1,title:"Automatische Notizschrift",nodes:[{id:"note",kind:"note",x:300,y:300,w:100,h:100,text:"Kurze Notiz",fill:"#fff0a6"}],edges:[]})));
    await p.goto("http://localhost:3001/board");await p.getByTestId("board-node").dblclick();
    const initial=await fits("Short note fits");
    const long="Dieser gesamte Text soll automatisch in die Notiz passen, ohne abgeschnitten zu werden. ".repeat(4);
    await p.getByLabel("Objekttext bearbeiten").fill(long);
    const small=await fits("Long text fits a 100px note");check(small.font<initial.font,"Font must shrink while typing");
    passed.push("Auto shrinks during input","Entire long text fits without scrolling");
    for(const text of ["W".repeat(400),"Zeile\n".repeat(30),"ÄÖÜ 日本語 😊 ".repeat(35),"eins\tzwei\tdrei\n".repeat(15)]){
      await p.getByLabel("Objekttext bearbeiten").fill(text);await fits("Special text fits");
    }
    passed.push("Long words, explicit line breaks, Unicode and tabs fit");
    await p.getByLabel("Objekttext bearbeiten").fill(long);await p.keyboard.press("Escape");
    await p.getByRole("button",{name:"Notizgröße S",exact:true}).click();await p.getByRole("menuitem",{name:"M",exact:true}).click();
    await p.getByTestId("board-node").dblclick();const bigger=await fits("Resized note fits");check(bigger.font>small.font,"Enlarging note must enlarge font");
    passed.push("Font grows when note grows");
    await p.getByLabel("Objekttext bearbeiten").fill("Kurz");const shortAgain=await fits("Shortened text fits");check(shortAgain.font>bigger.font,"Removing text must enlarge font");
    passed.push("Font grows again when text is removed");
    await p.keyboard.press("Escape");await p.getByLabel("Schriftgröße",{exact:true}).selectOption("24");
    await p.getByTestId("board-node").dblclick();await p.getByLabel("Objekttext bearbeiten").fill(long);check((await metrics()).font===24,"Manual size must stay fixed");
    await p.keyboard.press("Escape");await p.getByLabel("Schriftgröße",{exact:true}).selectOption("auto");await p.getByTestId("board-node").dblclick();await fits("Returning to auto fits");
    passed.push("Manual font size remains fixed","Switching back to Auto fits again");
    await p.keyboard.press("Escape");await p.getByRole("button",{name:"Fett",exact:true}).click();await p.getByRole("button",{name:"Kursiv",exact:true}).click();
    await p.getByTestId("board-node").dblclick();await fits("Bold italic fits");await p.keyboard.press("Escape");
    passed.push("Bold and italic metrics are considered");
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem("whiteboard.document.v1")||"{}").nodes?.[0]?.text.length>100);
    await p.reload();await p.getByTestId("board-node").dblclick();await fits("Reloaded note fits");
    passed.push("Auto survives reload");check(errors.length===0,errors.join(";"));return{passed,pageErrors:errors};
  }catch(e){return{passed,error:String(e),pageErrors:errors};}finally{await c.close();}
}
