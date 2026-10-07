const {chromium}=require('C:/Users/Iqbal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),dist=path.resolve(__dirname,'../dist');
 const errors=[];
 async function create(width,theme,reduced=false){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference'});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='motion.test')return route.abort();
   if(url.pathname==='/supabase.mjs')return route.fulfill({contentType:'text/javascript',body:`export const createClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}});`});
   const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   const type={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/json';
   return route.fulfill({contentType:type,body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(theme=>{
   localStorage.setItem('iqbal-saku-theme',theme);window.__focus=[];document.addEventListener('focusin',event=>window.__focus.push(event.target.id));
   let height=null,offset=0;const viewport=visualViewport,originalHeight=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(viewport),'height').get;
   Object.defineProperty(viewport,'height',{get:()=>height??originalHeight.call(viewport)});Object.defineProperty(viewport,'offsetTop',{get:()=>offset});
   window.__keyboard=(value,top=0)=>{height=value;offset=top;viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));};
  },theme);
  await page.goto('https://motion.test/#transactions');await page.locator('.nav-add').waitFor();
  return {context,page};
 }
 const read=page=>page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return new ExpenseRepository().load();});
 const closed=page=>page.waitForFunction(()=>!document.getElementById('expense-dialog').open&&!document.getElementById('confirm-dialog').open);
 try{
 for(const width of [320,390,430])for(const theme of ['light','dark']){
  const {context,page}=await create(width,theme);
  try{
   for(let repeat=0;repeat<3;repeat++){
    await page.locator('.nav-add').tap();await page.waitForFunction(()=>document.getElementById('expense-dialog').open);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'expense-amount');
    await page.locator('#expense-amount').fill('500');await page.evaluate(()=>document.querySelector('.nav-add').click());assert.equal(await page.locator('#expense-amount').inputValue(),'500');
    assert.equal(await page.evaluate(()=>window.__focus.filter(id=>id==='expense-amount').length),repeat+1);
    await page.evaluate(()=>{for(const value of [800,740,670,580,500,400])window.__keyboard(value);});
    await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--visible-height')==='400px');
    await page.waitForFunction(()=>!document.getElementById('expense-dialog').dataset.motion);
    for(const [height,top] of [[400,0],[340,0],[360,75]]){
     await page.evaluate(([height,top])=>window.__keyboard(height,top),[height,top]);
     await page.waitForFunction(height=>document.documentElement.style.getPropertyValue('--visible-height')===height+'px',height);
     const geometry=await page.evaluate(()=>{
      const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
      return {category:rect('#expense-category'),amount:rect('#expense-amount'),form:rect('#expense-form'),footer:rect('#expense-dialog .dialog-inner>.form-actions'),scroll:document.getElementById('expense-form').scrollTop};
     });
     assert.ok(geometry.category.top>=geometry.form.top&&geometry.category.bottom<=geometry.form.bottom+1,JSON.stringify({width,theme,height,top,geometry}));
     assert.ok(geometry.category.bottom<=geometry.footer.top&&geometry.footer.bottom<=height+top+1,JSON.stringify(geometry));
     assert.ok(geometry.category.height>=44&&geometry.amount.height>=44);assert.equal(geometry.scroll,0);
    }
    await page.locator('#expense-category').selectOption('snack');
    await page.locator('#expense-dialog [data-close]').tap();await closed(page);await page.evaluate(()=>window.__keyboard(null));
    await page.waitForFunction(()=>!document.documentElement.classList.contains('keyboard-open'));
   }
   assert.equal((await read(page)).transactions.length,0);
   const interrupted=await page.evaluate(async()=>{document.querySelector('.nav-add').click();await new Promise(requestAnimationFrame);const dialog=document.getElementById('expense-dialog');const before=getComputedStyle(dialog).opacity;dialog.querySelector('[data-close]').click();return {before:Number(before),from:Number(dialog.getAnimations()[0].effect.getKeyframes()[0].opacity),phase:dialog.dataset.motion};});
   assert.equal(interrupted.phase,'closing');assert.ok(Math.abs(interrupted.before-interrupted.from)<.01);await closed(page);
   await page.locator('.nav-add').tap();await page.locator('#expense-amount').fill('500');await page.locator('#expense-category').selectOption('snack');
   await page.evaluate(()=>{const form=document.getElementById('expense-form');form.requestSubmit();form.requestSubmit();});await closed(page);
   let state=await read(page);assert.equal(state.transactions.length,1);assert.equal(state.transactions[0].amount,500000);assert.equal(state.transactions[0].categoryId,'snack');
   await page.locator('.transaction-edit').tap();assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea,select')),false);
   await page.locator('#expense-amount').tap();assert.equal(await page.evaluate(()=>document.activeElement.id),'expense-amount');await page.locator('#expense-amount').fill('501');
   await page.locator('.entry-details summary').first().tap();await page.locator('.entry-details summary').first().tap();await page.locator('[name=date]').fill('2026-10-07');
   await page.evaluate(()=>window.__keyboard(400));await page.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));
   await page.locator('[data-submit-form=expense-form]').tap();await closed(page);assert.equal((await read(page)).transactions[0].amount,501000);
   await page.evaluate(()=>window.__keyboard(null));await page.waitForFunction(()=>!document.documentElement.classList.contains('keyboard-open'));
   await page.locator('.transaction-edit').tap();assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea,select')),false);
   assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('keyboard-open')),false);
   await page.locator('[data-delete-expense]').tap();await page.locator('#confirm-dialog').waitFor({state:'visible'});
   await page.evaluate(()=>{const form=document.getElementById('confirm-form');form.requestSubmit();form.requestSubmit();});await closed(page);assert.equal((await read(page)).transactions.length,0);
   await page.locator('.topbar [data-page=settings]').tap();
   const prefs=page.locator('.settings-section').filter({has:page.locator('summary',{hasText:'Preferences'})});await prefs.locator('summary').first().tap();await prefs.locator('[name=defaultBudget]').fill('2500');await prefs.locator('[type=submit]').tap();
   await page.waitForFunction(()=>[...document.querySelectorAll('.settings-section[open]>summary')].some(summary=>summary.textContent==='Preferences'));
   await page.waitForFunction(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return (await new ExpenseRepository().load()).settings.defaultBudget===2500000;});assert.equal((await read(page)).settings.defaultBudget,2500000);
   await page.locator('[data-action=theme]').focus();await page.locator('[data-action=theme]').press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.action==='theme');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==='light'?'dark':'light');
   await page.locator('.bottom-nav [data-page=reports]').tap();await page.locator('.bottom-nav [data-page=transactions]').tap();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log(`PASS ${width}px ${theme}: Category visible without scrolling at 340–400px keyboard heights, Snack save, Edit without autofocus, keyboard after tapping amount, direct Delete, motion and navigation`);
  }finally{await context.close();}
 }
 const {context,page}=await create(390,'light',true);
 try{
  await page.locator('.nav-add').tap();assert.equal(await page.evaluate(()=>document.getElementById('expense-dialog').getAnimations().length),0);
  await page.locator('#expense-dialog [data-close]').tap();await closed(page);
  await page.locator('.topbar [data-page=settings]').tap();const prefs=page.locator('.settings-section').filter({has:page.locator('summary',{hasText:'Preferences'})});await prefs.locator('summary').first().tap();assert.equal(await prefs.evaluate(element=>element.getAnimations().length),0);
  console.log('PASS reduced motion: immediate dialogs and disclosures');
 }finally{await context.close();}
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
