const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict');
const origin=process.env.SAKU_TEST_ORIGIN||'http://localhost:4173';
(async()=>{
 const browser=await chromium.launch(launchOptions),errors=[];
 try{
  for(const width of [320,390,430])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   try{
    await context.addInitScript(theme=>localStorage.setItem('iqbal-saku-theme',theme),theme);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/');await page.locator('[data-action=add-income]').waitFor();await page.locator('#selected-month').fill('2026-10');
    assert.equal(await page.locator('.brand').textContent(),'SiDompet');assert.equal(await page.title(),'SiDompet — Personal money tracker');assert.equal(await page.locator('.simple-budget-row').count(),0);assert.equal(await page.getByRole('heading',{name:'Money in & out'}).count(),1);
    const jade=await page.locator('.nav-add').evaluate(el=>getComputedStyle(el).backgroundColor);
    await page.locator('.topbar [data-page=settings]').tap();await page.locator('.settings-section').filter({has:page.locator('summary',{hasText:'Color palette'})}).locator('summary').first().tap();await page.locator('#color-palette').selectOption('blue');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.palette),'blue');const blue=await page.locator('.nav-add').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));return getComputedStyle(el).backgroundColor;});assert.notEqual(blue,jade);await page.reload();await page.locator('.nav-add').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.palette),'blue');assert.equal(await page.locator('.nav-add').evaluate(el=>getComputedStyle(el).backgroundColor),blue);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);await page.locator('[data-page=transactions]').tap();
    // Check the full arrow rectangles, particularly the edges next to the picker.
    for(const direction of ['-1','1']){
     const button=page.locator('[data-action=month][data-direction="'+direction+'"]'),box=await button.boundingBox(),picker=await page.locator('.month-picker').boundingBox();assert.ok(box.width>=48&&box.height>=48);
     assert.ok(direction==='-1'?picker.x-(box.x+box.width)>=7:box.x-(picker.x+picker.width)>=7,JSON.stringify({box,picker}));
     for(const x of [box.x+3,box.x+box.width/2,box.x+box.width-3]){
      assert.equal(await page.evaluate(({x,y,direction})=>document.elementFromPoint(x,y)?.closest('button')?.dataset.direction===direction,{x,y:box.y+box.height/2,direction}),true);
      const before=await page.locator('#selected-month').inputValue();await page.touchscreen.tap(x,box.y+box.height/2);const [year,month]=before.split('-').map(Number),date=new Date(year,month-1+Number(direction),1),expected=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');assert.equal(await page.locator('#selected-month').inputValue(),expected);assert.notEqual(await page.evaluate(()=>document.activeElement.id),'selected-month');
     }
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    // Income and expense colors stay different from the blue accent.
    await page.locator('#selected-month').fill('2026-10');await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs'),repo=new ExpenseRepository(),s=await repo.load();s.transactions=[{id:'out',amount:100000,date:'2026-10-15',categoryId:'makan',description:'Food',note:'',createdAt:'2026-10-15T10:00:00Z'}];s.income=[{id:'in',amount:500000,date:'2026-10-15',source:'bonus',title:'Bonus',note:'Work',createdAt:Date.parse('2026-10-15T11:00:00Z')}];await repo.save(s);});await page.reload();await page.locator('#history-list .money-in').waitFor();
    assert.equal(await page.locator('#history-list .transaction').count(),2);assert.equal(await page.locator('#history-list .money-in').textContent(),'+Rp500.000');assert.equal(await page.locator('#history-list .money-out').textContent(),'−Rp100.000');
    const colors=await page.evaluate(()=>{const root=getComputedStyle(document.documentElement);return {income:getComputedStyle(document.querySelector('.money-in')).color,expense:getComputedStyle(document.querySelector('.money-out')).color,green:root.getPropertyValue('--success').trim(),red:root.getPropertyValue('--danger').trim()};});assert.notEqual(colors.income,colors.expense);assert.ok(colors.income.includes(theme==='dark'?'140, 212, 174':'35, 116, 91'));assert.ok(colors.expense.includes(theme==='dark'?'243, 166, 176':'174, 51, 70'));
    const daily=await page.locator('.daily-total').textContent();assert.match(daily,/Out: Rp100\.000/);assert.match(daily,/In: Rp500\.000/);
    await page.locator('.filter-menu summary').tap();await page.locator('#category-filter').selectOption('@income');assert.equal(await page.locator('#history-list [data-action=edit-income]').count(),1);assert.equal(await page.locator('#history-list [data-action=edit]').count(),0);await page.locator('.filter-menu summary').tap();await page.locator('#category-filter').selectOption('@expense');assert.equal(await page.locator('#history-list [data-action=edit]').count(),1);assert.equal(await page.locator('#history-list [data-action=edit-income]').count(),0);
    console.log('PASS '+width+'px '+theme+': SiDompet branding, remembered Ocean blue palette, combined colored in/out history, filters, separated month arrow edge targets');
   }finally{await context.close();}
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
