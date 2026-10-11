import {INCOME_SOURCES,validateIncomeFields,sourceName} from './income-model.mjs';
export const VERSION = 1;
export const categoryNames = ['Makan','Snack','Dating','Kebutuhan Rumah','Transport','Sosial / Entertainment','Peralatan Kerja','Bantu Ibu','Lain-lain','Paket Data','Sedekah / Sosial'];
export const categoryIds = ['makan','snack','dating','rumah','transport','entertainment','kerja','ibu','lain','data','sedekah'];
export const categoryIcons = ['utensils','utensils','heart','home','car','sparkles','briefcase','hand','grid','phone','gift'];
export const categoryColors = ['#63856e','#b49769','#ab7e91','#8698ad','#6b89ab','#b49769','#7a829f','#659895','#919aa8','#818eaf','#9d9981'];
export function id() { return crypto.randomUUID(); }
export function localDate(date = new Date()) { return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'); }
export function parseAmount(raw) {
  let s = String(raw).trim().toLowerCase().replace(/^rp\s*/,'').replace(/\s/g,'');
  let multiplier = 1;
  if (s.endsWith('k')) { multiplier = 1000; s = s.slice(0,-1).replace(',','.'); }
  else { if (/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,''); else if (/^\d{1,3}(,\d{3})+$/.test(s)) s=s.replace(/,/g,''); }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s)*multiplier;
  return Number.isSafeInteger(n) && n >= 0 && n <= 1000000000000 ? n : NaN;
}
export function seedState() {
  return {version:VERSION,categoryDefaultsVersion:1,settings:{currency:'IDR',startDay:1,defaultBudget:0},
    categories:categoryIds.map((key,i)=>({id:key,name:categoryNames[i],icon:categoryIcons[i],color:categoryColors[i]})),
    transactions:[],income:[],incomeSources:structuredClone(INCOME_SOURCES),legacyIncomeImports:[],budgets:{},summaries:{},quickExpenses:[]};
}
export function upgradeState(raw) {
  const state=validateState(raw);
  if(state.categoryDefaultsVersion>=1)return state;
  if(state.categories.length<100&&!state.categories.some(c=>c.id==='snack'||c.name.toLowerCase()==='snack')){
    const index=state.categories.findIndex(c=>c.id==='makan');
    state.categories.splice(index<0?state.categories.length:index+1,0,{id:'snack',name:'Snack',icon:'utensils',color:'#b49769'});
  }
  // Saved with the next edit, so a deleted or renamed default stays that way.
  // Return a copy: the exact cloud baseline must remain intact for merging.
  state.categoryDefaultsVersion=1;
  return state;
}
export function period(month,startDay=1) {
  const [y,m] = month.split('-').map(Number);
  const start=new Date(y,m-1,startDay), end=new Date(y,m,startDay);
  return {start:localDate(start),end:localDate(end),days:Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000)};
}
export function expenseMonth(date,startDay=1) {
  const [y,m,d]=date.split('-').map(Number);const dt=new Date(y,m-1-(d<startDay?1:0),1);
  return localDate(dt).slice(0,7);
}
export function budgetFor(state,month) { return state.budgets[month] || {overall:state.settings.defaultBudget,categories:{}}; }
export function metrics(state,month,today=localDate()) {
  const range=period(month,state.settings.startDay), rows=state.transactions.filter(t=>t.date>=range.start&&t.date<range.end);
  const summary=state.summaries[month]; const categories=Object.fromEntries(state.categories.map(c=>[c.id,summary?.categories[c.id]||0]));
  for(const t of rows) categories[t.categoryId]=(categories[t.categoryId]||0)+t.amount;
  const spent=rows.reduce((n,t)=>n+t.amount,summary?.total||0);const budget=budgetFor(state,month);
  const incomeRows=(state.income||[]).filter(t=>t.date>=range.start&&t.date<range.end);
  const extraIncome=incomeRows.filter(t=>t.source!=='salary').reduce((sum,t)=>sum+t.amount,0);
  const startingBudget=budget.overall,available=startingBudget+extraIncome;
  const startUTC=Date.parse(range.start+'T00:00:00Z'),todayUTC=Date.parse(today+'T00:00:00Z');
  const elapsed=today<range.start?0:today>=range.end?range.days:Math.floor((todayUTC-startUTC)/86400000)+1;
  const daysLeft=range.days-elapsed;
  return {rows,incomeRows,extraIncome,startingBudget,available,categories,spent,budget,remaining:available-spent,percent:available?spent/available*100:0,elapsed,daysLeft,average:elapsed?spent/elapsed:0,recommended:daysLeft?Math.max(0,available-spent)/daysLeft:0,range,summary};
}
export function budgetState(spent,budget) { if(budget===undefined||budget===null)return 'none';if(budget===0)return spent>0?'over':'normal'; const ratio=spent/budget;return ratio>1?'over':ratio>=.9?'warning':ratio>=.7?'caution':'normal'; }
export function validateExpense(t,state) {
  if (!t || typeof t.id!=='string' || !t.id || !validDate(t.date) || !Number.isSafeInteger(t.amount) || t.amount<=0 || t.amount>1000000000000 || typeof t.description!=='string' || !t.description.trim() || t.description.length>160 || typeof t.note!=='string' || t.note.length>2000 || !state.categories.some(c=>c.id===t.categoryId)) throw new Error('Expense needs a valid amount, description, date, and category.');
}
function validMonth(s) { return typeof s==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0,4))>=2000 && Number(s.slice(0,4))<=2100; }
export function validDate(s) { if(typeof s!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(s)||!validMonth(s.slice(0,7)))return false;const d=new Date(s+'T12:00:00');return !isNaN(d)&&localDate(d)===s; }
function money(n) { return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000; }
export function validateState(raw) {
  const s=structuredClone(raw);
  if(!s||s.version!==VERSION)throw new Error('This is not a supported mySaku backup (version 1).');
  if(!s.settings || !['IDR','USD','SGD'].includes(s.settings.currency) || !Number.isInteger(s.settings.startDay)||s.settings.startDay<1||s.settings.startDay>28||!money(s.settings.defaultBudget))throw new Error('Backup settings are invalid.');
  if(!Array.isArray(s.categories)||!s.categories.length||s.categories.length>100)throw new Error('Backup categories are invalid.');
  const ids=new Set(),names=new Set();
  s.categories.forEach(c=>{if(!c||typeof c.id!=='string'||!c.id||!/^[a-zA-Z0-9_-]+$/.test(c.id)||['__proto__','constructor','prototype'].includes(c.id)||c.id.length>100||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||names.has(c.name.trim().toLowerCase()))throw new Error('Backup has invalid or duplicate categories.');ids.add(c.id);names.add(c.name.trim().toLowerCase());c.name=c.name.trim();c.icon=categoryIcons.includes(c.icon)?c.icon:'grid';c.color=/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:'#8698ad';});
  if(!Array.isArray(s.transactions)||s.transactions.length>100000)throw new Error('Backup transactions are invalid.');
  const tids=new Set();s.transactions.forEach(t=>{validateExpense(t,s);if(tids.has(t.id))throw new Error('Backup has duplicate transaction IDs.');tids.add(t.id);});
  if(!s.budgets||typeof s.budgets!=='object'||Array.isArray(s.budgets))throw new Error('Backup budgets are missing.');
  Object.entries(s.budgets).forEach(([m,b])=>{if(!validMonth(m)||!b||!money(b.overall)||!b.categories||typeof b.categories!=='object'||Array.isArray(b.categories))throw new Error('Backup budgets are invalid.');Object.entries(b.categories).forEach(([key,n])=>{if(!ids.has(key)||!money(n))throw new Error('Backup category budgets are invalid.');});});
  if(!s.summaries||typeof s.summaries!=='object'||Array.isArray(s.summaries))throw new Error('Backup summaries are invalid.');
  Object.entries(s.summaries).forEach(([m,b])=>{if(!validMonth(m)||!b||!money(b.total)||!b.categories||typeof b.categories!=='object'||Array.isArray(b.categories))throw new Error('Backup summary is invalid.');let total=0;Object.entries(b.categories).forEach(([key,n])=>{if(!ids.has(key)||!money(n))throw new Error('Backup summary category is invalid.');total+=n;});if(total!==b.total)throw new Error('Summary categories must add up to the summary total.');});
  if(!Array.isArray(s.quickExpenses)||s.quickExpenses.length>100)throw new Error('Backup quick expenses are invalid.');
  const qids=new Set();s.quickExpenses.forEach(q=>{if(!q||typeof q.id!=='string'||!q.id||qids.has(q.id)||!ids.has(q.categoryId)||typeof q.description!=='string'||!q.description.trim()||q.description.length>160||!money(q.amount)||q.amount===0)throw new Error('Backup quick expense is invalid.');qids.add(q.id);});
  validateIncomeFields(s);
  return s;
}
export function csv(state) {
  const quote=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const rows=[['Date','Description','Category / Source','Amount','Currency','Note','Type'],...state.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,t.description,state.categories.find(c=>c.id===t.categoryId)?.name||'',t.amount,state.settings.currency,t.note,'Expense']),...(state.income||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,t.title,sourceName(t.source,state.incomeSources),t.amount,state.settings.currency,t.note,t.source==='salary'?'Starting salary reference (excluded from extra income)':'Income'])];
  return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}

