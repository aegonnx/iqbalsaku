const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const origin=process.env.SAKU_TEST_ORIGIN||'http://localhost:4173';
const oldIncome={app:'iqbal-saku-money-plus',version:1,entries:[
 {id:'saved-salary',amount:5000000,date:'2026-10-01',source:'salary',title:'Salary',note:'Saved before consolidation',createdAt:1},
 {id:'saved-bonus',amount:500000,date:'2026-10-15',source:'bonus',title:'Old work bonus',note:'',createdAt:2}
]};
(async()=>{
 const browser=await chromium.launch(launchOptions),contexts=[],errors=[];
 async function make(width=390,theme='light',serviceWorkers='block'){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers});contexts.push(context);
  await context.addInitScript(theme=>localStorage.setItem('iqbal-saku-theme',theme),theme);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/');await page.locator('[data-action=add-income]').waitFor();
  await page.locator('#selected-month').fill('2026-10');return {page,context};
 }
 const read=page=>page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return new ExpenseRepository().load();});
 const closed=(page,name)=>page.waitForFunction(name=>!document.getElementById(name+'-dialog').open,name);
 const navRead=page=>page.locator('[data-page=transactions]').click();
 async function budget(page,overall='5000'){
  await page.locator('.topbar [data-page=settings]').click();await page.locator('#budget-form [name=overall]').fill(overall);await page.locator('#budget-form [name=budget-makan]').fill('1500');await page.locator('#budget-form [type=submit]').click();
  await page.waitForFunction(async amount=>{const {ExpenseRepository}=await import('./storage.mjs');return (await new ExpenseRepository().load()).budgets['2026-10']?.overall===amount;},Number(overall)*1000);await navRead(page);
 }
 async function addIncome(page,amount='500',source='bonus',date='2026-10-15',title='Work bonus'){
  await page.locator('[data-action=add-income]').click();await page.locator('#income-amount').fill(amount);await page.locator('#income-form [name=source]').selectOption(source);await page.locator('#income-form [name=date]').fill(date);await page.locator('#income-form [name=title]').fill(title);await page.locator('#income-form [name=note]').fill('Optional note');await page.locator('button[form=income-form]').click();await closed(page,'income');
 }
 async function addExpense(page){
  await page.locator('.nav-add').click();await page.locator('#expense-amount').fill('1000');await page.locator('button[form=expense-form]').click();await closed(page,'expense');
 }
 async function remaining(page,amount){assert.equal((await page.locator('[data-testid=remaining]').textContent()).replace(/\s/g,''),amount);}
 async function dataSection(page){await page.locator('.topbar [data-page=settings]').click();const details=page.locator('.settings-section').filter({has:page.locator('summary',{hasText:'Your data'})});if(!await details.evaluate(el=>el.open))await details.locator('summary').first().click();}
 async function deleteIncome(page){await page.locator('[data-delete-income]').click();await page.locator('button[form=confirm-form]').click();await closed(page,'confirm');await closed(page,'income');}
 try{
  for(const width of [320,390,430])for(const theme of ['light','dark']){
   const {page}=await make(width,theme);assert.equal(await page.getByText(/Verse|Money Plus/).count(),0);assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('.brand').textContent(),'SiDompet');assert.equal(await page.locator('.simple-budget-row').count(),0);
   await budget(page);await addIncome(page);assert.equal(await page.locator('[data-testid=extra-income]').textContent(),'Rp500.000');await addExpense(page);assert.equal(await page.locator('#history-list [data-action=edit-income]').count(),1);assert.equal(await page.locator('#history-list [data-action=edit]').count(),1);assert.equal(await page.locator('#history-list .money-in').textContent(),'+Rp500.000');assert.equal(await page.locator('#history-list .money-out').textContent(),'−Rp1.000.000');await remaining(page,'Rp4.500.000');assert.equal(await page.locator('[data-testid=starting-budget]').textContent(),'Rp5.000.000');assert.equal(await page.locator('[data-testid=spent]').textContent(),'Rp1.000.000');assert.equal(await page.locator('[data-testid=available]').textContent(),'Rp5.500.000');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('[data-action=edit-income]').click();assert.equal(await page.locator('#income-amount').inputValue(),'500');assert.equal(await page.locator('#income-form [name=source]').inputValue(),'bonus');assert.equal(await page.locator('#income-form [name=note]').inputValue(),'Optional note');await page.locator('#income-amount').fill('750');await page.locator('button[form=income-form]').click();await closed(page,'income');await remaining(page,'Rp4.750.000');
   await page.locator('[data-page=reports]').click();assert.equal(await page.locator('.report-budget strong').textContent(),'Rp5.750.000');assert.equal(await page.locator('.report-total').textContent(),'Rp1.000.000');assert.match(await page.locator('.category-limit').textContent(),/500\.000/);await navRead(page);
   // Existing expense edit/delete uses exactly the original center button and form.
   await page.locator('[data-action=edit]').click();await page.locator('#expense-amount').fill('900');await page.locator('button[form=expense-form]').click();await closed(page,'expense');await remaining(page,'Rp4.850.000');
   await page.locator('[data-action=edit]').click();await page.locator('[data-delete-expense]').click();await page.locator('button[form=confirm-form]').click();await closed(page,'confirm');await closed(page,'expense');await remaining(page,'Rp5.750.000');
   await page.locator('[data-action=edit-income]').click();await deleteIncome(page);await remaining(page,'Rp5.000.000');assert.equal((await read(page)).transactions.length,0);assert.equal((await read(page)).income.length,0);
   await page.context().close();
  }
  const {page}=await make();
  // Seed the original databases with synthetic pre-upgrade data.
  await page.evaluate(async old=>{
   const {seedState}=await import('./model.mjs');const {ExpenseRepository}=await import('./storage.mjs');const state=seedState();delete state.income;delete state.legacyIncomeImports;state.budgets['2026-10']={overall:5000000,categories:{makan:1500000}};state.transactions=[{id:'old-expense',amount:1000000,date:'2026-10-07',categoryId:'makan',description:'Existing expense',note:'Keep me',createdAt:'2026-10-07T00:00:00Z'}];await new ExpenseRepository().writeRecord('current',state);
   await new Promise((resolve,reject)=>{const request=indexedDB.open('saku-money-plus-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(old,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  },oldIncome);
  await page.reload();await page.locator('[data-action=edit-income]').first().waitFor();await remaining(page,'Rp4.500.000');let migrated=await read(page);assert.equal(migrated.income.length,2);assert.equal(migrated.transactions[0].note,'Keep me');assert.equal(migrated.budgets['2026-10'].categories.makan,1500000);
  await page.reload();await page.locator('[data-action=edit-income]').first().waitFor();assert.equal((await read(page)).income.length,2);
  const old=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('saku-money-plus-v1');r.onsuccess=()=>{const db=r.result,t=db.transaction('state'),q=t.objectStore('state').get('current');q.onsuccess=()=>{db.close();resolve(q.result);};};}));assert.deepEqual(old,oldIncome);
  // A downloaded backup includes income and can restore without duplicate import.
  await dataSection(page);const downloaded=page.waitForEvent('download');await page.locator('[data-action=export-json]').click();const download=await downloaded,backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.income.length,2);assert.equal(backup.transactions.length,1);
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('button[form=confirm-form]').click();await closed(page,'confirm');await navRead(page);await remaining(page,'Rp4.500.000');
  await page.locator('[data-action=edit-income][data-id=legacy-money-plus-saved-bonus]').click();await deleteIncome(page);await remaining(page,'Rp4.000.000');await page.reload();await page.locator('[data-action=add-income]').waitFor();await remaining(page,'Rp4.000.000');assert.equal((await read(page)).income.length,1);
  await dataSection(page);await page.locator('#import-file').setInputFiles({name:'old-income.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldIncome))});await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('already been imported'));assert.equal((await read(page)).income.length,1);assert.equal(await page.locator('#confirm-dialog').isVisible(),false);
  const newOld={...oldIncome,entries:[...oldIncome.entries,{...oldIncome.entries[1],id:'new-gift',source:'gift',title:'A saved gift',amount:200000}]};await page.locator('#import-file').setInputFiles({name:'old-income.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(newOld))});await page.locator('button[form=confirm-form]').click();await closed(page,'confirm');await navRead(page);await remaining(page,'Rp4.200.000');
  await page.goto(origin+'/expenses.html#settings');await page.locator('#budget-form').waitFor();assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#settings');await page.goto(origin+'/money-plus.html');await page.locator('[data-action=add-income]').waitFor();assert.equal(new URL(page.url()).pathname,'/');
  // Configured period applies to incoming money too.
  await dataSection(page);await page.locator('.settings-section').filter({has:page.locator('summary',{hasText:'Preferences'})}).locator('summary').first().click();await page.locator('#preferences-form [name=startDay]').selectOption('8');await page.locator('#preferences-form [type=submit]').click();await navRead(page);await page.locator('#selected-month').fill('2026-10');await addIncome(page,'100','freelance','2026-11-07','Period payment');assert.equal(await page.locator('#selected-month').inputValue(),'2026-10');assert.equal(await page.locator('[data-testid=extra-income]').textContent(),'Rp300.000');
  // Fixed income Save/Delete footer with a simulated phone keyboard.
  await page.locator('[data-action=add-income]').click();await page.locator('#income-amount').fill('25');await page.waitForFunction(()=>!document.getElementById('income-dialog').dataset.motion);await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:400});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));
  let footer=await page.locator('#income-dialog .dialog-inner>.form-actions').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=401,JSON.stringify(footer));await page.locator('#income-dialog [data-expense-details]').tap();await page.locator('#income-form [name=date]').fill('2026-10-20');await page.locator('#income-form [name=note]').fill('Keyboard details');footer=await page.locator('#income-dialog .dialog-inner>.form-actions').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=401,JSON.stringify(footer));await page.locator('button[form=income-form]').tap();await closed(page,'income');assert.equal(await page.locator('[data-testid=extra-income]').textContent(),'Rp325.000');
  // Real service worker: income edits, expense entry, and old links work offline.
  const {page:offlinePage,context:offlineContext}=await make(390,'dark','allow');await budget(offlinePage);await addIncome(offlinePage);await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;});await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller!==null);await offlinePage.waitForFunction(async()=>{const keys=await caches.keys();const c=await caches.open('saku-shell-v27');return keys.includes('saku-shell-v27')&&Boolean(await c.match('/income-ui.mjs'));});
  await offlineContext.setOffline(true);await offlinePage.reload();await offlinePage.locator('[data-action=add-income]').waitFor();await addExpense(offlinePage);await remaining(offlinePage,'Rp4.500.000');await offlinePage.locator('[data-action=edit-income]').click();await offlinePage.locator('#income-amount').fill('600');await offlinePage.locator('button[form=income-form]').click();await closed(offlinePage,'income');await remaining(offlinePage,'Rp4.600.000');await offlinePage.goto(origin+'/money-plus');await offlinePage.locator('[data-action=add-income]').waitFor();assert.equal(new URL(offlinePage.url()).pathname,'/');await remaining(offlinePage,'Rp4.600.000');
  assert.deepEqual(errors,[]);console.log('PASS single root app, income/expense CRUD at 320/390/430px in both themes, exact 4.5m calculation, category reports, migration/retained old DB/no duplicates, JSON/legacy imports, old links, custom period, keyboard footer, real offline income and expense workflows');
 }finally{for(const context of contexts)await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
