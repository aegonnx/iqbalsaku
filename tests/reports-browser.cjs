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
  await page.locator('#selected-month').fill('2026-11');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp0');assert.equal(await page.locator('.spending-strip').count(),0);assert.ok(await page.locator('.empty').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  // Custom category names are displayed as text, including inside the overview.
  await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();s.categories.find(c=>c.id==='dating').name='<img src=x onerror=alert(1)>';s.budgets['2026-10'].categories.dating=40000;await repo.save(s);});
  await page.reload();await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.control-notice img').count(),0);assert.match(await page.locator('.control-notice p').textContent(),/<img src=x onerror=alert\(1\)>/);
  await context.close();console.log('PASS '+theme+': report chart percentages, totals, remaining balance, category budgets remain in reports, no Makan card on Read, historical summary, over-budget and empty months');
 }}finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
