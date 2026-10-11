import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,validateState,metrics,csv} from '../dist/model.mjs';
import {INCOME_SOURCES,sourceName,renameIncomeSources,deleteIncomeSource} from '../dist/income-model.mjs';
import {indexHistory,historyPage} from '../dist/history.mjs';
import {consolidateIncome,LEGACY_APP} from '../dist/income-legacy.mjs';
import {mergeStates,SyncConflict,SyncRepository} from '../dist/sync.mjs';
const clone=x=>structuredClone(x);
const record=(id='bonus-record',source='bonus',amount=500000)=>({id,source,amount,date:'2026-10-15',title:'Existing payment',note:'Keep this note',createdAt:1});
function fixture(){const state=seedState();state.budgets['2026-10']={overall:5000000,categories:{makan:1500000}};state.income=[record()];state.transactions=[{id:'expense',amount:1000000,date:'2026-10-15',categoryId:'makan',description:'Meal',note:'',createdAt:'2026-10-15T10:00:00Z'}];return state;}

test('existing backups gain default income sources without modifying records or budgets',()=>{
 const old=fixture();delete old.incomeSources;const snapshot=clone(old),state=validateState(old);assert.deepEqual(state.incomeSources,INCOME_SOURCES);assert.deepEqual(state.income,old.income);assert.deepEqual(state.budgets,old.budgets);assert.deepEqual(old,snapshot);assert.equal(metrics(state,'2026-10').remaining,4500000);
 state.incomeSources[0].name='My bonus';assert.equal(INCOME_SOURCES[0].name,'Work bonus');
});
test('renames use stable source IDs and reach saved income, search, CSV, and JSON backups',()=>{
 const state=fixture(),before=clone(state.income);renameIncomeSources(state,[{id:'bonus',name:' Bonus kerja ',previousName:'Work bonus'}]);const clean=validateState(state);assert.deepEqual(clean.income,before);assert.equal(sourceName('bonus',clean.incomeSources),'Bonus kerja');assert.equal(metrics(clean,'2026-10').remaining,4500000);
 const index=indexHistory(clean.income.map(t=>({...t,kind:'income'})),clean.categories,clean.incomeSources);assert.equal(historyPage(index,{search:'bonus kerja'}).count,1);assert.match(csv(clean),/"Bonus kerja"/);assert.deepEqual(validateState(JSON.parse(JSON.stringify(clean))),clean);
});
test('custom sources validate income and survive source reorder and backup round-trip',()=>{
 const state=fixture();state.incomeSources.push({id:'rental',name:'Rental income'});state.income.push(record('custom','rental',250000));state.incomeSources.reverse();const clean=validateState(state);assert.equal(clean.incomeSources[0].id,'rental');assert.equal(metrics(clean,'2026-10').remaining,4750000);assert.deepEqual(validateState(JSON.parse(JSON.stringify(clean))).incomeSources,clean.incomeSources);assert.match(csv(clean),/"Rental income"/);
});
test('deleting a source moves its records without changing financial totals and does not reseed defaults',()=>{
 const state=fixture();state.incomeSources.push({id:'rental',name:'Rental income'});const before=clone(state);deleteIncomeSource(state,'bonus','rental');const clean=validateState(state);assert.equal(clean.income[0].source,'rental');assert.equal(clean.incomeSources.some(s=>s.id==='bonus'),false);assert.equal(validateState(clean).incomeSources.some(s=>s.id==='bonus'),false);assert.deepEqual(clean.transactions,before.transactions);assert.deepEqual(clean.budgets,before.budgets);assert.equal(clean.income[0].amount,before.income[0].amount);assert.equal(clean.income[0].note,before.income[0].note);assert.equal(metrics(clean,'2026-10').remaining,4500000);
 assert.throws(()=>deleteIncomeSource(state,'rental','rental'),/another/);assert.throws(()=>deleteIncomeSource(state,'rental','missing'),/another/);assert.throws(()=>deleteIncomeSource({...state,incomeSources:[{id:'rental',name:'Rental income'}]},'rental','missing'),/at least one/);
});
test('invalid sources and orphaned records are rejected; starting salary cannot become an extra-income source',()=>{
 for(const sources of [null,[],[{id:'bonus',name:'One'},{id:'bonus',name:'Two'}],[{id:'one',name:'Gift'},{id:'two',name:' gift '}],[{id:'one',name:' '}],[{id:'one',name:'x'.repeat(81)}],[{id:'salary',name:'Salary'}],[{id:'__proto__',name:'Bad'}]]){const state=fixture();state.incomeSources=sources;assert.throws(()=>validateState(state));}
 const state=fixture();state.incomeSources=state.incomeSources.filter(s=>s.id!=='bonus');assert.throws(()=>validateState(state),/source/);
 const salary=record('legacy-money-plus-salary','salary',5000000);const preserved=fixture();preserved.income.push(salary);assert.equal(metrics(validateState(preserved),'2026-10').remaining,4500000);
});
test('stale source rename fails instead of overwriting another device; unchanged fields preserve newer names',()=>{
 const state=fixture();state.incomeSources[0].name='Online bonus';assert.throws(()=>renameIncomeSources(state,[{id:'bonus',name:'Device bonus',previousName:'Work bonus'}]),/changed elsewhere/);assert.equal(state.incomeSources[0].name,'Online bonus');renameIncomeSources(state,[{id:'bonus',name:'Work bonus',previousName:'Work bonus'}]);assert.equal(state.incomeSources[0].name,'Online bonus');
});
test('legacy imports preserve deleted-source customizations and safely classify newly imported records',()=>{
 const state=fixture();deleteIncomeSource(state,'bonus','other');const old={app:LEGACY_APP,version:1,entries:[record('new-legacy-bonus')]};const migrated=consolidateIncome(state,old).state;assert.equal(migrated.incomeSources.some(s=>s.id==='bonus'),true);assert.equal(migrated.income[0].source,'other');assert.equal(migrated.income[1].source,'bonus');assert.equal(consolidateIncome(migrated,old).added,0);
 state.incomeSources.push({id:'custom-bonus',name:'Work bonus'});const matching=consolidateIncome(state,old).state;assert.equal(matching.incomeSources.some(s=>s.id==='bonus'),false);assert.equal(matching.income[1].source,'custom-bonus');assert.equal(matching.income[1].id,'legacy-money-plus-new-legacy-bonus');
});
test('new source additions and income merge across devices over old cloud data',()=>{
 const base=fixture();delete base.incomeSources;const a=validateState(base),b=validateState(base);a.incomeSources.push({id:'rental',name:'Rent'});a.income.push(record('rent','rental',200000));b.incomeSources.push({id:'business',name:'Business'});b.income.push(record('work','business',100000));const merged=mergeStates(base,a,b);assert.equal(merged.incomeSources.length,7);assert.equal(merged.income.length,3);assert.equal(metrics(merged,'2026-10').remaining,4800000);
 const c=clone(merged),d=clone(merged);c.incomeSources[0].name='Bonus A';d.incomeSources[0].name='Bonus B';assert.throws(()=>mergeStates(merged,c,d),SyncConflict);
});
test('source deletion with transfer merges unrelated changes; conflicting new income is kept pending for review',()=>{
 const base=fixture(),a=clone(base),b=clone(base);deleteIncomeSource(a,'bonus','gift');b.incomeSources.push({id:'rental',name:'Rent'});let merged=mergeStates(base,a,b);assert.equal(merged.income[0].source,'gift');assert.equal(merged.incomeSources.some(s=>s.id==='bonus'),false);assert.equal(merged.incomeSources.some(s=>s.id==='rental'),true);
 b.income.push(record('new-bonus'));assert.throws(()=>mergeStates(base,a,b),SyncConflict);
});
test('custom source and income persist offline and sync together without leaking to other accounts',async()=>{
 const rows=new Map(),store={async readRecord(key){return clone(rows.get(key));},async writeRecord(key,value){rows.set(key,clone(value));}};let offline=true,online=null;
 const remote={async read(){if(offline)throw new Error('Offline');return clone(online);},async write(state,revision){online={state:clone(state),revision:revision+1};return clone(online);}};
 let repo=new SyncRepository({store,remote,userId:'alice'}),state=await repo.load();state.incomeSources.push({id:'rental',name:'Rent'});state.income.push(record('rent','rental'));await repo.save(state);assert.ok((await repo.sync()).error);repo.close();repo=new SyncRepository({store,remote,userId:'alice'});assert.equal((await repo.load()).incomeSources.at(-1).name,'Rent');const other=new SyncRepository({store,remote,userId:'bob'});assert.equal((await other.load()).incomeSources.some(s=>s.id==='rental'),false);offline=false;await repo.sync();assert.equal(online.state.income.at(-1).source,'rental');assert.equal(online.state.incomeSources.at(-1).name,'Rent');assert.equal((await repo.record()).pending,null);repo.close();other.close();
});
