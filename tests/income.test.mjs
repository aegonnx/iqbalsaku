import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,validateState,metrics,csv} from '../dist/model.mjs';
import {consolidateIncome,LEGACY_APP} from '../dist/income-legacy.mjs';
import {mergeStates,SyncConflict,SyncRepository} from '../dist/sync.mjs';
import {amountFromInput,amountText} from '../dist/amount-input.mjs';
const clone=x=>structuredClone(x);
const income=(id='bonus',amount=500000,date='2026-10-15',source='bonus')=>({id,amount,date,source,title:'Work bonus',note:'',createdAt:1});
const expense={id:'expense',amount:1000000,date:'2026-10-07',categoryId:'makan',description:'Expense',note:'',createdAt:'2026-10-07T00:00:00Z'};
const fixture=()=>{const s=seedState();s.budgets['2026-10']={overall:5000000,categories:{makan:1500000}};s.transactions=[clone(expense)];return s;};
const legacy=()=>({app:LEGACY_APP,version:1,entries:[{...income('salary',5000000,'2026-10-01','salary'),title:'Monthly salary'},income()]});

test('salary counted once: 5m budget + 500k bonus - 1m spent = 4.5m',()=>{
 const s=fixture();s.income.push(income());const m=metrics(validateState(s),'2026-10','2026-10-07');
 assert.equal(m.startingBudget,5000000);assert.equal(m.extraIncome,500000);assert.equal(m.available,5500000);assert.equal(m.spent,1000000);assert.equal(m.remaining,4500000);
 assert.equal(m.budget.categories.makan,1500000);assert.equal(m.categories.makan,1000000);assert.equal(m.recommended,4500000/24);
});
test('income edits, date changes and deletes update balances without changing expenses',()=>{
 const s=fixture();s.income=[income()];s.income[0].amount=750000;assert.equal(metrics(s,'2026-10').remaining,4750000);
 s.income[0].date='2026-11-01';assert.equal(metrics(s,'2026-10').extraIncome,0);assert.equal(metrics(s,'2026-11').extraIncome,750000);
 s.income=[];assert.equal(metrics(s,'2026-10').remaining,4000000);assert.deepEqual(s.transactions,[expense]);
});
test('income and expenses share configured budget period boundaries',()=>{
 const s=fixture();s.settings.startDay=8;s.income=[income('before',100,'2026-10-07'),income('start',200,'2026-10-08'),income('end',300,'2026-11-07'),income('next',400,'2026-11-08')];
 assert.equal(metrics(s,'2026-09').extraIncome,100);assert.equal(metrics(s,'2026-10').extraIncome,500);assert.equal(metrics(s,'2026-11').extraIncome,400);
 assert.equal(metrics(s,'2026-10').spent,0);assert.equal(metrics(s,'2026-09').spent,1000000);
});
test('saved income migrates once; existing budget and category allocations survive',()=>{
 const current=fixture(),old=legacy(),result=consolidateIncome(current,old);
 assert.equal(result.added,2);assert.equal(result.budgetsAdded,0);assert.equal(metrics(result.state,'2026-10').remaining,4500000);
 assert.deepEqual(result.state.transactions,current.transactions);assert.deepEqual(result.state.budgets,current.budgets);assert.deepEqual(old,legacy());assert.equal(current.income.length,0);
 const again=consolidateIncome(result.state,old);assert.equal(again.added,0);assert.deepEqual(again.state,result.state);
 result.state.income=result.state.income.filter(t=>t.source!=='bonus');assert.equal(consolidateIncome(result.state,old).added,0);assert.equal(metrics(consolidateIncome(result.state,old).state,'2026-10').extraIncome,0);
 const reset=seedState();reset.legacyIncomeImports=result.state.legacyIncomeImports;assert.equal(consolidateIncome(reset,old).added,0);
});
test('missing starting budget initializes from saved salary once; zero and default budgets respected',()=>{
 const s=seedState();let r=consolidateIncome(s,legacy());assert.equal(r.budgetsAdded,1);assert.equal(metrics(r.state,'2026-10').remaining,5500000);assert.equal(consolidateIncome(r.state,legacy()).budgetsAdded,0);
 s.budgets['2026-10']={overall:0,categories:{makan:100}};r=consolidateIncome(s,legacy());assert.equal(metrics(r.state,'2026-10').remaining,500000);assert.equal(r.state.budgets['2026-10'].categories.makan,100);
 delete s.budgets['2026-10'];s.settings.defaultBudget=3000000;r=consolidateIncome(s,legacy());assert.equal(metrics(r.state,'2026-10').remaining,3500000);assert.deepEqual(r.state.budgets,{});
});
test('legacy salary follows configured period and other sources stay extra income',()=>{
 const s=seedState();s.settings.startDay=8;const old=legacy();old.entries.push(income('salary-2',5000000,'2026-10-08','salary'),income('gift',200000,'2026-10-20','gift'));
 const r=consolidateIncome(s,old).state;assert.equal(r.budgets['2026-09'].overall,5000000);assert.equal(r.budgets['2026-10'].overall,5000000);assert.equal(metrics(r,'2026-10').remaining,5700000);
});
test('old expense backups normalize missing income; new backups round-trip and CSV distinguish income',()=>{
 const old=fixture();delete old.income;delete old.legacyIncomeImports;const normalized=validateState(old);assert.deepEqual(normalized.income,[]);assert.deepEqual(normalized.legacyIncomeImports,[]);
 const s=consolidateIncome(normalized,legacy()).state;s.income[1].title='=formula';const restored=validateState(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);
 const output=csv(restored);assert.match(output,/"Expense"/);assert.match(output,/"Income"/);assert.match(output,/Starting salary reference \(excluded/);assert.match(output,/'=formula/);
 const missingLedger=clone(s);delete missingLedger.legacyIncomeImports;assert.equal(validateState(missingLedger).legacyIncomeImports.length,2);
});
test('income rejects bad amount/date/source/duplicate IDs and invalid legacy imports atomically',()=>{
 const s=fixture();s.income=[income()];for(const change of [{amount:0},{amount:-1},{amount:1.5},{date:'2026-02-30'},{date:'2026-10-99'},{source:'salary'},{source:'unknown'},{note:null},{createdAt:-1}]){const bad=clone(s);Object.assign(bad.income[0],change);assert.throws(()=>validateState(bad));}
 s.income.push(income());assert.throws(()=>validateState(s),/duplicate/);
 const current=fixture(),bad=legacy();bad.entries[1].amount=-1;assert.throws(()=>consolidateIncome(current,bad));assert.deepEqual(current,fixture());
});
test('income uses existing thousands input and rupiah edit conversion',()=>{
 assert.equal(amountFromInput('500'),500000);assert.equal(amountText(500000),'500');assert.equal(amountFromInput('2500'),2500000);assert.equal(amountFromInput('8.001'),8001);
});
test('two upgraded devices merge extra income over an old cloud baseline',()=>{
 const base=fixture();delete base.income;delete base.legacyIncomeImports;const a=validateState(base),b=validateState(base);a.income.push(income('a'));b.income.push(income('b',200000));b.transactions[0].amount=1200000;
 const merged=mergeStates(base,a,b);assert.equal(merged.income.length,2);assert.equal(metrics(merged,'2026-10').remaining,4500000);
 const local=clone(merged),remote=clone(merged);local.income=local.income.filter(t=>t.id!=='a');remote.income.find(t=>t.id==='b').note='Edited elsewhere';assert.equal(mergeStates(merged,local,remote).income.some(t=>t.id==='a'),false);
 local.income=clone(merged.income);local.income[0].amount=600000;remote.income[0].amount=700000;assert.throws(()=>mergeStates(merged,local,remote),SyncConflict);
});
test('concurrent migration merges ledger by IDs, preserving deletions across sync',()=>{
 const base=fixture(),a=consolidateIncome(base,legacy()).state,b=consolidateIncome(base,legacy()).state;b.income.push(income('gift',100000,'2026-10-18','gift'));
 const merged=mergeStates(base,a,b);assert.equal(merged.legacyIncomeImports.length,2);assert.equal(merged.income.length,3);assert.equal(metrics(merged,'2026-10').remaining,4600000);
});
test('account income saves offline, survives reopening and syncs after reconnect with account isolation',async()=>{
 const rows=new Map(),store={async readRecord(k){return clone(rows.get(k));},async writeRecord(k,v){rows.set(k,clone(v));}};let offline=true,online=null;
 const remote={async read(){if(offline)throw new Error('Offline');return clone(online);},async write(state,revision){online={state:clone(state),revision:revision+1};return clone(online);}};
 let a=new SyncRepository({store,remote,userId:'alice'});const s=await a.load();s.income=[income()];await a.save(s);assert.ok((await a.sync()).error);a.close();a=new SyncRepository({store,remote,userId:'alice'});assert.equal((await a.load()).income.length,1);
 const b=new SyncRepository({store,remote,userId:'bob'});assert.equal((await b.load()).income.length,0);offline=false;await a.sync();assert.equal(online.state.income[0].amount,500000);assert.equal((await a.record()).pending,null);a.close();b.close();
});
