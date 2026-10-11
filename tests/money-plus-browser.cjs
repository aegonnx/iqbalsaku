const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const origin=process.env.SAKU_TEST_URL || 'http://localhost:4173';
const close=page=>page.waitForFunction(()=>!document.querySelector('dialog[open]'));
const read=page=>page.evaluate(async()=>new (await import('./money-plus-storage.mjs')).IncomeRepository().load());
const total=page=>page.locator('[data-testid="income-total"]');
const sample={app:'iqbal-saku-money-plus',version:1,entries:[{id:'imported-gift',amount:125000,date:'2026-10-16',source:'gift',title:'Birthday gift',note:'Synthetic test record',createdAt:1}]};

(async()=>{
 const browser=await chromium.launch(launchOptions),errors=[];
 try {
  for(const width of [320,390,430])for(const theme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
   await context.addInitScript(theme=>localStorage.setItem('iqbal-saku-theme',theme),theme);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/');
   assert.equal(await page.locator('.app-choice').count(),2);
   await page.getByRole('link',{name:/Open Money Plus/}).click();
   await total(page).waitFor();
   // Existing device expense state must survive the new app, including budgets.
   const expenseBefore=await page.evaluate(async()=>{
    const {ExpenseRepository}=await import('./storage.mjs'),{seedState}=await import('./model.mjs');
    const repository=new ExpenseRepository(),state=seedState();
    state.transactions=[{id:'existing-expense',amount:50000,description:'Synthetic lunch',date:'2026-10-10',categoryId:'makan',note:'',createdAt:'2026-10-10T00:00:00Z'}];
    state.budgets['2026-10']={overall:2500000,categories:{makan:800000}};
    await repository.save(state);return repository.load();
   });
   assert.equal(await total(page).textContent(),'Rp0');
   await page.getByRole('button',{name:'Add income',exact:true}).click();
   await page.locator('#income-amount').fill('500');
   assert.equal(await page.locator('#income-amount-preview').textContent(),'Rp500.000');
   await page.locator('[name="date"]').fill('2026-10-15');
   await page.getByRole('button',{name:'Save income',exact:true}).click();await close(page);
   assert.equal(await total(page).textContent(),'Rp500.000');
   assert.equal(await page.locator('[data-testid="income-extra"]').textContent(),'Rp500.000');
   await page.reload();await total(page).waitFor();
   await page.locator('#income-month').fill('2026-10');
   await page.locator('.income-row').first().click();
   await page.locator('#income-amount').fill('750');
   await page.getByRole('button',{name:'Save changes',exact:true}).click();await close(page);
   assert.equal(await total(page).textContent(),'Rp750.000');
   await page.getByRole('button',{name:'Add income',exact:true}).click();
   await page.locator('#income-amount').fill('7000');
   await page.locator('#income-source').selectOption('salary');
   await page.locator('[name="date"]').fill('2026-10-01');
   await page.getByRole('button',{name:'Save income',exact:true}).click();await close(page);
   assert.equal(await total(page).textContent(),'Rp7.750.000');
   await page.locator('#income-search').fill('Work bonus');
   assert.equal(await page.locator('.income-row').count(),1);
   assert.equal(await total(page).textContent(),'Rp7.750.000');
   await page.locator('#income-search').fill('');
   await page.locator('#income-source-filter').selectOption('salary');
   assert.equal(await page.locator('.income-row').count(),1);
   await page.locator('#income-source-filter').selectOption('');
   await page.getByRole('button',{name:'Next month'}).click();
   assert.equal(await total(page).textContent(),'Rp0');
   await page.getByRole('button',{name:'Previous month'}).click();
   await page.getByRole('button',{name:'Overview',exact:true}).click();
   assert.equal(await page.locator('.income-source').count(),2);
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('button',{name:'Download JSON backup'}).click();
   const download=await downloadPromise,backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
   assert.equal(backup.app,'iqbal-saku-money-plus');assert.equal(backup.entries.length,2);
   const upload=data=>page.locator('#income-import').setInputFiles({name:'income.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await upload(sample);
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await close(page);
   assert.equal((await read(page)).entries.length,2);
   await upload(sample);await page.getByRole('button',{name:'Import income',exact:true}).click();await close(page);
   assert.equal((await read(page)).entries.length,3);
   await upload(sample);assert.equal((await read(page)).entries.length,3);
   const changed=structuredClone(sample);changed.entries[0].amount=225000;
   await upload(changed);await page.locator('[name="conflict"][value="backup"]').check();
   await page.getByRole('button',{name:'Import income',exact:true}).click();await close(page);
   assert.equal((await read(page)).entries.find(entry=>entry.id==='imported-gift').amount,225000);
   await upload({version:1,transactions:[]});
   await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Choose a Money Plus'));
   // Opening an edit, then modifying it in another tab must not overwrite that change.
   await page.getByRole('button',{name:'Income',exact:true}).click();
   await page.getByRole('button',{name:/Edit Birthday gift/}).click();
   await page.evaluate(async()=>new (await import('./money-plus-storage.mjs')).IncomeRepository().update(state=>{state.entries.find(entry=>entry.id==='imported-gift').amount=325000;}));
   await page.locator('#income-amount').fill('400');
   await page.getByRole('button',{name:'Save changes',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#income-error').textContent.includes('another tab'));
   assert.equal((await read(page)).entries.find(entry=>entry.id==='imported-gift').amount,325000);
   await page.getByRole('button',{name:'Close income form'}).click();await close(page);
   await page.reload();await total(page).waitFor();await page.locator('#income-month').fill('2026-10');
   await page.getByRole('button',{name:/Edit Birthday gift/}).click();
   await page.getByRole('button',{name:'Delete',exact:true}).click();
   await page.getByRole('button',{name:'Delete income',exact:true}).click();await close(page);
   assert.equal((await read(page)).entries.length,2);
   // Atomic transactions retain concurrent additions and reject invalid writes.
   await page.evaluate(async()=>{
    const {IncomeRepository}=await import('./money-plus-storage.mjs');
    await Promise.all(['tab-a','tab-b'].map(id=>new IncomeRepository().update(state=>state.entries.push({id,amount:1000,date:'2026-10-17',source:'other',title:id,note:'',createdAt:2}))));
   });
   assert.equal((await read(page)).entries.length,4);
   const clean=await read(page);
   assert.equal(await page.evaluate(async()=>{
    try {await new (await import('./money-plus-storage.mjs')).IncomeRepository().update(state=>state.entries[0].amount=-1);return false;}catch{return true;}
   }),true);
   assert.deepEqual(await read(page),clean);
   assert.deepEqual(await page.evaluate(async()=>new (await import('./storage.mjs')).ExpenseRepository().load()),expenseBefore);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(width===390&&theme==='light')await page.screenshot({path:'output/money-plus.png',fullPage:true});
   await page.getByRole('link',{name:'All apps'}).click();
   await page.getByRole('link',{name:/Open expenses/}).click();await page.locator('.nav-add').waitFor();
   await page.locator('#selected-month').fill('2026-10');
   assert.equal(await page.locator('[data-testid="spent"]').textContent(),'Rp50.000');
   assert.deepEqual(await page.evaluate(async()=>new (await import('./storage.mjs')).ExpenseRepository().load()),expenseBefore);
   await page.getByRole('link',{name:'Iqbal Saku home'}).click();
   if(width===390&&theme==='light')await page.screenshot({path:'output/home.png',fullPage:true});
   await page.goto(origin+'/#settings');await page.locator('.nav-add').waitFor();
   assert.match(page.url(),/expenses\.html#settings$/);
   await context.close();
  }
  // A separate browser context uses the real service worker, not request mocks.
  const offlineContext=await browser.newContext({viewport:{width:390,height:844}});
  const offlinePage=await offlineContext.newPage();offlinePage.on('pageerror',error=>errors.push(error.message));
  await offlinePage.goto(origin+'/');
  await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)resolve();else navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});});
  await offlineContext.setOffline(true);
  await offlinePage.getByRole('link',{name:/Open Money Plus/}).click();await total(offlinePage).waitFor();
  await offlinePage.getByRole('button',{name:'Add income',exact:true}).click();await offlinePage.locator('#income-amount').fill('100');
  await offlinePage.getByRole('button',{name:'Save income',exact:true}).click();await close(offlinePage);
  await offlinePage.reload();await total(offlinePage).waitFor();assert.equal(await total(offlinePage).textContent(),'Rp100.000');
  await offlinePage.goto(origin+'/money-plus');await total(offlinePage).waitFor();assert.equal(await total(offlinePage).textContent(),'Rp100.000');
  await offlinePage.goto(origin+'/expenses');await offlinePage.locator('.nav-add').waitFor();
  await offlinePage.goto(origin+'/');assert.equal(await offlinePage.locator('.app-choice').count(),2);
  await offlineContext.close();
  assert.deepEqual(errors,[]);
  console.log('Money Plus passed at 320/390/430px in both themes: CRUD, totals, filters, backups, concurrency, expense isolation, legacy links, and offline navigation.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
