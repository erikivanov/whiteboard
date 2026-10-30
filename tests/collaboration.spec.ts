import { authenticateContext } from "./auth-support";
import { test, expect } from "./fixtures";
const note=(id:string,x=300)=>({id,kind:"note",x,y:300,w:120,h:120,text:id,fill:"#fff0a6"});
test("Canvas zeichnet das Dokument; unabhängige Sitzungen teilen Änderungen, Mauszeiger und Leserechte",async({browser,request,baseURL})=>{
  const create=await request.post("/api/boards",{data:{action:"create",doc:{version:1,title:"Zusammenarbeit",nodes:[note("start")],edges:[]}}});
  expect(create.ok()).toBeTruthy();const session=await create.json();
  const owner=await browser.newContext(), guest=await browser.newContext(), viewer=await browser.newContext();
  await authenticateContext(owner,baseURL);
  const a=await owner.newPage(),b=await guest.newPage(),v=await viewer.newPage();
  const link=(token:string)=>`${baseURL}/?board=${session.id}#token=${token}`;
  const errors:string[]=[];[a,b,v].forEach(p=>p.on("pageerror",e=>errors.push(e.message)));
  try {
    await a.goto(link(session.token));await b.goto(link(session.shareToken));await v.goto(link(session.viewToken));
    await expect(a.getByTestId("board-node")).toHaveCount(1);await expect(b.getByTestId("board-node")).toHaveCount(1);await expect(v.getByTestId("board-node")).toHaveCount(1);
    await expect(v.getByLabel("Boardname")).toHaveAttribute("readonly","");
    await expect(v.getByRole("button",{name:"Teilen",exact:true})).toBeDisabled();
    expect(await a.getByTestId("board-canvas").evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext("2d")!.getImageData(350*devicePixelRatio,350*devicePixelRatio,1,1).data))).toEqual([255,240,166,255]);
    await a.getByLabel("Boardname").fill("Gemeinsam verändert");
    await expect(b.getByLabel("Boardname")).toHaveValue("Gemeinsam verändert");await expect(v.getByLabel("Boardname")).toHaveValue("Gemeinsam verändert");
    await a.mouse.move(710,540);await expect(b.getByTestId("remote-cursor").filter({hasText:/Gast/}).first()).toBeVisible();
    await a.getByRole("application").focus();await a.keyboard.press("n");await a.mouse.click(650,400);await a.getByLabel("Objekttext bearbeiten").fill("Neue gemeinsame Notiz");await a.keyboard.press("Escape");
    await expect(b.getByTestId("board-node")).toHaveCount(2);await expect(v.getByTestId("board-node")).toHaveCount(2);
    await request.post(`/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.token}`},data:{action:"sharing",role:"edit"}});
    await expect(b.getByLabel("Boardname")).not.toHaveAttribute("readonly");
    await b.getByTestId("board-node").filter({hasText:"start"}).dblclick();await b.getByLabel("Objekttext bearbeiten").fill("Vom Gast bearbeitet");await b.keyboard.press("Escape");
    await expect(a.getByTestId("board-node").filter({hasText:"Vom Gast bearbeitet"})).toHaveCount(1);
    await a.reload();await expect(a.getByTestId("board-node")).toHaveCount(2);
    await request.post(`/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.token}`},data:{action:"sharing",role:"view"}});
    await expect(v.getByLabel("Boardname")).toHaveAttribute("readonly","");
    const denied=await request.post(`/api/boards?id=${session.id}`,{headers:{Authorization:`Bearer ${session.viewToken}`},data:{patch:{title:"Angriff",nodes:[],edges:[],deletedNodes:[],deletedEdges:[]}}});expect(denied.status()).toBe(403);
    const forbidden=await request.get(`/api/boards?id=${session.id}`,{headers:{Authorization:"Bearer xxxxxxxxxxxxxxxxxxxxxxxx"}});expect(forbidden.status()).toBe(403);
    await v.getByRole("application").focus();await v.keyboard.press("n");await v.mouse.click(800,600);await expect(v.getByLabel("Objekttext bearbeiten")).toHaveCount(0);await expect(v.getByTestId("board-node")).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {await owner.close();await guest.close();await viewer.close();}
});
test("Gleichzeitige Änderungen verschiedener Objekte bleiben erhalten; der Server speichert dauerhaft",async({request})=>{
  const created=await request.post("/api/boards",{data:{action:"create",doc:{version:1,title:"Parallel",nodes:[note("a"),note("b",500)],edges:[]}}});const s=await created.json();
  const patch=(id:string,x:number)=>request.post(`/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`},data:{patch:{nodes:[{...note(id),x}],edges:[],deletedNodes:[],deletedEdges:[]}}});
  const results=await Promise.all([patch("a",777),patch("b",888)]);expect(results.every(r=>r.ok())).toBeTruthy();
  const read=await request.get(`/api/boards?id=${s.id}`,{headers:{Authorization:`Bearer ${s.token}`}});const data=await read.json();expect(data.doc.nodes.map((n:{x:number})=>n.x)).toEqual([777,888]);
});
