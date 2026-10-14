import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,validateState,metrics,budgetFor,csv} from '../dist/model.mjs';
import {mergeStates,SyncConflict,SyncRepository} from '../dist/sync.mjs';
import {consolidateIncome,LEGACY_APP} from '../dist/income-legacy.mjs';
const clone=x=>structuredClone(x);
function fixture(){const s=seedState();s.budgets['2026-10']={overall:5000000,emergencyFunds:500000,categories:{makan:1500000}};s.transactions=[{id:'expense',amount:1000000,date:'2026-10-15',categoryId:'makan',description:'Food',note:'',createdAt:'2026-10-15T10:00:00Z'}];s.income=[{id:'bonus',amount:500000,date:'2026-10-15',source:'bonus',title:'Work bonus',note:'',createdAt:1}];return s;}
test('emergency reserve reduces remaining and guidance without becoming an expense',()=>{
 const s=fixture(),m=metrics(s,'2026-10','2026-10-15');assert.equal(m.available,5500000);assert.equal(m.emergencyFunds,500000);assert.equal(m.spendable,5000000);assert.equal(m.remaining,4000000);assert.equal(m.spent,1000000);assert.equal(m.categories.makan,1000000);assert.equal(m.percent,20);assert.equal(m.recommended,4000000/16);assert.equal(m.rows.length,1);assert.equal(m.incomeRows.length,1);assert.equal(csv(s).split('\r\n').length,3);
 s.budgets['2026-10'].emergencyFunds=200000;assert.equal(metrics(s,'2026-10').remaining,4300000);s.budgets['2026-10'].emergencyFunds=0;assert.equal(metrics(s,'2026-10').remaining,4500000);
});
test('older backups and months without a reserve retain their values and use zero',()=>{
 const s=fixture();delete s.budgets['2026-10'].emergencyFunds;const before=clone(s),clean=validateState(s);assert.deepEqual(clean,s);assert.deepEqual(s,before);assert.equal(budgetFor(clean,'2026-10').emergencyFunds,0);assert.equal(metrics(clean,'2026-10').remaining,4500000);assert.equal(budgetFor(clean,'2026-11').emergencyFunds,0);s.settings.defaultBudget=2000000;assert.equal(metrics(s,'2026-11').remaining,2000000);
});
test('reserve belongs to configured budget period; summaries stay expenses and salary references stay excluded',()=>{
 const s=fixture();s.settings.startDay=8;s.income[0].date='2026-11-07';s.transactions[0].date='2026-11-07';s.income.push({id:'legacy-money-plus-salary',source:'salary',amount:5000000,date:'2026-10-08',title:'Saved salary',note:'',createdAt:2});s.summaries['2026-10']={total:100000,categories:{makan:100000}};
 const m=metrics(s,'2026-10');assert.equal(m.extraIncome,500000);assert.equal(m.spent,1100000);assert.equal(m.remaining,3900000);assert.equal(metrics(s,'2026-11').emergencyFunds,0);assert.equal(metrics(s,'2026-11').spent,0);
 const legacy={app:LEGACY_APP,version:1,entries:[{id:'new-salary',amount:6000000,date:'2026-10-08',source:'salary',title:'Salary',note:'',createdAt:3}]};const imported=consolidateIncome(s,legacy).state;assert.equal(imported.budgets['2026-10'].emergencyFunds,500000);assert.equal(imported.budgets['2026-10'].overall,5000000);assert.equal(metrics(imported,'2026-10').remaining,3900000);
});
test('invalid reserves reject safely; oversubscribed reserves show negative balance without negative guidance',()=>{
 for(const bad of [-1,1.5,NaN,Infinity,null,'500',1000000000001]){const s=fixture();s.budgets['2026-10'].emergencyFunds=bad;assert.throws(()=>validateState(s),/Emergency funds/);}
 const s=fixture();s.budgets['2026-10'].emergencyFunds=6000000;const m=metrics(validateState(s),'2026-10','2026-10-15');assert.equal(m.remaining,-1500000);assert.equal(m.recommended,0);assert.equal(m.percent,0);assert.equal(m.spent,1000000);assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
});
test('reserve changes sync over old baseline and merge independent expense changes',()=>{
 const base=fixture();delete base.budgets['2026-10'].emergencyFunds;const a=clone(base),b=clone(base);a.budgets['2026-10'].emergencyFunds=300000;b.transactions[0].amount=900000;const merged=mergeStates(base,a,b);assert.equal(merged.budgets['2026-10'].emergencyFunds,300000);assert.equal(metrics(merged,'2026-10').remaining,4300000);b.budgets['2026-10'].emergencyFunds=400000;assert.throws(()=>mergeStates(base,a,b),SyncConflict);
});
test('reserve survives offline reload, sync, backups, and account separation',async()=>{
 const records=new Map(),store={async readRecord(key){return clone(records.get(key));},async writeRecord(key,value){records.set(key,clone(value));}};let offline=true,online=null;const remote={async read(){if(offline)throw new Error('Offline');return clone(online);},async write(state,revision){online={state:clone(state),revision:revision+1};return clone(online);}};
 let repo=new SyncRepository({store,remote,userId:'alice'});await repo.save(fixture());assert.ok((await repo.sync()).error);repo.close();repo=new SyncRepository({store,remote,userId:'alice'});assert.equal((await repo.load()).budgets['2026-10'].emergencyFunds,500000);assert.equal(metrics(validateState(JSON.parse(JSON.stringify(await repo.load()))),'2026-10').remaining,4000000);const other=new SyncRepository({store,remote,userId:'bob'});assert.equal(budgetFor(await other.load(),'2026-10').emergencyFunds,0);offline=false;await repo.sync();assert.equal(online.state.budgets['2026-10'].emergencyFunds,500000);assert.equal(online.state.transactions.length,1);assert.equal((await repo.record()).pending,null);repo.close();other.close();
});
