import {PALETTES,applyPalette} from './appearance.mjs';
import {IncomeController} from './income-ui.mjs';
import {readLegacyIncome,consolidateIncome,LEGACY_APP} from './income-legacy.mjs';
import {seedState,metrics,budgetFor,budgetState,localDate,expenseMonth,validateExpense,validateState,upgradeState,csv,id,period,categoryIds} from './model.mjs';
import {amountText,amountFromInput} from './amount-input.mjs';
import {ExpenseRepository} from './storage.mjs';
import {pinDialogActions,installKeyboardLayout,installFooterActions} from './mobile-layout.mjs';
import {openDialog,closeDialog,dialogActive,dialogClosing,animatePage,installDisclosureMotion} from './motion.mjs';
import {installPullRefresh} from './pull-refresh.mjs';
import {CloudController} from './cloud-ui.mjs';
import {indexHistory,historyPage} from './history.mjs';
import {rememberFocus,restoreFocus} from './focus.mjs';
import {spendingOverview} from './spending-overview.mjs';
const localRepo=new ExpenseRepository();
let repo=localRepo,cloud,income,legacyIncome=null;
let state,month=expenseMonth(localDate()),page=['home','transactions','reports','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'home';
let historyLimit=60,historyCache;
let search='',categoryFilter='',busy=false,toastTimer,installPrompt;
const app=document.getElementById('app'),expenseDialog=document.getElementById('expense-dialog'),confirmDialog=document.getElementById('confirm-dialog'),incomeDialog=document.getElementById('income-dialog');
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('saku-data'):null;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths={
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon:'<path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13z"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  wallet:'<path d="M20 8V5H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V8"/><path d="M16 12h6v5h-6a2.5 2.5 0 0 1 0-5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chart:'<path d="M3 3v18h18M8 16v-5M13 16V6M18 16V9"/>',
  settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/><path d="m9 3-1 3-3 1-2 4 2 2-1 3 3 3 3-1 2 3 4-2 1-3 3-1 1-4-3-2V6l-4-3-2 1z"/>',
  utensils:'<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-4 8 0 10"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  car:'<path d="m3 10 2-6h14l2 6v9H3zM3 10h18M6 14h2M16 14h2M5 19v2M19 19v2"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12l9 4 9-4"/>',
  hand:'<path d="M3 17h3l4 4 11-7a2 2 0 0 0-2-3l-5 3H9m-3 3V9h6a3 3 0 0 1 0 6H9M3 9h3v12H3"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  phone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8C2 8 5 0 9 3l3 5c10 0 7-8 3-5z"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  left:'<path d="m15 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',
  up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
};
function icon(name){return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.grid)+'</svg>';}
function format(n){const currency=state?.settings.currency||'IDR';return currency==='IDR'?'Rp'+Math.round(n).toLocaleString('id-ID'):new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:0}).format(Math.round(n));}
function displayMoney(n){const value=format(n);return state.settings.currency==='IDR'?'<span class="currency-prefix">Rp</span><span>'+e(value.slice(2))+'</span>':e(value);}
function monthName(value=month){const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric'}).format(new Date(y,m-1,1));}
function shortDate(value){const date=new Date(value+'T12:00:00');return date.getDate()+' '+new Intl.DateTimeFormat('en-US',{month:'short'}).format(date);}
function cat(key){return state.categories.find(c=>c.id===key);}
function categoryTone(key){const index=categoryIds.indexOf(key);if(index>=0)return index+1;let hash=0;for(const ch of key)hash=(hash*31+ch.charCodeAt(0))>>>0;return hash%11+1;}
function categoryIcon(key){const c=cat(key);return '<span class="category-icon '+e(key)+'" style="--category-color:'+themeColor(key)+'">'+icon(c?.icon||'grid')+'</span>';}
function options(selected,withAll=false){return (withAll?'<option value="">All money</option><option value="@income" '+(selected==='@income'?'selected':'')+'>Money in</option><option value="@expense" '+(selected==='@expense'?'selected':'')+'>Money out</option>':'')+state.categories.map(c=>'<option value="'+e(c.id)+'" '+(selected===c.id?'selected':'')+'>'+e(c.name)+'</option>').join('');}
function notify(text){const toast=document.getElementById('toast');toast.textContent=text;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3000);}
function errorMessage(err){return err?.name==='QuotaExceededError'?'Your device storage is full. Export a backup and free some space, then retry.':err?.message||'Could not save. Your changes have not been applied. Please retry.';}
let lockQueue=Promise.resolve();
async function withLock(fn){if(navigator.locks)return navigator.locks.request('saku-write',fn);const operation=lockQueue.catch(()=>{}).then(fn);lockQueue=operation;return operation;}
cloud=new CloudController({store:localRepo,lock:withLock,activate:async repository=>withLock(async()=>{repo=repository;state=await repo.load();search='';categoryFilter='';await closeDialog(expenseDialog);await closeDialog(incomeDialog);await closeDialog(confirmDialog);render();}),refresh:async repository=>{if(repo!==repository)return;state=await repository.load();if(page!=='settings'&&!expenseDialog.open&&!incomeDialog.open&&!confirmDialog.open)render();},showConfirm,notify,download,escape:e});
async function commit(change){
  if(busy)throw new Error('A save is in progress. Please wait.');
  busy=true;
  try{await withLock(async()=>{const next=await repo.load();await change(next);const clean=upgradeState(next);await repo.save(clean);state=clean;});channel?.postMessage('changed');}
  finally{busy=false;}
}
income=new IncomeController({getState:()=>state,commit,render,format,escape:e,icon,notify,showConfirm,blocked:()=>busy||dialogActive(expenseDialog)||dialogActive(confirmDialog),selectDate:date=>{month=expenseMonth(date,state.settings.startDay);}});
function progress(spent,budget){const status=budgetState(spent,budget);const width=budget>0?Math.min(100,Math.max(0,spent/budget*100)):spent>0?100:0;return '<div class="progress '+status+'" role="progressbar" aria-label="Budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+width+'" aria-valuetext="'+e(format(spent)+' of '+format(budget))+'"><span style="width:'+width+'%"></span></div>';}
function budgetItem(key,m){
  const c=cat(key),amount=m.categories[key]||0,budget=m.budget.categories[key],defined=budget!==undefined,status=defined?budgetState(amount,budget):'none';
  const statuses={normal:'On track',caution:'Keep an eye',warning:'Almost there',over:'Over budget',none:'No limit'};
  return '<div class="budget-item"><div class="budget-top"><div class="category-title">'+categoryIcon(key)+e(c.name)+'</div><span class="badge '+status+'">'+statuses[status]+'</span></div><p class="budget-value"><strong>'+format(amount)+'</strong>'+(defined?' / '+format(budget):' spent')+'</p>'+(defined?progress(amount,budget)+'<p class="remaining '+(budget<amount?'negative':'')+'" style="margin-top:10px">'+format(Math.abs(budget-amount))+(budget<amount?' over budget':' remaining')+'</p>':'<button class="text-button" data-action="page" data-page="settings">Set a budget</button>')+'</div>';
}
function transactionRow(t,showDate=false){
 return '<div class="transaction">'+categoryIcon(t.categoryId)+'<div class="transaction-info"><div class="transaction-title">'+e(t.description)+'</div><div class="transaction-meta">'+e(cat(t.categoryId)?.name)+(showDate?' · '+shortDate(t.date):'')+(t.note?' · '+e(t.note):'')+'</div></div><div class="transaction-amount money-out" aria-label="'+e('Expense '+format(t.amount))+'">−'+format(t.amount)+'</div><button class="transaction-edit" data-action="edit" data-id="'+e(t.id)+'" aria-label="Edit '+e(t.description)+'">'+icon('edit')+'</button></div>';
}
function themeColor(key){return 'var(--category-'+categoryTone(key)+')';}
function categoryReport(c,m,count){
 const amount=m.categories[c.id],pct=amount/m.spent*100,limit=m.budget.categories[c.id];
 return '<div class="category-report-item"><div class="category-report-row">'+categoryIcon(c.id)+'<div class="category-report-info"><div class="distribution-label"><span>'+e(c.name)+'</span><strong>'+format(amount)+'</strong></div><div class="category-share"><div class="share-track" aria-hidden="true"><span style="width:'+pct+'%;background:'+themeColor(c.id)+'"></span></div><small>'+pct.toFixed(1)+'%</small></div>'+(limit!==undefined?'<small class="category-limit '+(amount>limit?'negative':'')+'">'+format(Math.abs(limit-amount))+(amount>limit?' over budget':' remaining of '+format(limit))+'</small>':'')+'</div></div><details class="category-expenses" data-category="'+e(c.id)+'"><summary>'+(count?'View '+count+' '+(count===1?'expense':'expenses'):'View details')+'<span class="sr-only"> in '+e(c.name)+'</span></summary><div class="category-expenses-list"></div></details></div>';
}
function distribution(m,all=false){
 const ordered=state.categories.slice().sort((a,b)=>(m.categories[b.id]||0)-(m.categories[a.id]||0));
 return ordered.filter(c=>(m.categories[c.id]||0)>0).map(c=>{const amount=m.categories[c.id]||0;const pct=m.spent?amount/m.spent*100:0;return '<div class="distribution-row"><div class="distribution-label"><span><i class="legend-dot" style="background:'+themeColor(c.id)+'"></i>'+e(c.name)+'</span><strong>'+format(amount)+'</strong></div><div class="progress"><span style="width:'+pct+'%;background:'+themeColor(c.id)+'"></span></div>'+(all?'<small>'+pct.toFixed(1)+'% of spending</small>':'')+'</div>';}).join('')||'<div class="empty">No spending yet this month.</div>';
}
function home(){ return transactions(); }
function historyBody(){
 if(!historyCache||historyCache.state!==state||historyCache.month!==month){const m=metrics(state,month);historyCache={state,month,summary:m.summary,index:indexHistory([...m.rows,...m.incomeRows.map(t=>({...t,kind:'income'}))],state.categories,state.incomeSources)};}
 const result=historyPage(historyCache.index,{search,category:categoryFilter,limit:historyLimit});
 return (historyCache.summary?'<p class="notice">This month has a monthly expense summary of '+format(historyCache.summary.total)+'. It has no individual transactions to edit. Any expenses you add are counted on top of the summary.</p>':'')+
 (result.count?result.groups.map(group=>'<section class="card date-group"><div class="section-head"><h3>'+shortDate(group.date)+'</h3><span class="daily-total">'+(search||categoryFilter?'Filtered · ':'')+(group.outgoing?'Out: <strong>'+format(group.outgoing)+'</strong>':'')+(group.incoming?(group.outgoing?' · ':'')+'In: <strong>'+format(group.incoming)+'</strong>':'')+(!group.incoming&&!group.outgoing?'Salary reference':'')+'</span></div>'+group.rows.map(t=>t.kind==='income'?income.row(t):transactionRow(t)).join('')+'</section>').join('')+
 '<div class="history-pagination"><p class="muted" role="status">'+(result.shown<result.count?'Showing '+result.shown+' of '+result.count+' records':result.count+' '+(result.count===1?'record':'records'))+'</p>'+(result.shown<result.count?'<button class="secondary full-width" data-action="more-history">Show more records</button>':'')+'</div>':'<div class="card empty">'+(search||categoryFilter?'No money records match your search.':'No money in or out recorded this month.')+'</div>');
}
function transactions(){
 const m=metrics(state,month);
 return '<section class="card hero simple-balance"><p class="eyebrow">'+(m.remaining<0?'Over budget':'Left this month')+'</p><p class="hero-number" data-testid="remaining">'+displayMoney(Math.abs(m.remaining))+'</p><div class="balance-breakdown"><div><span>Starting budget / salary</span><strong data-testid="starting-budget">'+format(m.startingBudget)+'</strong></div><div><span>Extra income</span><strong class="income-positive" data-testid="extra-income">'+format(m.extraIncome)+'</strong></div><div><span>Total expenses</span><strong data-testid="spent">'+format(m.spent)+'</strong></div><div><span>Emergency funds</span><strong data-testid="emergency-funds">'+format(m.emergencyFunds)+'</strong></div></div>'+progress(m.spent,Math.max(0,m.spendable))+'<div class="balance-actions"><button class="secondary" data-action="add-income">'+icon('plus')+' Add income</button><button class="text-button" data-action="page" data-page="settings">Set starting budget</button></div></section>'+'<section class="simple-history"><div class="section-head"><h2>Money in &amp; out</h2><details class="filter-menu"><summary>'+icon('list')+'Search & filter</summary><div class="toolbar"><label class="sr-only" for="transaction-search">Search transactions</label><input id="transaction-search" type="search" placeholder="Search money in &amp; out" value="'+e(search)+'"><label class="sr-only" for="category-filter">Filter by category</label><select id="category-filter">'+options(categoryFilter,true)+'</select></div></details></div><div id="history-list">'+historyBody()+'</div></section>';
}
function reports(){
 const m=metrics(state,month),status=budgetState(m.spent,Math.max(0,m.spendable));
 const expenseCounts={};for(const row of m.rows)expenseCounts[row.categoryId]=(expenseCounts[row.categoryId]||0)+1;
 const ranked=state.categories.filter(c=>(m.categories[c.id]||0)>0).sort((a,b)=>m.categories[b.id]-m.categories[a.id]);
 const large=m.rows.slice().sort((a,b)=>b.amount-a.amount).slice(0,3);
 const overview=spendingOverview(state,m,{format});
 const headline=m.remaining<0?'Over budget':status==='warning'?'Budget nearly used':status==='caution'?'Slow down a little':m.spent?(overview.tone==='caution'?'Keep an eye on spending':'Within budget'):'No spending yet';
 const segments=ranked.map(c=>'<span style="flex:'+m.categories[c.id]+';background:'+themeColor(c.id)+'"></span>').join('');
 return '<section class="report-overview" aria-labelledby="report-total-title"><div class="report-status '+status+'">'+headline+'</div><h2 id="report-total-title">Total spending</h2><p class="report-total">'+displayMoney(m.spent)+'</p><div class="report-budget"><span>Available to spend</span><strong>'+format(m.spendable)+'</strong></div>'+progress(m.spent,Math.max(0,m.spendable))+'<div class="report-budget-foot"><span>'+(m.spendable>0?m.percent.toFixed(1)+'% used':'No money available')+'</span><strong class="'+(m.remaining<0?'negative':'')+'">'+format(Math.abs(m.remaining))+(m.remaining<0?' over':' left')+'</strong></div></section>'+
 '<section class="control-notice '+overview.tone+'" aria-labelledby="spending-overview-title"><h2 id="spending-overview-title">Spending overview</h2><p id="spending-overview-copy" class="overview-collapsed">'+e(overview.text)+'</p><button type="button" class="text-button overview-toggle" data-action="toggle-overview" aria-expanded="false" aria-controls="spending-overview-copy">Read more</button></section>'+
 '<section class="category-report"><div class="section-head"><h2>Where it went</h2><span class="muted">'+ranked.length+' categories</span></div>'+(ranked.length?'<div class="spending-strip" aria-hidden="true">'+segments+'</div><p class="biggest-category"><strong>'+e(ranked[0].name)+'</strong> leads at '+Math.round(m.categories[ranked[0].id]/m.spent*100)+'% of spending.</p><div class="category-breakdown">'+ranked.map(c=>categoryReport(c,m,expenseCounts[c.id]||0)).join('')+'</div>':'<div class="empty"><h3>No spending to analyze yet</h3><p>Add your first expense using the + button below.</p></div>')+'</section>'+
 (m.summary?'<p class="simple-summary-note">'+monthName()+' includes a saved monthly summary of '+format(m.summary.total)+' in addition to any listed expenses. Summary amounts have no individual expense records.</p>':'')+
 (large.length?'<details class="card simple-more"><summary>Biggest expenses</summary>'+large.map(t=>transactionRow(t,true)).join('')+'</details>':'');
}
function settings(){
 const budget=budgetFor(state,month);

 return cloud.section()+'<div class="settings-grid"><div class="stack"><section class="card settings-card"><div class="section-head"><h2>Monthly budgets</h2><small>'+monthName()+'</small></div><form id="budget-form" class="settings-card"><label class="field">Starting budget / salary (×1.000)<input name="overall" inputmode="decimal" required value="'+amountText(budget.overall)+'"></label><label class="field" for="emergency-funds">Emergency funds (×1.000)<input id="emergency-funds" name="emergencyFunds" inputmode="decimal" placeholder="0" value="'+amountText(budget.emergencyFunds)+'" aria-describedby="emergency-funds-help"></label><small id="emergency-funds-help">Set aside money for this budget period. It reduces your remaining balance and stays separate from expenses. Enter 500 for Rp500.000; leave blank for zero.</small><div class="form-grid">'+state.categories.map(c=>'<label class="field">'+e(c.name)+' (×1.000)<input name="budget-'+e(c.id)+'" inputmode="decimal" placeholder="No category limit" value="'+amountText(budget.categories[c.id])+'"></label>').join('')+'</div><small>Enter thousands: 500 = 500.000. Leave a category blank for no limit.</small><button class="primary" type="submit">Save budgets</button></form></section><section class="card settings-card"><h2>Color palette</h2><p class="income-help">Choose your accent colors. Use the top bar to switch between light and dark themes.</p><label class="field" for="color-palette">Palette<select id="color-palette">'+PALETTES.map(p=>'<option value="'+p.id+'" '+((document.documentElement.dataset.palette||'jade')===p.id?'selected':'')+'>'+e(p.name)+'</option>').join('')+'</select></label></section><section class="card settings-card"><h2>Preferences</h2><form id="preferences-form" class="settings-card"><div class="form-grid"><label class="field">Currency<select name="currency">'+['IDR','USD','SGD'].map(c=>'<option '+(state.settings.currency===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label><label class="field">Month starts on<select name="startDay">'+Array.from({length:28},(_,i)=>'<option value="'+(i+1)+'" '+(state.settings.startDay===i+1?'selected':'')+'>Day '+(i+1)+'</option>').join('')+'</select></label><label class="field span-2">Default starting budget for new months (×1.000)<input name="defaultBudget" inputmode="decimal" required value="'+amountText(state.settings.defaultBudget)+'"></label></div><small>Currency changes the display label only; amounts are not converted. Month start changes which period expenses and income belong to. Historical summaries remain on their calendar-month reports.</small><button class="primary" type="submit">Save preferences</button></form></section><section class="card settings-card"><h2>Your data</h2><p class="income-help">JSON backups include expenses, income, and starting budgets.</p>'+(legacyIncome?.entries?.length?'<p class="income-help">Saved income on this device can also be imported into your signed-in account. Existing starting budgets are preserved; salary references are not extra income.</p><button class="secondary full-width" data-action="import-saved-income">Import saved income into '+(cloud.user?'this account':'this tracker')+'</button>':'')+'<p class="muted" style="font-size:14px;line-height:1.6">Changes save on this device first. Signed-in accounts also sync online. Keep regular JSON backups.</p><div class="button-row"><button class="secondary" data-action="export-json">'+icon('download')+' JSON backup</button><button class="secondary" data-action="export-csv">Transactions CSV</button><button class="secondary" data-action="import">Import JSON</button></div><input type="file" id="import-file" accept=".json,application/json" hidden><button class="text-button" style="text-align:left;min-height:44px" data-action="persistent-storage">Protect local storage</button><p class="status-note" id="storage-status">Storage: IndexedDB · '+state.transactions.length+' expenses · '+state.income.length+' income records</p><button class="secondary danger" data-action="reset">Reset all data</button><small>Reset clears expenses, income, summaries, and budgets. Previously imported income will not be added again automatically.</small></section><section class="card settings-card"><h2>Add to your home screen</h2><p class="muted" style="font-size:14px;line-height:1.65">On iPhone, open mySaku in Safari, tap Share, then “Add to Home Screen”. Open it once online to enable offline use.</p><button id="install-button" class="secondary" data-action="install" '+(!installPrompt?'hidden':'')+'>Install mySaku</button><small>Installation requires HTTPS or localhost. A phone cannot open your computer’s localhost address.</small></section></div><div class="stack">'+income.settings()+'<section class="card settings-card"><div class="section-head"><h2>Categories</h2><small>'+state.categories.length+' categories</small></div><form id="categories-form">'+state.categories.map((c,i)=>'<div class="settings-category"><label class="sr-only" for="name-'+e(c.id)+'">Name for '+e(c.name)+'</label><input id="name-'+e(c.id)+'" name="'+e(c.id)+'" value="'+e(c.name)+'" maxlength="80" required><div class="controls"><button type="button" class="icon-button" data-action="move-category" data-id="'+e(c.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="Move '+e(c.name)+' up">'+icon('up')+'</button><button type="button" class="icon-button" data-action="move-category" data-id="'+e(c.id)+'" data-direction="1" '+(i===state.categories.length-1?'disabled':'')+' aria-label="Move '+e(c.name)+' down">'+icon('down')+'</button><button type="button" class="icon-button danger" data-action="delete-category" data-id="'+e(c.id)+'" '+(state.categories.length===1?'disabled':'')+' aria-label="Delete '+e(c.name)+'">'+icon('trash')+'</button></div></div>').join('')+'<button class="primary full-width" style="margin-top:16px">Save category names</button></form><form id="add-category-form" class="add-inline"><label class="sr-only" for="new-category">New category name</label><input id="new-category" name="name" maxlength="80" placeholder="New category" required style="padding:12px;border:1px solid var(--line);border-radius:10px"><button class="secondary">Add</button></form><small>Deleting a category moves its expenses, summary totals, and budgets to a category you choose.</small></section><section class="card settings-card"><div class="section-head"><h2>Quick expenses</h2><button class="text-button" data-action="new-quick">'+icon('plus')+' Add</button></div><form id="quick-form" class="settings-card">'+state.quickExpenses.map(q=>'<div class="settings-quick"><label class="field">Description<input name="description-'+e(q.id)+'" value="'+e(q.description)+'" maxlength="160" required></label><label class="field">Amount (×1.000)<input name="amount-'+e(q.id)+'" inputmode="decimal" value="'+amountText(q.amount)+'" required></label><div class="quick-bottom"><label class="sr-only" for="quick-cat-'+e(q.id)+'">Category for '+e(q.description)+'</label><select id="quick-cat-'+e(q.id)+'" name="category-'+e(q.id)+'" style="padding:10px;border:1px solid var(--line);border-radius:10px">'+options(q.categoryId)+'</select><button type="button" class="icon-button danger" data-action="delete-quick" data-id="'+e(q.id)+'" aria-label="Remove '+e(q.description)+'">'+icon('trash')+'</button></div></div>').join('')+(state.quickExpenses.length?'<button class="primary">Save quick expenses</button>':'<p class="muted">Add the expenses you use most often.</p>')+'</form><small>Tap a quick expense to open a prefilled entry. Review it, then save.</small></section></div></div>';
}
function themeButton(){const dark=document.documentElement.dataset.theme==='dark';return '<button class="icon-button" data-action="theme" aria-label="Dark theme" aria-pressed="'+dark+'" title="Switch to '+(dark?'light':'dark')+' theme">'+icon(dark?'sun':'moon')+'</button>';}
function toggleTheme(button){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('iqbal-saku-theme',theme);}catch{}document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#141a19':'#ffffff';button.innerHTML=icon(theme==='dark'?'sun':'moon');button.setAttribute('aria-pressed',String(theme==='dark'));button.title='Switch to '+(theme==='dark'?'light':'dark')+' theme';}
function render({focusPage=false}={}){
 const previousFocus=rememberFocus(app);
 const expanded=page==='settings'&&app.querySelector('.settings-grid')?new Set([...app.querySelectorAll('.settings-section[open]>summary')].map(node=>node.textContent)):null;
 const title=page==='reports'?'Analyze':page==='settings'?'Settings':'Read';
 app.innerHTML='<div class="app-shell simple-shell"><header class="topbar"><a class="brand" href="./" aria-label="mySaku home"><img src="./icon.svg" alt="">mySaku</a><div class="topbar-actions">'+themeButton()+'<button class="icon-button" data-action="page" data-page="settings" aria-label="Settings">'+icon('settings')+'</button></div></header><main id="main-content" tabindex="-1" aria-labelledby="page-title"><div class="heading-row"><h1 id="page-title" tabindex="-1">'+title+'</h1><div class="month-control"><button data-action="month" data-direction="-1" aria-label="Previous month">'+icon('left')+'</button><label class="sr-only" for="selected-month">Selected month</label><div class="month-picker"><span aria-hidden="true">'+monthName()+'</span><input id="selected-month" type="month" min="2000-01" max="2100-12" value="'+month+'"></div><button data-action="month" data-direction="1" aria-label="Next month">'+icon('right')+'</button></div></div>'+cloud.banner()+({home,transactions,reports,settings})[page]()+'</main><nav class="bottom-nav simple-nav" aria-label="Main navigation">'+navButton('transactions','Read','list')+'<button class="nav-add" data-action="add" aria-label="Add Expense">'+icon('plus')+'<span>Add</span></button>'+navButton('reports','Analyze','chart')+'</nav></div>';
 if(page==='settings'){
  for(const form of app.querySelectorAll('#budget-form,#preferences-form,#categories-form,#income-sources-form,#quick-form')){const button=[...form.children].find(node=>node.tagName==='BUTTON'&&node.classList.contains('primary'));if(button){button.type='submit';button.textContent='Save changes';const actions=document.createElement('div');actions.className='form-actions settings-actions';button.replaceWith(actions);actions.append(button);}}
  app.querySelectorAll('.settings-grid .card').forEach((card,i)=>{const wrapper=document.createElement('details');wrapper.className='settings-section';const summary=document.createElement('summary');summary.textContent=card.querySelector('h2')?.textContent||'Settings';wrapper.open=expanded?expanded.has(summary.textContent):i===0;card.querySelector('h2')?.remove();card.replaceWith(wrapper);wrapper.append(summary,card);});
 }
 if(focusPage)document.getElementById('page-title')?.focus({preventScroll:true});
 else if(previousFocus&&!restoreFocus(app,previousFocus))document.getElementById('page-title')?.focus({preventScroll:true});
}
function navButton(key,label,glyph){const active=page===key||(key==='transactions'&&page==='home');return '<button class="nav-item '+(active?'active':'')+'" '+(active?'aria-current="page"':'')+' data-action="page" data-page="'+key+'">'+icon(glyph)+'<span>'+label+'</span></button>';}
function navigate(key){if(!['home','transactions','reports','settings'].includes(key))return;if(page===key)return;page=key;historyLimit=60;location.hash=key;render({focusPage:true});window.scrollTo({top:0});animatePage(document.getElementById('main-content'));}
function switchMonth(value){if(!/^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(value))return;if(month===value)return;month=value;historyLimit=60;render();animatePage(document.getElementById('main-content'));}
function openExpense(existing=null,quick=null){
 if(dialogActive(expenseDialog)||dialogActive(incomeDialog)||dialogActive(confirmDialog)||busy)return;
 expenseDialog.classList.remove('details-mode');
 const t=existing||{amount:quick?.amount||'',description:quick?.description||'',categoryId:quick?.categoryId||(cat('makan')?'makan':state.categories[0].id),date:localDate(),note:''};
 const recent=state.transactions.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 const unique=[],seen=new Set();for(const r of recent){if(!seen.has(r.description.toLowerCase())){seen.add(r.description.toLowerCase());unique.push(r);}if(unique.length===4)break;}
 expenseDialog.innerHTML='<div class="dialog-inner"><div class="dialog-header"><h2 id="expense-title">'+(existing?'Edit expense':'Add expense')+'</h2><div class="dialog-header-actions"><button type="button" class="text-button" data-expense-details aria-controls="expense-options" aria-expanded="false">Details</button><button type="button" class="icon-button" data-close="expense" aria-label="Close">'+icon('close')+'</button></div></div><form id="expense-form" class="expense-form" novalidate data-id="'+e(existing?.id||'')+'"><div class="expense-core"><div class="amount-field"><div class="amount-label"><label for="expense-amount">Amount</label></div><input class="amount-input full-width" id="expense-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="'+e(amountText(t.amount))+'" required aria-describedby="amount-preview expense-error" style="border:1px solid var(--control-border);border-radius:12px"><p id="amount-preview" class="amount-preview">'+(t.amount?format(t.amount):'Type 500 for 500.000')+'</p><p class="error-message" id="expense-error" role="alert"></p></div><label class="field date-field">Date<input id="expense-date" name="date" type="date" value="'+e(t.date)+'" min="2000-01-01" max="2100-12-31" required></label><label class="field category-field">Category<select name="categoryId" id="expense-category">'+options(t.categoryId)+'</select></label><label class="field description-field">Description<input id="expense-description" name="description" placeholder="Optional, e.g. lunch" maxlength="160" value="'+e(t.description)+'" autocomplete="off"></label></div><div id="expense-options" class="expense-options"><details class="entry-details" '+(existing?'open':'')+'><summary>More details <span class="muted">(optional)</span></summary><div class="expense-extra"><label class="field">Note<textarea name="note" maxlength="2000" placeholder="Optional">'+e(t.note)+'</textarea></label></div></details><div class="form-actions">'+(existing?'<button class="secondary danger" type="button" data-delete-expense="'+e(existing.id)+'" aria-label="Delete expense">'+icon('trash')+'</button>':'')+'<button type="submit" class="primary">'+(existing?'Save changes':'Save expense')+'</button></div>'+(!existing&&unique.length?'<details class="entry-details"><summary>Repeat a recent expense</summary><div class="suggestions">'+unique.map(r=>'<button type="button" class="suggestion" data-suggestion="'+e(r.id)+'">'+e(r.description)+' · '+format(r.amount)+'</button>').join('')+'</div></details>':'')+'</div></form></div>';
 expenseDialog.setAttribute('aria-labelledby','expense-title');
 pinDialogActions(expenseDialog,'expense-form');openDialog(expenseDialog,{focus:existing?expenseDialog.querySelector('[data-close]'):document.getElementById('expense-amount'),select:!existing});
}
function entryAmount(){const form=document.getElementById('expense-form');const val=form.elements.amount.value;return amountFromInput(val);}
function updateAmountPreview(){document.getElementById('expense-amount').removeAttribute('aria-invalid');document.getElementById('expense-error').textContent='';const amount=entryAmount();document.getElementById('amount-preview').textContent=Number.isFinite(amount)?format(amount):'Enter an amount, e.g. 500 for 500.000.';}
function showConfirm(title,copy,fields,action,label='Confirm'){
 if(dialogActive(confirmDialog))return;
 confirmDialog.setAttribute('aria-labelledby','confirm-title');confirmDialog.setAttribute('aria-describedby','confirm-copy');
 confirmDialog.innerHTML='<div class="dialog-inner"><div class="dialog-header"><h2 id="confirm-title">'+e(title)+'</h2><button class="icon-button" data-close="confirm" aria-label="Close">'+icon('close')+'</button></div><p id="confirm-copy" class="confirmation-copy">'+e(copy)+'</p><form id="confirm-form" class="confirm-form">'+fields+'<p class="error-message" id="confirm-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" data-close="confirm">Cancel</button><button class="primary" type="submit">'+e(label)+'</button></div></form></div>';
 const form=document.getElementById('confirm-form');
 form.onsubmit=async ev=>{ev.preventDefault();const button=confirmDialog.querySelector('[data-submit-form]');if(button.disabled||dialogClosing(confirmDialog))return;button.disabled=true;try{await action(new FormData(form));await closeDialog(confirmDialog);render();}catch(err){document.getElementById('confirm-error').textContent=errorMessage(err);button.disabled=false;}};
 pinDialogActions(confirmDialog,'confirm-form');openDialog(confirmDialog,{focus:form.querySelector('input:not([type=hidden]),textarea,select')||confirmDialog.querySelector('[data-close]')});
}
function deleteExpense(key){
 if(busy||dialogClosing(expenseDialog)||expenseDialog.querySelector('[data-submit-form]')?.disabled)return;
 const t=state.transactions.find(t=>t.id===key);if(!t)return;
 showConfirm('Delete expense?','Delete '+t.description+' ('+format(t.amount)+')? Your budgets will update immediately.','',async()=>{await commit(next=>{next.transactions=next.transactions.filter(r=>r.id!==key);});await closeDialog(expenseDialog,{immediate:true});notify('Expense deleted');},'Delete expense');
}
function renamedCategories(next){
 const form=document.getElementById('categories-form');if(form)next.categories.forEach(c=>{if(form.elements.namedItem(c.id))c.name=form.elements.namedItem(c.id).value.trim();});
}
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function doAction(button){
 if(await income.action(button.dataset.action,button.dataset.id,button))return;
 if(await cloud.action(button.dataset.action))return;
 const key=button.dataset.id;
 switch(button.dataset.action){
 case 'theme':toggleTheme(button);break;
 case 'toggle-overview':{const expanded=button.getAttribute('aria-expanded')!=='true';document.getElementById('spending-overview-copy')?.classList.toggle('overview-collapsed',!expanded);button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'Read less':'Read more';break;}
 case 'more-history':{historyLimit+=60;document.getElementById('history-list').innerHTML=historyBody();const more=app.querySelector('[data-action=more-history]');if(more)more.focus({preventScroll:true});else{const status=app.querySelector('.history-pagination p');status?.setAttribute('tabindex','-1');status?.focus({preventScroll:true});}break;}
 case 'page':navigate(button.dataset.page);break;
 case 'add':openExpense();break;
 case 'edit':openExpense(state.transactions.find(t=>t.id===key));break;
 case 'quick':openExpense(null,state.quickExpenses.find(q=>q.id===key));break;
 case 'month':{const [y,m]=month.split('-').map(Number);switchMonth(localDate(new Date(y,m-1+Number(button.dataset.direction),1)).slice(0,7));break;}
 case 'export-json':download(JSON.stringify(await repo.load(),null,2),'application/json','saku-backup-'+localDate()+'.json');notify('JSON backup exported');break;
 case 'export-csv':download(csv(await repo.load()),'text/csv;charset=utf-8','saku-transactions-'+localDate()+'.csv');notify('All transactions exported');break;
 case 'import':document.getElementById('import-file').click();break;
 case 'import-saved-income':{const saved=await readLegacyIncome();if(!saved)throw new Error('No saved income found on this device.');confirmIncomeImport(saved);break;}
 case 'reset':showConfirm('Reset all data?','This removes all expenses, income, historical summaries, budgets, categories, and quick expenses. Export a JSON backup first. Type RESET to continue.','<label class="field">Confirmation<input name="confirm" placeholder="RESET" autocomplete="off" required></label>',async data=>{if(data.get('confirm')!=='RESET')throw new Error('Type RESET exactly to confirm.');await commit(next=>{const fresh=seedState();fresh.legacyIncomeImports=next.legacyIncomeImports;fresh.transactions=[];fresh.summaries={};fresh.budgets={};fresh.quickExpenses=[];Object.keys(next).forEach(k=>delete next[k]);Object.assign(next,fresh);});search='';categoryFilter='';notify('All data reset');},'Reset data');break;
 case 'move-category':await commit(next=>{renamedCategories(next);const i=next.categories.findIndex(c=>c.id===key),j=i+Number(button.dataset.direction);if(i>=0&&j>=0&&j<next.categories.length)[next.categories[i],next.categories[j]]=[next.categories[j],next.categories[i]];});render();notify('Category order saved');break;
 case 'delete-category':{const c=cat(key);if(!c||state.categories.length<=1)return;showConfirm('Delete '+c.name+'?','Choose where to move this category’s transactions, summary totals, quick expenses, and allocated budgets. Nothing will be lost.','<label class="field">Move everything to<select name="destination">'+state.categories.filter(c=>c.id!==key).map(c=>'<option value="'+e(c.id)+'">'+e(c.name)+'</option>').join('')+'</select></label>',async data=>{const dest=data.get('destination');await commit(next=>{if(!next.categories.some(c=>c.id===dest)||dest===key)throw new Error('Choose another category.');next.transactions.forEach(t=>{if(t.categoryId===key)t.categoryId=dest;});next.quickExpenses.forEach(q=>{if(q.categoryId===key)q.categoryId=dest;});for(const b of Object.values(next.budgets)){if(b.categories[key]!==undefined)b.categories[dest]=(b.categories[dest]||0)+b.categories[key];delete b.categories[key];}for(const s of Object.values(next.summaries)){s.categories[dest]=(s.categories[dest]||0)+(s.categories[key]||0);delete s.categories[key];}next.categories=next.categories.filter(c=>c.id!==key);});if(categoryFilter===key)categoryFilter=dest;notify('Category removed; expenses moved');},'Delete category');break;}
 case 'new-quick':showConfirm('New quick expense','Set up a common expense. You can change it each time before saving.','<label class="field">Description<input name="description" maxlength="160" required></label><label class="field">Amount (×1.000)<input name="amount" inputmode="decimal" placeholder="10" required></label><label class="field">Category<select name="categoryId">'+options(state.categories[0].id)+'</select></label>',async data=>{const q={id:id(),description:data.get('description').trim(),amount:amountFromInput(data.get('amount')),categoryId:data.get('categoryId')};await commit(next=>next.quickExpenses.push(q));notify('Quick expense added');},'Add quick expense');break;
 case 'delete-quick':await commit(next=>{next.quickExpenses=next.quickExpenses.filter(q=>q.id!==key);});render();notify('Quick expense removed');break;
 case 'persistent-storage':{const protectedStorage=await navigator.storage?.persist?.();const status=document.getElementById('storage-status');status.textContent=protectedStorage?'Persistent storage granted. Keep backups when changing devices.':'Your browser manages storage automatically. Keep regular JSON backups.';break;}
 case 'install':if(installPrompt){await installPrompt.prompt();installPrompt=null;button.hidden=true;}break;
 }
}

function confirmIncomeImport(saved){
 const preview=consolidateIncome(state,saved);
 if(!preview.added){notify('These income records have already been imported. No duplicates added.');return;}
 showConfirm('Import saved income?', 'Add '+preview.added+' saved records to '+(cloud.user?'this account':'this tracker')+'? Expenses and existing budgets stay in place. Saved salary is counted only as the starting budget, never as extra income.','',async()=>{await commit(next=>{const result=consolidateIncome(next,saved);Object.assign(next,result.state);});notify('Saved income imported');},'Import income');
}
app.addEventListener('click',async ev=>{const button=ev.target.closest('[data-action]');if(!button)return;try{await doAction(button);}catch(err){notify(errorMessage(err));}});
app.addEventListener('toggle',ev=>{
 const details=ev.target;if(!details.matches?.('.category-expenses')||!details.open||details.dataset.loaded)return;
 const m=metrics(state,month),key=details.dataset.category;
 const rows=m.rows.filter(t=>t.categoryId===key).sort((a,b)=>b.amount-a.amount||b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const summary=m.summary?.categories[key]||0;
 details.querySelector('.category-expenses-list').innerHTML=(summary?'<p class="category-summary-note">Monthly summary: '+format(summary)+'. No individual expense records were supplied for this amount.</p>':'')+(rows.length?'<p class="category-expense-order muted">Highest to lowest amount</p>'+rows.map(t=>transactionRow(t,true)).join(''):'<p class="muted">No individual expenses recorded in this category for the selected period.</p>');
 details.dataset.loaded='true';
},true);
app.addEventListener('input',ev=>{if(ev.target.id==='transaction-search'){search=ev.target.value;historyLimit=60;document.getElementById('history-list').innerHTML=historyBody();}});
app.addEventListener('change',async ev=>{
 if(ev.target.id==='color-palette'){applyPalette(ev.target.value);notify('Palette saved');}
 if(ev.target.id==='selected-month')switchMonth(ev.target.value);
 if(ev.target.id==='category-filter'){
  categoryFilter=ev.target.value;historyLimit=60;
  document.getElementById('history-list').innerHTML=historyBody();
  const menu=ev.target.closest('.filter-menu');
  if(menu){menu.open=false;menu.querySelector('summary')?.focus({preventScroll:true});}
 }
 if(ev.target.id==='import-file'){
  const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
  try{if(file.size>20*1024*1024)throw new Error('Backup is too large. Maximum size is 20 MB.');const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(raw?.app===LEGACY_APP){confirmIncomeImport(raw);return;}const imported=validateState(raw);showConfirm('Restore JSON backup?','Replace your current data with '+imported.transactions.length+' expenses, '+imported.income.length+' income records, '+imported.categories.length+' categories, and '+Object.keys(imported.summaries).length+' historical summaries? Export your current backup first.','',async()=>{await commit(next=>{const ledger=[...new Map([...next.legacyIncomeImports,...imported.legacyIncomeImports].map(r=>[r.id,r])).values()];Object.keys(next).forEach(k=>delete next[k]);Object.assign(next,imported,{legacyIncomeImports:ledger});});search='';categoryFilter='';notify('Backup restored');},'Restore backup');}catch(err){notify(errorMessage(err));}
 }
});
app.addEventListener('submit',async ev=>{
 const form=ev.target;ev.preventDefault();const data=new FormData(form),submit=form.querySelector('[type="submit"]');if(submit?.disabled||busy)return;if(submit)submit.disabled=true;
 try{
  if(form.id==='budget-form'){const overall=amountFromInput(data.get('overall')),emergencyFunds=amountFromInput(String(data.get('emergencyFunds')||'').trim()||'0');const categories={};state.categories.forEach(c=>{const raw=String(data.get('budget-'+c.id)||'').trim();if(raw)categories[c.id]=amountFromInput(raw);});await commit(next=>{next.budgets[month]={overall,emergencyFunds,categories};});notify('Budgets saved');}
  else if(form.id==='preferences-form'){const settings={currency:data.get('currency'),startDay:Number(data.get('startDay')),defaultBudget:amountFromInput(data.get('defaultBudget'))};await commit(next=>{next.settings=settings;});notify('Preferences saved');}
  else if(form.id==='income-sources-form'){await income.saveSources();notify('Income sources saved');}
  else if(form.id==='add-income-source-form'){await income.addSource(data.get('name'));notify('Income source added');}
  else if(form.id==='categories-form'){await commit(next=>renamedCategories(next));notify('Category names saved');}
  else if(form.id==='add-category-form'){const name=data.get('name').trim();await commit(next=>next.categories.push({id:id(),name,icon:'grid',color:'#8698ad'}));notify('Category added');}
  else if(form.id==='quick-form'){await commit(next=>{next.quickExpenses.forEach(q=>{q.description=String(data.get('description-'+q.id)).trim();q.amount=amountFromInput(data.get('amount-'+q.id));q.categoryId=data.get('category-'+q.id);});});notify('Quick expenses saved');}
  render();
 }catch(err){notify(errorMessage(err));if(submit)submit.disabled=false;}
});
expenseDialog.addEventListener('focusin',ev=>{
 if(!ev.target.matches('input,textarea,select'))return;
 const details=Boolean(ev.target.closest('.expense-options'));
 expenseDialog.classList.toggle('details-mode',details);
 const button=expenseDialog.querySelector('[data-expense-details]');
 button.textContent=details?'Entry':'Details';button.setAttribute('aria-expanded',String(details));
});
expenseDialog.addEventListener('input',ev=>{if(ev.target.name==='amount')updateAmountPreview();});
expenseDialog.addEventListener('click',ev=>{
 const detailsButton=ev.target.closest('[data-expense-details]');if(detailsButton){
  const show=expenseDialog.classList.toggle('details-mode');detailsButton.textContent=show?'Entry':'Details';detailsButton.setAttribute('aria-expanded',String(show));
  if(show){expenseDialog.querySelector('.entry-details').open=true;document.activeElement?.blur();detailsButton.focus({preventScroll:true});}
  else document.getElementById('expense-amount').focus({preventScroll:true});
  return;
 }
 const close=ev.target.closest('[data-close]');if(close){if(!busy&&!expenseDialog.querySelector('[data-submit-form]')?.disabled)closeDialog(expenseDialog);return;}
 const deletion=ev.target.closest('[data-delete-expense]');if(deletion){deleteExpense(deletion.dataset.deleteExpense);return;}
 const suggestion=ev.target.closest('[data-suggestion]');if(suggestion){const t=state.transactions.find(t=>t.id===suggestion.dataset.suggestion);if(!t)return;const form=document.getElementById('expense-form');form.elements.description.value=t.description;form.elements.amount.value=amountText(t.amount);form.elements.categoryId.value=t.categoryId;updateAmountPreview();return;}
});
expenseDialog.addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,data=new FormData(form),button=expenseDialog.querySelector('[data-submit-form]');if(button.disabled||busy||dialogClosing(expenseDialog))return;button.disabled=true;const savedLabel=button.textContent;button.textContent='Saving…';
 try{const existingId=form.dataset.id;const previous=state.transactions.find(t=>t.id===existingId);const t={id:existingId||id(),amount:entryAmount(),description:String(data.get('description')||'').trim()||cat(data.get('categoryId'))?.name||'Expense',categoryId:data.get('categoryId'),date:data.get('date'),note:String(data.get('note')||'').trim(),createdAt:previous?.createdAt||new Date().toISOString()};
 if(!Number.isSafeInteger(t.amount)||t.amount<=0){document.getElementById('expense-amount').setAttribute('aria-invalid','true');throw new Error('Enter a positive amount, e.g. 500 for 500.000.');}validateExpense(t,state);await commit(next=>{if(existingId){const index=next.transactions.findIndex(r=>r.id===existingId);if(index<0)throw new Error('This expense was removed in another tab.');next.transactions[index]=t;}else next.transactions.push(t);});month=expenseMonth(t.date,state.settings.startDay);await closeDialog(expenseDialog);render();notify(existingId?'Expense updated':'Expense saved · '+format(t.amount));}
 catch(err){document.getElementById('expense-error').textContent=errorMessage(err);button.disabled=false;button.textContent=savedLabel;expenseDialog.classList.remove('details-mode');const details=expenseDialog.querySelector('[data-expense-details]');details.textContent='Details';details.setAttribute('aria-expanded','false');document.getElementById('expense-amount').focus();}
});
confirmDialog.addEventListener('click',ev=>{if(ev.target.closest('[data-close]')&&!confirmDialog.querySelector('[data-submit-form]')?.disabled)closeDialog(confirmDialog);});
[expenseDialog,incomeDialog,confirmDialog].forEach(dialog=>dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy&&!dialog.querySelector('[data-submit-form]')?.disabled)closeDialog(dialog);}));
[expenseDialog,incomeDialog,confirmDialog].forEach(dialog=>dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(!busy&&!dialog.querySelector('[data-submit-form]')?.disabled&&(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom))closeDialog(dialog);}}));
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['home','transactions','reports','settings'].includes(next)&&next!==page){page=next;historyLimit=60;render({focusPage:true});window.scrollTo({top:0});animatePage(document.getElementById('main-content'));}});
channel?.addEventListener('message',async()=>{if(busy)return;try{state=await repo.load();if(!expenseDialog.open&&!incomeDialog.open&&!confirmDialog.open)render();}catch(err){notify(errorMessage(err));}});
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installPrompt=ev;const button=document.getElementById('install-button');if(button)button.hidden=false;});
installDisclosureMotion();
installFooterActions();
installKeyboardLayout();
installPullRefresh({isBlocked:()=>busy||expenseDialog.open||incomeDialog.open||confirmDialog.open||Boolean(document.activeElement?.matches('input,textarea,select')),refresh:async()=>{const result=await cloud.repository?.sync();if(result?.error)throw result.error;await withLock(async()=>{state=await repo.load();render();});}});
async function registerAgentTools(){
 const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try{await context.registerTool({name:'read_monthly_expenses',description:'Read the selected mySaku monthly spending and remaining budgets stored on this device.',inputSchema:{type:'object',properties:{month:{type:'string',pattern:'^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'}},required:['month'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input.month!=='string'||!/^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(input.month))throw new Error('Use YYYY-MM for month.');const m=metrics(state,input.month);return {month:input.month,currency:state.settings.currency,spent:m.spent,remaining:m.remaining,budget:m.budget.overall,extraIncome:m.extraIncome,available:m.available,emergencyFunds:m.emergencyFunds,spendable:m.spendable,categories:m.categories};}},{signal:lifecycle.signal});}catch(err){console.info('Optional browser tool registration unavailable',err);}
}
try{state=await withLock(async()=>{const current=await repo.load();try{legacyIncome=await readLegacyIncome();if(legacyIncome){const migrated=consolidateIncome(current,legacyIncome);if(migrated.added){await repo.save(migrated.state);notify('Saved income added to your tracker');}return migrated.state;}}catch(error){notify('Saved income could not be imported. Your records are unchanged. Retry from Settings or import its JSON backup.');}return current;});month=expenseMonth(localDate(),state.settings.startDay);render();cloud.init().then(()=>{if(!expenseDialog.open&&!incomeDialog.open&&!confirmDialog.open)render();});await registerAgentTools();if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>notify('Offline cache unavailable. Your data still saves on this device.'));}
catch(err){app.innerHTML='<div class="app-shell"><div class="brand"><img src="./icon.svg" alt="">mySaku</div><section class="card" style="margin-top:30px"><h1>Couldn’t open local storage</h1><p class="notice">'+e(errorMessage(err))+'</p><p>Enable browser storage and reload. Existing data has not been reset.</p><button class="primary" style="margin-top:20px" onclick="location.reload()">Try again</button></section></div>';}


