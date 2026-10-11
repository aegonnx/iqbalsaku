const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(launchOptions),dist=path.resolve(__dirname,'../dist');
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 try{
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='hardening.test')return route.abort();
   if(url.pathname==='/supabase.mjs')return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}});'});
   const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   const contentType={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}[path.extname(file)]||'application/json';return route.fulfill({contentType,body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://hardening.test/expenses.html#transactions');await page.locator('.nav-add').waitFor();
  await page.evaluate(async()=>{
   const {seedState}=await import('./model.mjs'),{ExpenseRepository}=await import('./storage.mjs');const state=seedState();
   state.budgets['2026-10']={overall:2500000,categories:{makan:800000}};
   state.transactions=Array.from({length:135},(_,i)=>({id:'history-'+i,amount:10000,description:'Synthetic expense '+i,note:'',categoryId:'makan',date:'2026-10-10',createdAt:String(i).padStart(3,'0')}));await new ExpenseRepository().save(state);
  });await page.reload();await page.locator('.transaction-edit').first().waitFor();
  assert.equal(await page.locator('.transaction-edit').count(),60);assert.equal(await page.locator('[data-testid=spent]').textContent(),'Rp1.350.000');assert.equal(await page.locator('.daily-total strong').textContent(),'Rp1.350.000');
  await page.locator('[data-action=more-history]').tap();assert.equal(await page.locator('.transaction-edit').count(),120);
  await page.locator('[data-action=more-history]').tap();assert.equal(await page.locator('.transaction-edit').count(),135);assert.equal(await page.locator('[data-action=more-history]').count(),0);
  await page.locator('.filter-menu summary').tap();await page.locator('#transaction-search').fill('expense 13');assert.equal(await page.locator('.transaction-edit').count(),6);await page.locator('#transaction-search').fill('');assert.equal(await page.locator('.transaction-edit').count(),60);
  await page.locator('#category-filter').selectOption('snack');assert.equal(await page.locator('.transaction-edit').count(),0);
  await page.locator('.filter-menu summary').tap();await page.locator('#category-filter').selectOption('makan');assert.equal(await page.locator('.transaction-edit').count(),60);
  await page.locator('.transaction-edit').first().tap();await page.getByRole('dialog',{name:'Edit expense',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea,select')),false);
  await page.locator('[data-delete-expense]').tap();await page.getByRole('dialog',{name:'Delete expense?',exact:true}).waitFor();await page.locator('#confirm-dialog').getByRole('button',{name:'Delete expense',exact:true}).tap();await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);
  assert.equal(await page.locator('[data-testid=spent]').textContent(),'Rp1.340.000');
  await page.locator('.nav-add').tap();await page.getByRole('dialog',{name:'Add expense',exact:true}).waitFor();await page.locator('#expense-amount').fill('0');
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:340});visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));
  await page.locator('#expense-amount').fill('');await page.locator('[data-expense-details]').tap();
  await page.locator('#expense-description').fill('Validation from details');
  await page.locator('[data-submit-form=expense-form]').tap();await page.locator('#expense-error').filter({hasText:'positive amount'}).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'expense-amount');
  const error=await page.locator('#expense-error').boundingBox(),category=await page.locator('#expense-category').boundingBox(),footer=await page.locator('#expense-dialog .form-actions').boundingBox();
  assert.ok(error.height>0&&category.y+category.height<=footer.y);await page.locator('#expense-amount').fill('10');assert.equal(await page.locator('#expense-amount').getAttribute('aria-invalid'),null);
  await page.locator('[data-submit-form=expense-form]').tap();await page.waitForFunction(()=>!document.getElementById('expense-dialog').open);
  assert.equal(await page.locator('[data-testid=spent]').textContent(),'Rp1.350.000');assert.deepEqual(errors,[]);
  console.log('PASS pagination, complete daily totals, search/filter reset, named edit/delete/add dialogs, deleting without keyboard, invalid-amount recovery above keyboard');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
