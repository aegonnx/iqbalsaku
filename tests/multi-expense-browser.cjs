const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(launchOptions),dist=path.resolve(__dirname,'../dist');
 try{for(const width of [320,390])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(theme=>localStorage.setItem('iqbal-saku-theme',theme),theme);
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='multi.test')return route.abort();
   if(url.pathname==='/supabase.mjs')return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}});'});
   const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:{'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/json',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
  const read=()=>page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return new ExpenseRepository().load();});
  await page.goto('https://multi.test/#transactions');await page.locator('.nav-add').tap();await page.waitForFunction(()=>!document.getElementById('expense-dialog').dataset.motion);
  await page.locator('#expense-date').fill('2026-10-07');await page.locator('#expense-category').selectOption('snack');
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:340});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));
  const geometry=await page.locator('#expense-dialog .dialog-inner>.form-actions').boundingBox();assert.ok(geometry.y+geometry.height<=341);
  const buttons=await page.locator('#expense-dialog .form-actions button').evaluateAll(nodes=>nodes.map(n=>({height:n.offsetHeight,width:n.clientWidth,scroll:n.scrollWidth})));assert.equal(buttons.length,2);assert.equal(buttons[0].height,buttons[1].height);assert.ok(buttons.every(b=>b.height>=44&&b.scroll<=b.width));
  if(process.env.SAKU_SCREENSHOTS&&width===390){fs.mkdirSync(process.env.SAKU_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SAKU_SCREENSHOTS,'multi-'+theme+'.png')});}
  await page.locator('[data-save-another]').tap();await page.locator('#expense-error').filter({hasText:'positive amount'}).waitFor();assert.equal((await read()).transactions.length,0);assert.equal(await page.locator('[data-save-another]').isEnabled(),true);
  await page.locator('#expense-amount').fill('10');await page.locator('#expense-description').fill('First snack');
  await page.evaluate(()=>{window.__expenseForm=document.getElementById('expense-form');document.querySelector('[data-save-another]').click();document.querySelector('[data-save-another]').click();});
  await page.waitForFunction(()=>document.getElementById('expense-amount').value==='');
  assert.equal(await page.evaluate(()=>document.getElementById('expense-form')===window.__expenseForm&&document.getElementById('expense-dialog').open),true);
  assert.equal(await page.locator('#expense-date').inputValue(),'2026-10-07');assert.equal(await page.locator('#expense-category').inputValue(),'snack');assert.equal(await page.locator('#expense-description').inputValue(),'');assert.equal((await read()).transactions.length,1);
  const nextGeometry=await page.locator('#expense-dialog .dialog-inner>.form-actions').boundingBox();assert.ok(Math.abs(geometry.y-nextGeometry.y)<1);
  await page.locator('#expense-amount').fill('20');await page.locator('#expense-description').fill('Second snack');await page.locator('[data-save-another]').tap();await page.waitForFunction(()=>document.getElementById('expense-amount').value==='');
  await page.locator('#expense-amount').fill('30');await page.locator('[data-submit-form=expense-form]').tap();await page.waitForFunction(()=>!document.getElementById('expense-dialog').open);
  const state=await read();assert.equal(state.transactions.length,3);assert.ok(state.transactions.every(t=>t.date==='2026-10-07'));assert.equal(state.transactions.reduce((n,t)=>n+t.amount,0),60000);
  await page.reload();await page.locator('.nav-add').waitFor();assert.equal((await read()).transactions.length,3);
  await page.locator('.transaction-edit').first().tap();assert.equal(await page.locator('[data-save-another]').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea,select')),false);assert.deepEqual(errors,[]);
  await context.close();console.log('PASS '+width+' '+theme+': stable footer, same-date repeat saves, no duplicate saves, validation, normal final save, reload and unchanged edit controls');
 }}finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
