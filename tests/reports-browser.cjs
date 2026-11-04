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
  assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.category-chart').compareDocumentPosition(document.querySelector('.control-notice'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  assert.equal(await page.locator('.category-breakdown,.category-expenses').count(),0);assert.equal(await page.locator('.simple-more summary').textContent(),'Biggest expenses');
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
  assert.equal(await page.locator('.category-bar-fill').count(),3);
  const bar=page.locator('.category-bar[data-id=snack]');await bar.tap();assert.equal(await bar.getAttribute('aria-pressed'),'true');
  await page.locator('#chart-expenses .transaction').waitFor();assert.deepEqual(await page.locator('#chart-expenses .transaction-title').allTextContents(),['Snack']);assert.equal(await bar.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('.chart-selection-name').textContent(),'Snack');assert.equal(await page.locator('.chart-selection-amount').textContent(),'Rp20.000');assert.equal(await page.locator('.chart-selection-share').textContent(),'33.3% of spending');
  await page.locator('.category-bar[data-id=makan]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.chart-selection-name').textContent(),'Makan');assert.equal(await page.locator('.category-bar[aria-pressed=true]').count(),1);
  const barHeights=await page.locator('.category-bar-fill').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.ok(Math.abs(barHeights[0]/barHeights[1]-1.5)<.05);
  const categoryColors=await page.locator('.category-bar-fill').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));assert.equal(new Set(categoryColors).size,3);
  const footer=await page.locator('.bottom-nav').boundingBox();assert.equal(footer.y+footer.height,844);assert.equal(footer.width,320);
  await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();s.categories.reverse();await repo.save(s);});
  await page.reload();await page.locator('.category-chart').waitFor();assert.deepEqual(await page.locator('.category-bar-fill').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor)),categoryColors);
  assert.equal(await page.locator('.report-budget-foot').textContent(),'60.0% usedRp40.000 left');
  await page.locator('[data-page=transactions]').tap();assert.equal(await page.locator('[data-testid=remaining]').textContent(),'Rp40.000');
  assert.equal(await page.locator('.simple-budget-row').count(),0);assert.equal(await page.locator('h2',{hasText:'Money in & out'}).count(),1);
  await page.locator('.bottom-nav [data-page=reports]').tap();
  await page.locator('#selected-month').fill('2026-09');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp125.000');assert.equal(await page.locator('.report-status').textContent(),'Over budget');assert.equal(await page.locator('.chart-selection-share').textContent(),'100.0% of spending');assert.equal(await page.locator('.simple-summary-note').count(),1);
  assert.match(await page.locator('.control-notice p').textContent(),/period has ended/);
  await page.locator('.category-bar[data-id=makan]').tap();assert.match(await page.locator('#chart-expenses .category-summary-note').textContent(),/Rp125\.000/);assert.equal(await page.locator('#chart-expenses .transaction').count(),0);
  await page.locator('#selected-month').fill('2026-11');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp0');assert.equal(await page.locator('.category-chart').count(),0);assert.ok(await page.locator('.empty').isVisible());
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
  // Tapping the leading bar also opens details; switching bars replaces one bounded list.
  const chartDating=page.locator('.category-bar[data-id=dating]');await chartDating.tap();await page.locator('#chart-expenses .transaction').first().waitFor();
  assert.deepEqual(await page.locator('#chart-expenses .transaction-title').allTextContents(),['Trip <img src=x onerror=alert(1)>','Equal A','Equal B','Dinner','Coffee']);
  assert.equal(await page.locator('#chart-expenses img, #chart-expenses svg[onload]').count(),0);
  await page.locator('#chart-expenses .transaction-edit[data-id=detail-large]').tap();await page.locator('#expense-dialog[open]').waitFor();assert.equal(await page.locator('#expense-amount').inputValue(),'50');await page.locator('#expense-dialog [data-close]').tap();await page.waitForFunction(()=>!document.getElementById('expense-dialog').open);
  await page.locator('.category-bar[data-id=snack]').tap();await page.locator('#chart-expenses .transaction').waitFor();assert.deepEqual(await page.locator('#chart-expenses .transaction-title').allTextContents(),['Snack']);assert.equal(await page.locator('.category-bar[aria-expanded=true]').count(),1);
  await page.locator('[data-action=hide-chart-expenses]').tap();assert.equal(await page.locator('#chart-expenses').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'snack');
  await page.locator('.simple-more summary').tap();assert.deepEqual(await page.locator('.simple-more .transaction-amount').allTextContents(),['−Rp50.000','−Rp30.000','−Rp30.000']);assert.equal(await page.locator('.simple-more .transaction-title').first().textContent(),'Trip <img src=x onerror=alert(1)>');
  await page.locator('#selected-month').fill('2026-09');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.report-total').textContent(),'Rp135.000');assert.equal(await page.locator('.category-bar[data-id=dating]').count(),0);
  await page.locator('.category-bar[data-id=makan]').tap();assert.match(await page.locator('#chart-expenses .category-summary-note').textContent(),/Rp125\.000/);assert.deepEqual(await page.locator('#chart-expenses .transaction-title').allTextContents(),['September meal']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  // All eleven categories fit the phone and the compact shell, including very small expenses.
  await page.evaluate(async()=>{
   const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();
   s.transactions=s.categories.slice(0,11).map((c,i)=>({id:'chart-'+i,description:c.name,categoryId:c.id,amount:[1000000,200000,100000,50000,20000,10000,5000,3000,2000,500,1][i],date:'2026-10-10',note:'',createdAt:'2026-10-10T00:00:00Z'}));await repo.save(s);
  });await page.reload();await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  for(const width of [320,360,390,430,665,1280]){
   await page.setViewportSize({width,height:844});const bars=page.locator('.category-bar');assert.equal(await bars.count(),11);
   await bars.last().tap();assert.equal(await bars.last().getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.chart-selection-amount').textContent(),'Rp1');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.ok((await bars.last().boundingBox()).width>=20);
   const fit=await page.evaluate(()=>{const shell=document.querySelector('.app-shell'),main=document.getElementById('main-content'),chart=document.querySelector('.category-chart'),bars=document.querySelector('.category-chart-bars');const r=shell.getBoundingClientRect(),css=getComputedStyle(shell);const left=r.left+parseFloat(css.paddingLeft)+parseFloat(css.borderLeftWidth),right=r.right-parseFloat(css.paddingRight)-parseFloat(css.borderRightWidth);return {left,right,shellWidth:r.width,mainRight:main.getBoundingClientRect().right,chartRight:chart.getBoundingClientRect().right,barsRight:bars.getBoundingClientRect().right,chartScroll:chart.scrollWidth,chartWidth:chart.clientWidth};});
   assert.ok(fit.shellWidth<=480&&fit.mainRight<=fit.right+1&&fit.chartRight<=fit.right+1&&fit.barsRight<=fit.right+1,JSON.stringify({width,fit}));assert.ok(fit.chartScroll<=fit.chartWidth,JSON.stringify({width,fit}));
   if(process.env.SAKU_AXE){await page.addScriptTag({path:process.env.SAKU_AXE});const issues=await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));return (await axe.run(document.querySelector('.category-report'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});assert.deepEqual(issues,[]);}
   if(width===390||width===665){fs.mkdirSync('output/category-chart',{recursive:true});await page.locator('.category-report').screenshot({path:'output/category-chart/'+width+'-'+theme+'-chart.png',animations:'disabled'});await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:'output/category-chart/'+width+'-'+theme+'-page.png',animations:'disabled'});}
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='32px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  assert.equal(await page.locator('.category-bar-fill').first().evaluate(n=>getComputedStyle(n).animationName),'none');await page.locator('.category-bar').last().tap();assert.equal(await page.locator('.chart-selection').evaluate(n=>n.getAnimations().length),0);
  assert.equal(await page.locator('#chart-expenses').evaluate(n=>n.getAnimations().length),0);
  const activeCategory=await page.locator('.category-bar').last().getAttribute('data-id');
  await page.evaluate(async key=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();for(let i=0;i<11;i++)s.transactions.push({id:'page-'+i,description:'Paged '+i,categoryId:key,amount:10+i,date:'2026-10-10',note:'',createdAt:'2026-10-10T00:00:00Z'});await repo.save(s);},activeCategory);
  await page.reload();await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');await page.locator('.category-bar[data-id="'+activeCategory+'"]').tap();
  assert.equal(await page.locator('#chart-expenses .transaction').count(),5);await page.locator('[data-action=more-chart-expenses]').tap();assert.equal(await page.locator('#chart-expenses .transaction').count(),10);await page.locator('[data-action=more-chart-expenses]').tap();assert.equal(await page.locator('#chart-expenses .transaction').count(),12);assert.equal(await page.locator('[data-action=more-chart-expenses]').count(),0);
  assert.deepEqual((await page.locator('#chart-expenses .transaction-title').allTextContents()).slice(0,11),['Paged 10','Paged 9','Paged 8','Paged 7','Paged 6','Paged 5','Paged 4','Paged 3','Paged 2','Paged 1','Paged 0']);
  // Many custom categories may scroll inside the chart, never stretch the app shell.
  await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();for(let i=0;i<20;i++){const id='extra-'+i;s.categories.push({id,name:'Custom category '+i,icon:'grid',color:'#23745b'});s.transactions.push({id:'extra-row-'+i,description:'Custom item '+i,categoryId:id,amount:100+i,date:'2026-10-10',note:'',createdAt:'2026-10-10T00:00:00Z'});}await repo.save(s);});await page.reload();await page.setViewportSize({width:320,height:844});await page.locator('#selected-month').fill('2026-10');await page.locator('#selected-month').dispatchEvent('change');
  await page.locator('.category-bar').last().tap();assert.equal(await page.locator('.category-bar').last().getAttribute('aria-expanded'),'true');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok((await page.locator('#main-content').boundingBox()).width<=288);
  await context.close();console.log('PASS '+theme+': clean report layout, chart expense sorting and pagination, biggest expenses, editing, escaped text, summaries, mobile layouts and reduced motion');
 }}finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
