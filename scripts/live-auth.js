async(host,testCookie)=>{
 const browser=host.context().browser(),owner=await browser.newContext({viewport:{width:1440,height:1000}}),guest=await browser.newContext({viewport:{width:1440,height:1000}});
 const a=await owner.newPage(),b=await guest.newPage(),passed=[],errors=[];
 [a,b].forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
 const check=(ok,label)=>{if(!ok)throw Error(label);};
 const wait=async(fn,label)=>{for(let i=0;i<80;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error(label);};
 let board;
 try{
  await a.goto('http://localhost:3001/');await a.getByRole('heading',{name:'Dein Raum für Ideen.',exact:true}).waitFor();
  check(await a.getByRole('link',{name:'Mit GitHub anmelden',exact:true}).count()===1,'GitHub login visible');
  const rejected=await a.request.post('http://localhost:3001/api/boards',{data:{action:'create',doc:{version:1,title:'Not allowed',nodes:[],edges:[]}}});check(rejected.status()===401,'Anonymous board creation denied');
  check((await a.request.get('http://localhost:3001/api/boards')).status()===401,'Anonymous listing denied');
  await a.goto('http://localhost:3001/dashboard');await a.getByRole('heading',{name:'Dein Raum für Ideen.',exact:true}).waitFor();
  await a.goto('http://localhost:3001/board');await a.getByRole('heading',{name:'Dein Raum für Ideen.',exact:true}).waitFor();
  passed.push('Anonymous start page offers GitHub login','Dashboard and local editor require login','Anonymous API listing and creation denied');
  const start=await a.request.get('http://localhost:3001/api/auth/github',{maxRedirects:0});
  const destination=new URL(start.headers().location);check(destination.origin==='https://github.com'&&destination.pathname==='/login/oauth/authorize','GitHub OAuth destination');
  check(destination.searchParams.get('code_challenge_method')==='S256'&&destination.searchParams.has('state'),'PKCE and state');
  check(destination.searchParams.get('redirect_uri')==='http://localhost:3001/api/auth/github/callback','Registered callback');
  const stateCookie=(await owner.cookies()).find(c=>c.name==='whiteboard_github_oauth');check(stateCookie?.httpOnly&&stateCookie.sameSite==='Lax','Protected transaction cookie');
  const invalid=await a.request.get('http://localhost:3001/api/auth/github/callback?code=invalid&state=not-the-original-state',{maxRedirects:0});check(new URL(invalid.headers().location).searchParams.get('login')==='invalid_state','Invalid state refused');
  passed.push('OAuth redirects to real GitHub with PKCE and state','OAuth transaction is HttpOnly/SameSite','Invalid callback state denied');
  // A controlled signed session tests the application after GitHub verification.
  // This is an isolated test fixture, not a replacement for the user's real login.
  if(!testCookie)throw Error('A controlled owner test cookie is required');
  await owner.addCookies([testCookie]);
  await a.goto('http://localhost:3001/dashboard');await a.getByRole('heading',{name:'Alle Boards',exact:true}).waitFor();
  check(await a.locator('.dashboard-workspace').count()===0&&await a.locator('.dashboard-profile').count()===0,'Requested sidebar sections removed');
  check((await (await a.request.get('http://localhost:3001/api/auth/session')).json()).user.login==='erikivanov','Allowed owner session');
  passed.push('Allowed owner session opens dashboard','Both requested sidebar blocks removed');
  await a.getByRole('button',{name:'Neues Board',exact:true}).last().click();await a.getByRole('textbox',{name:'Boardname',exact:true}).fill('OAuth test board');await a.getByRole('button',{name:'Board erstellen',exact:true}).click();
  await wait(async()=>new URL(a.url()).pathname==='/board','Create after login');
  await wait(async()=>await a.getByRole('button',{name:'Teilen',exact:true}).isEnabled(),'Owner board ready');
  const url=new URL(a.url());board={id:url.searchParams.get('board'),token:new URLSearchParams(url.hash.slice(1)).get('token')};
  const read=await a.request.get('http://localhost:3001/api/boards?id='+board.id,{headers:{Authorization:'Bearer '+board.token}});const record=await read.json();
  const listing=await a.request.get('http://localhost:3001/api/boards');check((await listing.json()).items.some(item=>item.id===board.id),'Owner server listing');
  passed.push('Owner creates board from dashboard','Owned boards are listed server-side');
  await b.goto('http://localhost:3001/board?board='+board.id+'#token='+record.shareToken);await wait(async()=>await b.getByLabel('Boardname').inputValue()==='OAuth test board','Anonymous guest board');
  check(await b.getByLabel('Boardname').getAttribute('readonly')!==null,'Guest view permission');
  const privateRead=await b.request.get('http://localhost:3001/api/boards?id='+board.id,{headers:{Authorization:'Bearer '+board.token}});check(privateRead.status()===401,'Owner key alone no longer grants access');
  passed.push('Guest links remain usable without login','Owner capability also requires GitHub session');
  await a.getByRole('link',{name:'Zur Boardübersicht'}).click();await a.getByRole('button',{name:'Abmelden',exact:true}).click();await a.getByRole('heading',{name:'Dein Raum für Ideen.',exact:true}).waitFor();
  check((await (await a.request.get('http://localhost:3001/api/auth/session')).json()).user===null,'Logout cleared session');
  check((await a.request.post('http://localhost:3001/api/boards',{data:{action:'create',doc:{version:1,title:'No',nodes:[],edges:[]}}})).status()===401,'Creation denied after logout');
  passed.push('Logout returns to login and revokes local session');
  await owner.addCookies([{...testCookie,value:testCookie.value+'tampered'}]);await a.goto('http://localhost:3001/dashboard');await a.getByRole('heading',{name:'Dein Raum für Ideen.',exact:true}).waitFor();
  passed.push('Tampered cookie cannot open dashboard');
  await a.setViewportSize({width:390,height:844});check(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile login fits');
  passed.push('Login works at mobile width');check(errors.length===0,errors.join(';'));return{passed,pageErrors:errors};
 }catch(e){return{passed,error:String(e),pageErrors:errors,body:(await a.locator('body').innerText()).slice(-1000)};}
 finally{if(board&&testCookie){await owner.addCookies([testCookie]);await a.request.post('http://localhost:3001/api/boards?id='+board.id,{headers:{Authorization:'Bearer '+board.token},data:{action:'delete'}});}await owner.close();await guest.close();}
}
