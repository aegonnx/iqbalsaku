const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(launchOptions),dist=path.resolve(__dirname,'../dist');
 try{for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(theme=>localStorage.setItem('iqbal-saku-theme',theme),theme);
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='reports.test')return route.abort();
   if(url.pathname==='/supabase.mjs')return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}});'});
   const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname.slice(1));
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:{'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/json',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.clock.install({time:new Date('2026-10-14T12:00:00')});
  await page.goto('https://reports.test/#reports');await page.locator('.nav-add').waitFor();
  await page.evaluate(async()=>{
   const {seedState}=await import('./model.mjs'),{ExpenseRepository}=await import('./storage.mjs'),s=seedState();
   s.budgets['2026-10']={overall:100000,categories:{makan:40000}};
   s.transactions=[['Meal','makan',10000],['Dinner','dating',30000],['Snack','snack',20000]].map(([description,categoryId,amount],i)=>({id:'report-'+i,description,categoryId,amount,date:'2026-10-10',note:'',createdAt:'2026-10-10T00:00:00Z'}));
   s.summaries['2026-09']={total:125000,categories:{makan:125000}};s.budgets['2026-09']={overall:100000,categories:{}};
   await new ExpenseRepository().save(s);
  });await page.reload();await page.locator('.report-total').waitFor();
  await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp60.000');
  assert.equal(await page.locator('#spending-overview-title').textContent(),'Spending overview');
  assert.match(await page.locator('.control-notice p').textContent(),/ahead of an even daily pace/);
  assert.ok((await page.locator('.control-notice p').textContent()).length>200);
  assert.equal(await page.locator('.report-status').textContent(),'Keep an eye on spending');
  const toggle=page.locator('[data-action=toggle-overview]'),copy=page.locator('#spending-overview-copy');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  const collapsedHeight=(await copy.boundingBox()).height;
  await toggle.tap();assert.equal(await toggle.textContent(),'Read less');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok((await copy.boundingBox()).height>collapsedHeight);
  await toggle.tap();assert.equal(await toggle.textContent(),'Read more');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal((await copy.boundingBox()).height,collapsedHeight);
  if(theme==='dark'){fs.mkdirSync('tmp',{recursive:true});await page.locator('.control-notice').screenshot({path:'tmp/spending-overview-preview.png'});}
  assert.equal(await page.locator('.spending-strip>span').count(),3);
  assert.deepEqual(await page.locator('.category-share small').allTextContents(),['50.0%','33.3%','16.7%']);
  const categoryColors=await page.locator('.spending-strip>span').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));assert.equal(new Set(categoryColors).size,3);
  const footer=await page.locator('.bottom-nav').boundingBox();assert.equal(footer.y+footer.height,844);assert.equal(footer.width,320);
  await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();s.categories.reverse();await repo.save(s);});
  await page.reload();await page.locator('.spending-strip').waitFor();assert.deepEqual(await page.locator('.spending-strip>span').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor)),categoryColors);
  assert.equal(await page.locator('.report-budget-foot').textContent(),'60.0% usedRp40.000 left');
  await page.locator('[data-page=transactions]').tap();assert.equal(await page.locator('[data-testid=remaining]').textContent(),'Rp40.000');
  assert.equal(await page.locator('.simple-budget-row').count(),0);assert.equal(await page.locator('h2',{hasText:'Money in & out'}).count(),1);
  await page.locator('.bottom-nav [data-page=reports]').tap();
  await page.locator('#selected-month').fill('2026-09');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp125.000');assert.equal(await page.locator('.report-status').textContent(),'Over budget');assert.equal(await page.locator('.category-share small').textContent(),'100.0%');assert.equal(await page.locator('.simple-summary-note').count(),1);
  assert.match(await page.locator('.control-notice p').textContent(),/period has ended/);
  const summaryOnly=page.locator('.category-expenses[data-category=makan]');
  assert.equal(await summaryOnly.evaluate(node=>node.open),false);assert.match(await summaryOnly.locator('summary').textContent(),/View details/);
  await summaryOnly.locator('summary').tap();await summaryOnly.locator('.category-summary-note').waitFor();
  assert.match(await summaryOnly.locator('.category-summary-note').textContent(),/Rp125\.000/);assert.match(await summaryOnly.locator('.category-summary-note').textContent(),/no individual|not supplied/i);
  assert.equal(await summaryOnly.locator('.transaction').count(),0);
  await page.locator('#selected-month').fill('2026-11');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp0');assert.equal(await page.locator('.spending-strip').count(),0);assert.ok(await page.locator('.empty').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  // Category details contain this period's expenses, ranked by amount with stable ties.
  await page.evaluate(async()=>{
   const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();
   s.categories.find(c=>c.id==='dating').name='<img src=x onerror=alert(1)>';s.budgets['2026-10'].categories.dating=40000;
   s.transactions.push(...[
    ['detail-b','Equal B','dating',30000,'2026-10-12',''],
    ['detail-small','Coffee','dating',5000,'2026-10-13',''],
    ['detail-large','Trip <img src=x onerror=alert(1)>','dating',50000,'2026-10-11','Note <svg onload=alert(1)>'],
    ['detail-a','Equal A','dating',30000,'2026-10-12',''],
    ['detail-september','September meal','makan',10000,'2026-09-20','']
   ].map(([id,description,categoryId,amount,date,note])=>({id,description,categoryId,amount,date,note,createdAt:date+'T00:00:00Z'})));
   await repo.save(s);
  });
  await page.reload();await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.control-notice img').count(),0);assert.match(await page.locator('.control-notice p').textContent(),/<img src=x onerror=alert\(1\)>/);
  assert.deepEqual(await page.locator('.category-report-item .category-report-row .distribution-label strong').allTextContents(),['Rp145.000','Rp20.000','Rp10.000']);
  assert.equal(await page.locator('.category-expenses[open]').count(),0);
  const dating=page.locator('.category-expenses[data-category=dating]'),datingList=dating.locator('.category-expenses-list');
  assert.match(await dating.locator('summary').textContent(),/View 5 expenses/);assert.equal(await datingList.locator('.transaction').count(),0);
  await dating.locator('summary').tap();await datingList.locator('.transaction').first().waitFor();
  assert.deepEqual(await datingList.locator('.transaction-title').allTextContents(),['Trip <img src=x onerror=alert(1)>','Equal A','Equal B','Dinner','Coffee']);
  assert.deepEqual(await datingList.locator('.transaction-amount').allTextContents(),['−Rp50.000','−Rp30.000','−Rp30.000','−Rp30.000','−Rp5.000']);
  assert.match(await datingList.locator('.transaction-meta').first().textContent(),/11 Oct.*Note <svg onload=alert\(1\)>/);
  assert.equal(await datingList.locator('img,svg[onload]').count(),0);assert.equal(await datingList.locator('.transaction-edit').count(),5);
  assert.equal(await page.locator('.category-expenses[data-category=makan]').evaluate(node=>node.open),false);
  if(theme==='dark'){fs.mkdirSync('tmp',{recursive:true});await page.locator('.category-report').screenshot({path:'tmp/analyze-category-expenses-dark.png'});}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await datingList.locator('.transaction-edit[data-id=detail-large]').tap();await page.locator('#expense-dialog[open]').waitFor();
  assert.equal(await page.locator('#expense-description').inputValue(),'Trip <img src=x onerror=alert(1)>');assert.equal(await page.locator('#expense-form [name=date]').inputValue(),'2026-10-11');assert.equal(await page.locator('#expense-amount').inputValue(),'50');
  await page.locator('#expense-dialog [data-close]').tap();await page.waitForFunction(()=>!document.getElementById('expense-dialog').open);
  await dating.locator('summary').focus();await dating.locator('summary').press('Enter');assert.equal(await dating.evaluate(node=>node.open),false);assert.equal(await datingList.isVisible(),false);
  await dating.locator('summary').press('Space');await datingList.locator('.transaction').first().waitFor();assert.equal(await dating.evaluate(node=>node.open),true);
  assert.equal(await datingList.locator('.transaction').count(),5);
  await page.locator('#selected-month').fill('2026-09');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp135.000');assert.equal(await page.locator('.category-expenses[data-category=dating]').count(),0);
  const mixedSummary=page.locator('.category-expenses[data-category=makan]');
  assert.equal(await mixedSummary.evaluate(node=>node.open),false);assert.match(await mixedSummary.locator('summary').textContent(),/View 1 expense/);
  await mixedSummary.locator('summary').tap();await mixedSummary.locator('.transaction').waitFor();
  assert.deepEqual(await mixedSummary.locator('.transaction-title').allTextContents(),['September meal']);assert.match(await mixedSummary.locator('.transaction-meta').textContent(),/20 Sep/);
  assert.match(await mixedSummary.locator('.category-summary-note').textContent(),/Rp125\.000/);assert.match(await mixedSummary.locator('.category-summary-note').textContent(),/no individual|not supplied/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await context.close();console.log('PASS '+theme+': report totals, collapsed category expenses, descending amounts and tie order, dates, editing, keyboard expansion, escaped text, summary-only and mixed months, mobile layout');
 }}finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
