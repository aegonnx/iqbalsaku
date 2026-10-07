import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SyncRepository,mergeStates,SyncConflict,emptyState} from '../dist/sync.mjs';
import {metrics,validateState} from '../dist/model.mjs';
const clone=x=>structuredClone(x);
const expense=(id,amount=100,categoryId='makan',date='2026-10-07')=>({id,amount,categoryId,date,description:'Test expense',note:'',createdAt:'2026-10-07T00:00:00Z'});
class Store{constructor(){this.rows=new Map();}async readRecord(k){return clone(this.rows.get(k));}async writeRecord(k,v){this.rows.set(k,clone(v));}}
class Remote{constructor(){this.row=null;this.offline=false;}async read(){if(this.offline)throw new Error('Offline');return clone(this.row);}async write(state,revision){if(this.offline)throw new Error('Offline');if((this.row?.revision||0)!==revision)throw Object.assign(new Error('Concurrent write'),{code:'40001'});this.row={state:clone(state),revision:revision+1};return clone(this.row);}}
const make=(store,remote,userId='user-a')=>new SyncRepository({store,remote,userId});
test('independent additions merge, deletions stay deleted, conflicting edits require review',()=>{
 const base=emptyState();base.transactions=[expense('a')];const local=clone(base),online=clone(base);
 local.transactions.push(expense('b'));online.transactions.push(expense('c'));
 assert.equal(mergeStates(base,local,online).transactions.length,3);
 local.transactions=local.transactions.filter(t=>t.id!=='a');assert.equal(mergeStates(base,local,online).transactions.some(t=>t.id==='a'),false);
 const edit1=clone(base),edit2=clone(base);edit1.transactions[0].amount=200;edit2.transactions[0].amount=300;assert.throws(()=>mergeStates(base,edit1,edit2),SyncConflict);
});
test('two devices sync add edit category date budget delete and backup restore',async()=>{
 const remote=new Remote(),a=make(new Store(),remote),b=make(new Store(),remote);
 let state=await a.load();state.budgets['2026-10']={overall:1000,categories:{makan:500}};state.transactions.push(expense('a'));await a.save(state);await a.sync();await b.sync();
 assert.equal(metrics(await b.load(),'2026-10').spent,100);
 state=await b.load();state.transactions[0].amount=200;state.transactions[0].categoryId='dating';state.budgets['2026-10'].overall=2000;await b.save(state);await b.sync();await a.sync();
 assert.equal(metrics(await a.load(),'2026-10').remaining,1800);assert.equal(metrics(await a.load(),'2026-10').categories.dating,200);
 state=await a.load();state.transactions[0].date='2026-11-01';await a.save(state);await a.sync();await b.sync();assert.equal(metrics(await b.load(),'2026-10').spent,0);
 const backup=validateState(JSON.parse(JSON.stringify(await b.load())));backup.transactions.push(expense('restored',50));await b.save(backup);await b.sync();await a.sync();assert.equal((await a.load()).transactions.length,2);
 state=await a.load();state.transactions=[];await a.save(state);await a.sync();await b.sync();assert.equal((await b.load()).transactions.length,0);a.close();b.close();
});
test('offline saves survive repository reopening and reconnect',async()=>{
 const store=new Store(),remote=new Remote();remote.offline=true;let repo=make(store,remote);let state=await repo.load();state.transactions.push(expense('offline'));await repo.save(state);const result=await repo.sync();assert.match(result.error.message,/Offline/);repo.close();repo=make(store,remote);assert.equal((await repo.load()).transactions.length,1);remote.offline=false;await repo.sync();assert.equal(remote.row.state.transactions.length,1);assert.equal((await repo.record()).pending,null);repo.close();
});
test('concurrent additions retry and merge without losing either expense',async()=>{
 const remote=new Remote(),a=make(new Store(),remote),b=make(new Store(),remote);let sa=await a.load(),sb=await b.load();sa.transactions.push(expense('a'));sb.transactions.push(expense('b'));await a.save(sa);await b.save(sb);await Promise.all([a.sync(),b.sync()]);await a.sync();await b.sync();assert.equal((await a.load()).transactions.length,2);assert.equal((await b.load()).transactions.length,2);a.close();b.close();
});
test('same-field conflict retains pending copy until explicit resolution',async()=>{
 const remote=new Remote(),a=make(new Store(),remote),b=make(new Store(),remote);let sa=await a.load();sa.transactions.push(expense('a'));await a.save(sa);await a.sync();await b.sync();sa=await a.load();let sb=await b.load();sa.transactions[0].amount=200;sb.transactions[0].amount=300;await a.save(sa);await a.sync();await b.save(sb);assert.ok((await b.sync()).error instanceof SyncConflict);assert.equal((await b.load()).transactions[0].amount,300);await b.keepOnline();assert.equal((await b.load()).transactions[0].amount,200);a.close();b.close();
});
test('accounts and signed-out local data use distinct storage keys',async()=>{
 const store=new Store(),remoteA=new Remote(),remoteB=new Remote(),a=make(store,remoteA,'alice'),b=make(store,remoteB,'bob');const local=emptyState();local.transactions.push(expense('local'));await store.writeRecord('current',local);let state=await a.load();state.transactions.push(expense('alice'));await a.save(state);await a.sync();assert.equal((await b.load()).transactions.length,0);assert.equal((await store.readRecord('current')).transactions[0].id,'local');a.close();await assert.rejects(()=>a.save(state),/closed/);b.close();
});
