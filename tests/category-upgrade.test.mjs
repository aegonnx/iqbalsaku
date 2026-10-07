import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,upgradeState,metrics} from '../dist/model.mjs';
import {ExpenseRepository} from '../dist/storage.mjs';
import {SyncRepository} from '../dist/sync.mjs';

function legacy(){
 const state=seedState();delete state.categoryDefaultsVersion;
 state.categories=state.categories.filter(c=>c.id!=='snack');
 state.budgets['2026-10']={overall:2500000,categories:{makan:800000}};
 state.transactions=[{id:'breakfast',amount:10000,categoryId:'makan',date:'2026-10-07',description:'Snack',note:''}];
 return state;
}
test('Snack upgrades existing data without changing expenses, budgets, or the original copy',()=>{
 const before=legacy(),snapshot=structuredClone(before),after=upgradeState(before);
 assert.ok(seedState().categories.some(c=>c.id==='snack'));
 assert.equal(after.categories.filter(c=>c.name==='Snack').length,1);
 assert.deepEqual(after.transactions,before.transactions);
 assert.deepEqual(after.budgets,before.budgets);
 assert.equal(metrics(after,'2026-10').spent,10000);
 assert.equal(metrics(after,'2026-10').categories.makan,10000);
 assert.equal(metrics(after,'2026-10').categories.snack,0);
 assert.deepEqual(before,snapshot);
 assert.deepEqual(upgradeState(after),after);
});
test('custom Snack categories are preserved, and renamed or deleted defaults stay that way',()=>{
 const old=legacy();old.categories.push({id:'my-snack',name:'sNaCk',icon:'grid',color:'#123456'});
 const custom=upgradeState(old);assert.equal(custom.categories.filter(c=>c.name.toLowerCase()==='snack').length,1);
 assert.equal(custom.categories.at(-1).id,'my-snack');
 const renamed=upgradeState(legacy());renamed.categories.find(c=>c.id==='snack').name='Jajan';
 assert.deepEqual(upgradeState(renamed),renamed);
 const deleted=upgradeState(legacy());deleted.categories=deleted.categories.filter(c=>c.id!=='snack');
 assert.deepEqual(upgradeState(deleted),deleted);
});
test('local backup restoration saves the upgrade and preserves later category deletion',async()=>{
 const repo=new ExpenseRepository(),records=new Map();
 repo.readRecord=async key=>structuredClone(records.get(key));
 repo.writeRecord=async(key,state)=>records.set(key,structuredClone(state));
 await repo.save(legacy());let state=await repo.load();
 assert.equal(state.categories.some(c=>c.id==='snack'),true);
 state.categories=state.categories.filter(c=>c.id!=='snack');await repo.save(state);
 assert.equal((await repo.load()).categories.some(c=>c.id==='snack'),false);
 assert.equal((await repo.load()).transactions[0].amount,10000);
});
test('online upgrade preserves the cloud baseline and merges a concurrent expense edit',async()=>{
 const base=legacy(),records=new Map([['cloud:user',{base,revision:1,pending:null}]]);
 const store={readRecord:async key=>structuredClone(records.get(key)),writeRecord:async(key,value)=>records.set(key,structuredClone(value))};
 let online=structuredClone(base);online.transactions[0].amount=20000;
 const remote={read:async()=>({state:structuredClone(online),revision:2}),write:async(state,revision)=>{assert.equal(revision,2);online=structuredClone(state);return {state,revision:3};}};
 const repo=new SyncRepository({store,remote,userId:'user'});
 const state=await repo.load();assert.equal(state.categories.some(c=>c.id==='snack'),true);
 assert.deepEqual((await repo.record()).base,base);
 await repo.save(state);await repo.sync();repo.close();
 assert.equal(online.categories.some(c=>c.id==='snack'),true);
 assert.equal(online.transactions[0].amount,20000);
});
