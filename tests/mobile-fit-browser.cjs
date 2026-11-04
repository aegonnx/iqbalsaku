const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(launchOptions),dist=path.resolve(__dirname,'../dist');
 try{for(const width of [320,390,430,665])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(theme=>{localStorage.setItem('iqbal-saku-theme',theme);let height=null;const getHeight=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(visualViewport),'height').get;Object.defineProperty(visualViewport,'height',{get:()=>height??getHeight.call(visualViewport)});window.__fitKeyboard=value=>{height=value;visualViewport.dispatchEvent(new Event('resize'));};},theme);
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.hostname!=='fit.test')return route.abort();
   if(u.pathname==='/supabase.mjs')return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}});'});
   const file=path.join(dist,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:{'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}[path.extname(file)]||'application/json',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-04T12:00:00')});
  await page.goto('https://fit.test/#transactions');await page.locator('.nav-add').waitFor();
  await page.evaluate(async()=>{
   const {seedState}=await import('./model.mjs'),{ExpenseRepository}=await import('./storage.mjs'),s=seedState();
   s.categories[0].name='A long category name that should wrap inside the phone instead of expanding it';
   s.incomeSources[0].name='A long income source label that should remain inside a narrow mobile select';
   s.budgets['2026-11']={overall:1000000000000,emergencyFunds:10000,categories:{makan:500000000000}};
   s.transactions=s.categories.map((c,i)=>({id:'fit-'+i,categoryId:c.id,description:i?'Expense '+i:'VeryLongExpenseName'.repeat(7),amount:i?12000+i:987654321000,date:'2026-11-04',createdAt:'2026-11-04T12:00:00Z',note:'A long note '+ 'LongText'.repeat(40)}));
   s.income=[{id:'fit-income',amount:123456789000,date:'2026-11-04',source:s.incomeSources[0].id,title:'Long income description '.repeat(6),note:'Synthetic fixture',createdAt:1}];
   s.quickExpenses=[{id:'fit-quick',description:'Long quick expense '.repeat(7),amount:50000,categoryId:'makan'}];await new ExpenseRepository().save(s);
  });await page.reload();await page.locator('.transaction-edit').first().waitFor();
  let states=0;
  async function check(name){
   await page.evaluate(()=>document.fonts.ready);
   const geometry=await page.evaluate(()=>{
    const root=document.documentElement,shell=document.querySelector('.app-shell'),r=shell.getBoundingClientRect();
    const dialogs=[...document.querySelectorAll('dialog[open]')].map(d=>{const b=d.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,overflow:[...d.querySelectorAll('.dialog-inner,form,.expense-core,.expense-options,.expense-extra,.form-actions')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+1).map(n=>({name:n.className,width:n.clientWidth,scroll:n.scrollWidth,children:[...n.children].map(c=>({name:c.className,width:c.clientWidth,scroll:c.scrollWidth}))}))};});
    return {width:innerWidth,scroll:root.scrollWidth,shellWidth:r.width,dialogs};
   });assert.ok(geometry.scroll<=width&&geometry.shellWidth<=480,JSON.stringify({name,theme,width,geometry}));
   for(const d of geometry.dialogs){assert.ok(d.left>=-1&&d.right<=width+1&&d.width<=480,JSON.stringify({name,d}));assert.deepEqual(d.overflow,[],name);}
   if(process.env.SAKU_AXE){await page.addScriptTag({path:process.env.SAKU_AXE});const violations=await page.evaluate(async()=>{const target=document.querySelector('dialog[open]')||document.querySelector('main');return (await axe.run(target,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[],name);}
   states++;
  }
  async function keyboard(name){if(width>=600)return;await page.evaluate(()=>window.__fitKeyboard(340));await page.waitForFunction(()=>document.documentElement.classList.contains('keyboard-open'));await check(name+' keyboard');const actions=await page.locator('dialog[open] .dialog-inner>.form-actions').boundingBox();assert.ok(actions.y+actions.height<=341,name);}
  async function close(){while(await page.locator('dialog[open]').count()){const dialog=page.locator('dialog[open]').last(),id=await dialog.getAttribute('id');await dialog.locator('[data-close]').first().click();await page.waitForFunction(id=>!document.getElementById(id).open,id);}await page.evaluate(()=>window.__fitKeyboard(null));}
  async function section(name){const s=page.locator('.settings-section').filter({has:page.locator('summary',{hasText:name})});if(!await s.evaluate(n=>n.open))await s.locator('summary').first().click();}
  await check('Read long records and large amounts');await page.locator('.filter-menu summary').click();await check('Read search and filter');await page.locator('.filter-menu summary').click();
  await page.locator('.nav-add').click();await check('Add expense');await keyboard('Add expense');await close();
  await page.locator('[data-action=edit][data-id=fit-0]').click();await check('Edit expense');await page.locator('[data-delete-expense]').click();await page.getByRole('dialog',{name:'Delete expense?',exact:true}).waitFor();await check('Delete expense');await close();
  await page.locator('[data-action=add-income]').click();await check('Add income');await keyboard('Add income');await close();
  await page.locator('[data-action=edit-income]').click();await check('Edit income');await page.locator('[data-delete-income]').click();await page.getByRole('dialog',{name:'Delete income?',exact:true}).waitFor();await check('Delete income');await close();
  await page.locator('[data-action=emergency-funds]').click();await check('Emergency funds');await keyboard('Emergency funds');await close();
  if(width===390){fs.mkdirSync('output/mobile-fit',{recursive:true});await page.screenshot({path:'output/mobile-fit/read-'+theme+'.png'});}
  await page.locator('.bottom-nav [data-page=reports]').click();await check('Pie chart, 11 categories');await page.locator('#pie-category').selectOption('makan');await check('Pie expense list');
  await page.locator('.topbar [data-page=settings]').click();await check('Settings');
  for(const action of ['cloud-signin','cloud-signup']){await page.locator('[data-action='+action+']').click();await check(action);await keyboard(action);await close();}
  await section('Quick expenses');await page.locator('[data-action=new-quick]').click();await check('New quick expense');await keyboard('New quick expense');await close();
  await section('Categories');await page.locator('[data-action=delete-category]').first().click();await check('Move and delete category');await close();
  await section('Income sources');await page.locator('[data-action=delete-income-source]').first().click();await check('Move and delete income source');await close();
  await section('Your data');await page.locator('[data-action=reset]').click();await check('Reset confirmation');await keyboard('Reset confirmation');await close();
  const backup=await page.evaluate(async()=>{const {ExpenseRepository}=await import('./storage.mjs');return new ExpenseRepository().load();});await page.locator('#import-file').setInputFiles({name:'fit-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await check('Import backup confirmation');await close();
  await page.locator('.bottom-nav [data-page=transactions]').click();await page.evaluate(()=>document.documentElement.style.fontSize='32px');await check('Read enlarged text');await page.locator('.nav-add').click();await check('Expense enlarged text');await close();await page.locator('[data-action=add-income]').click();await check('Income enlarged text');await close();await page.locator('[data-action=emergency-funds]').click();await check('Emergency enlarged text');await close();assert.deepEqual(errors,[]);
  await context.close();console.log('PASS '+width+' '+theme+': '+states+' Read, pie, popup and keyboard states fit without horizontal scrolling');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
