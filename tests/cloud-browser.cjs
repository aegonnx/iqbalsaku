const {chromium}=require('C:/Users/Iqbal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const rows=new Map(),dist=path.resolve(__dirname,'../dist');let offline=false;
 const jwt=id=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');
 const user=id=>({id,email:id+'@example.test',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString()});
 async function context(){
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await c.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='saku-sync.test'){
    const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const ext=path.extname(file),type={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[ext]||'application/json';
    return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});
   }
   if(url.hostname.endsWith('.supabase.co')){
    if(offline)return route.abort();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS,DELETE'};
    const respond=(body,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS')return respond({});
    if(url.pathname==='/auth/v1/token'){
     const id=JSON.parse(req.postData()).email.split('@')[0];return respond({access_token:jwt(id),refresh_token:'refresh-'+id,expires_in:3600,token_type:'bearer',user:user(id)});
    }
    if(url.pathname==='/auth/v1/logout')return respond({});
    if(url.pathname==='/auth/v1/user')return respond(user('alice'));
    const token=req.headers().authorization?.replace('Bearer ','');let id;
    try{id=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;}catch{return respond({message:'Unauthorized'},401);}
    if(url.pathname==='/rest/v1/expense_accounts'){
     const row=rows.get(id);return respond(row?[url.searchParams.get('select')==='revision'?{revision:row.revision}:row]:[]);
    }
    if(url.pathname==='/rest/v1/rpc/save_expenses'){
     const data=JSON.parse(req.postData()),old=rows.get(id);if((old?.revision||0)!==data.expected_revision)return respond({code:'40001',message:'Changed elsewhere'},409);
     const row={state:data.document,revision:data.expected_revision+1};rows.set(id,row);return respond(row);
    }
    return respond({message:'Unhandled test request'},400);
   }
   return route.abort();
  });return c;
 }
 const contexts=[],errors=[];const make=async()=>{const c=await context();contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('https://saku-sync.test/#settings');await p.locator('[data-action=cloud-signin]').waitFor();return p;};
 const signIn=async(p,id)=>{await p.locator('[data-action=cloud-signin]').click();await p.locator('#confirm-form [name=email]').fill(id+'@example.test');await p.locator('#confirm-form [name=password]').fill('synthetic-password');await p.locator('button[form=confirm-form]').click();await p.locator('[data-action=cloud-sync]').waitFor();await p.waitForFunction(()=>!document.getElementById('confirm-dialog').open);};
 const sync=async p=>{await p.locator('[data-action=cloud-sync]').click();await p.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(n=>n.textContent==='Synced online'));};
 const add=async(p,amount)=>{await p.locator('.nav-add').click();await p.locator('#expense-amount').fill(String(Number(amount)/1000));await p.locator('button[form=expense-form]').click();await p.waitForFunction(()=>!document.getElementById('expense-dialog').open);};
 try{
  const a=await make();await add(a,'10000');
  await a.locator('#budget-form [name=overall]').fill('500');await a.locator('#budget-form [name=budget-makan]').fill('100');await a.locator('#budget-form [type=submit]').click();await a.waitForFunction(()=>document.getElementById('budget-form').elements.overall.value==='500');
  assert.equal(await a.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return (await new ExpenseRepository().load()).budgets['2026-10'].overall;}),500000);
  await a.locator('.settings-section').filter({has:a.locator('summary',{hasText:'Quick expenses'})}).locator('summary').first().click();await a.locator('[data-action=new-quick]').click();await a.locator('#confirm-form [name=description]').fill('Test quick expense');await a.locator('#confirm-form [name=amount]').fill('15');await a.locator('button[form=confirm-form]').click();await a.waitForFunction(()=>!document.getElementById('confirm-dialog').open);
  assert.equal(await a.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return (await new ExpenseRepository().load()).quickExpenses[0].amount;}),15000);
  await a.locator('[data-page=transactions]').click();await a.locator('.transaction-edit').click();assert.equal(await a.locator('#expense-amount').inputValue(),'10');await a.locator('button[form=expense-form]').click();await a.waitForFunction(()=>!document.getElementById('expense-dialog').open);await a.locator('.topbar [data-page=settings]').click();await signIn(a,'alice');assert.equal(rows.has('alice'),false);
  await add(a,'15000');await sync(a);assert.equal(rows.get('alice').state.transactions[0].amount,15000);
  const b=await make();await signIn(b,'alice');await sync(b);await b.locator('[data-page=transactions]').click();assert.equal(await b.locator('[data-testid=spent]').textContent(),'Rp15.000');
  await b.locator('.transaction-edit').click();await b.locator('#expense-amount').fill('20');await b.locator('button[form=expense-form]').click();await b.waitForFunction(()=>!document.getElementById('expense-dialog').open);await b.locator('.topbar [data-page=settings]').click();await sync(b);await sync(a);assert.equal(rows.get('alice').state.transactions[0].amount,20000);
  offline=true;await add(a,'5000');await a.waitForFunction(()=>[...document.querySelectorAll('[data-sync-status]')].some(n=>n.textContent.includes('Waiting to sync')));await a.reload();await a.locator('[data-action=cloud-sync]').waitFor();assert.equal(await a.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');const store=new ExpenseRepository();return (await store.readRecord('cloud:alice')).pending.transactions.length;}),2);
  offline=false;await sync(a);assert.equal(rows.get('alice').state.transactions.length,2);
  await a.locator('[data-action=cloud-signout]').click();await a.locator('[data-action=cloud-signin]').waitFor();await a.locator('[data-page=transactions]').click();assert.equal(await a.locator('[data-testid=spent]').textContent(),'Rp10.000');
  await a.locator('.topbar [data-page=settings]').click();await signIn(a,'bob');await a.locator('[data-page=transactions]').click();assert.equal(await a.locator('[data-testid=spent]').textContent(),'Rp0');
  const bob=rows.get('bob')||{state:structuredClone(rows.get('alice').state),revision:0};bob.state.transactions=[{id:'refresh-test',amount:7000,categoryId:'makan',date:'2026-10-07',description:'Refresh test',note:'',createdAt:new Date().toISOString()}];bob.revision++;rows.set('bob',bob);
  await a.evaluate(()=>{window.scrollTo(0,0);const target=document.body;const touch=y=>new Touch({identifier:1,target,clientX:180,clientY:y});target.dispatchEvent(new TouchEvent('touchstart',{touches:[touch(150)],bubbles:true}));target.dispatchEvent(new TouchEvent('touchmove',{touches:[touch(270)],bubbles:true,cancelable:true}));target.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true}));});
  await a.waitForFunction(()=>document.querySelector('.pull-refresh')?.getAttribute('aria-label')==='Updated');assert.equal(await a.locator('[data-testid=spent]').textContent(),'Rp7.000');
  await a.locator('.transaction-edit').click();assert.equal(await a.locator('#expense-amount').inputValue(),'7');assert.equal(await a.locator('#amount-unit').count(),0);assert.equal(await a.locator('[data-delete-expense]').locator('..').getAttribute('class'),'form-actions');
  assert.equal(await a.evaluate(()=>document.activeElement.matches('input,textarea,select')),false);await a.locator('#expense-amount').tap();
  await a.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:400});window.visualViewport.dispatchEvent(new Event('resize'));});
  await a.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));const footer=await a.locator('#expense-dialog .dialog-inner>.form-actions').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=401,JSON.stringify(footer));assert.equal(await a.locator('.bottom-nav').isVisible(),false);
  await a.locator('#expense-amount').fill('8');await a.locator('button[form=expense-form]').tap();await a.waitForFunction(()=>!document.getElementById('expense-dialog').open);assert.equal(await a.locator('[data-testid=spent]').textContent(),'Rp8.000');await a.locator('.transaction-edit').click();await a.locator('[data-delete-expense]').tap();await a.locator('#confirm-dialog').waitFor({state:'visible'});await a.locator('button[form=confirm-form]').tap();await a.waitForFunction(()=>!document.getElementById('confirm-dialog').open&&!document.getElementById('expense-dialog').open);assert.equal(await a.locator('[data-testid=spent]').textContent(),'Rp0');
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS mobile sign-in, two-device sync, edit, offline reload/reconnect, sign-out data preservation, account isolation, 390px layout, thousand-input budgets/quick/edit, pull refresh, fixed Save/Delete footer, simulated keyboard Save/Delete touch taps');
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
