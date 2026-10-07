import {seedState,validateState,upgradeState} from './model.mjs';

export function emptyState(){
 const state=seedState();
 state.transactions=[];state.summaries={};state.budgets={};state.quickExpenses=[];state.settings.defaultBudget=0;
 return state;
}

const missing=Symbol('missing');
const canonical=value=>value===missing?'missing':JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const equal=(a,b)=>canonical(a)===canonical(b);
const object=value=>value!==missing&&value!==null&&typeof value==='object'&&!Array.isArray(value);
export class SyncConflict extends Error{
 constructor(){super('Both devices changed the same information. Your changes are still saved here. Open Settings to choose which copy to keep.');this.name='SyncConflict';}
}
function merge(base,local,remote){
 if(equal(local,base))return remote;
 if(equal(remote,base)||equal(local,remote))return local;
 if(object(local)&&object(remote)&&(object(base)||base===missing)){
  const keys=new Set([...Object.keys(base===missing?{}:base),...Object.keys(local),...Object.keys(remote)]);
  return Object.fromEntries([...keys].map(key=>[key,merge(base!==missing&&Object.hasOwn(base,key)?base[key]:missing,Object.hasOwn(local,key)?local[key]:missing,Object.hasOwn(remote,key)?remote[key]:missing)]).filter(([,value])=>value!==missing));
 }
 if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)&&[base,local,remote].every(rows=>rows.every(row=>object(row)&&typeof row.id==='string'))){
  const maps=[base,local,remote].map(rows=>new Map(rows.map(row=>[row.id,row])));
  const ids=new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()]);
  const rows=new Map([...ids].map(id=>[id,merge(...maps.map(map=>map.has(id)?map.get(id):missing))]).filter(([,row])=>row!==missing));
  const shared=base.map(row=>row.id).filter(id=>maps[1].has(id)&&maps[2].has(id));
  const order=items=>items.map(row=>row.id).filter(id=>shared.includes(id));
  const localOrder=order(local),remoteOrder=order(remote),baseOrder=order(base);
  if(!equal(localOrder,baseOrder)&&!equal(remoteOrder,baseOrder)&&!equal(localOrder,remoteOrder))throw new SyncConflict();
  const primary=!equal(localOrder,baseOrder)?local:remote;
  const ordered=[...new Set([...primary.map(row=>row.id),...local.map(row=>row.id),...remote.map(row=>row.id)])];
  return ordered.filter(id=>rows.has(id)).map(id=>rows.get(id));
 }
 throw new SyncConflict();
}
export function mergeStates(base,local,remote){
 try{return validateState(merge(base,local,remote));}catch(error){if(error instanceof SyncConflict)throw error;throw new SyncConflict();}
}

export class SupabaseRemote{
 constructor(client,userId){this.client=client;this.userId=userId;}
 async read(cached){
  if(cached){
   const {data,error}=await this.client.from('expense_accounts').select('revision').eq('user_id',this.userId).maybeSingle();
   if(error)throw error;
   if(!data)return null;
   if(Number(data.revision)===cached.revision)return cached;
  }
  const {data,error}=await this.client.from('expense_accounts').select('state,revision').eq('user_id',this.userId).maybeSingle();
  if(error)throw error;
  return data?{state:validateState(data.state),revision:Number(data.revision)}:null;
 }
 async write(state,revision){
  const {data,error}=await this.client.rpc('save_expenses',{document:validateState(state),expected_revision:revision});
  if(error)throw error;
  return {state:validateState(data.state),revision:Number(data.revision)};
 }
}

export class SyncRepository{
 constructor({store,remote,userId,onChange=()=>{},onStatus=()=>{},lock=fn=>fn()}){
  this.store=store;this.remote=remote;this.key='cloud:'+userId;this.onChange=onChange;this.onStatus=onStatus;this.lock=lock;this.running=null;this.active=true;
 }
 async record(){return await this.store.readRecord(this.key)||{base:emptyState(),revision:0,pending:null};}
 async load(){const record=await this.record();return upgradeState(record.pending||record.base);}
 async save(state){
  if(!this.active)throw new Error('This account was closed. Please retry.');
  const record=await this.record();record.pending=upgradeState(state);
  await this.store.writeRecord(this.key,record);
  this.onStatus('pending');
  // The app's write lock must finish before the background sync takes it.
  setTimeout(()=>{if(this.active)this.sync();},0);
 }
 sync(){
  if(this.running)return this.running;
  this.running=this.lock(()=>this.performSync()).finally(()=>{this.running=null;});
  return this.running;
 }
 async performSync(){
  if(!this.active)return;
  this.onStatus('syncing');
  try{
   const record=await this.record();
   for(let attempt=0;attempt<3;attempt++){
    const remote=await this.remote.read({state:record.base,revision:record.revision});
    if(!this.active)return;
    if(!record.pending){
     if(remote){await this.store.writeRecord(this.key,{base:remote.state,revision:remote.revision,pending:null});if(!equal(record.base,remote.state))await this.onChange();}
     this.onStatus('synced');return;
    }
    const next=mergeStates(record.base,record.pending,remote?.state||emptyState());
    try{
     const saved=await this.remote.write(next,remote?.revision||0);
     await this.store.writeRecord(this.key,{base:saved.state,revision:saved.revision,pending:null});
     this.onStatus('synced');await this.onChange();return;
    }catch(error){if(error.code==='40001'&&attempt<2)continue;throw error;}
   }
  }catch(error){if(this.active)this.onStatus(error instanceof SyncConflict?'conflict':'pending',error);return {error};}
 }
 async keepOnline(){
  await this.sync();
  return this.lock(async()=>{
   const remote=await this.remote.read();
   if(!remote)throw new Error('No online copy is available. Your device copy is unchanged.');
   await this.store.writeRecord(this.key,{base:remote.state,revision:remote.revision,pending:null});
   this.onStatus('synced');await this.onChange();
  });
 }
 async keepDevice(){
  await this.sync();
  return this.lock(async()=>{
   const record=await this.record(),remote=await this.remote.read();
   const saved=await this.remote.write(record.pending||record.base,remote?.revision||0);
   await this.store.writeRecord(this.key,{base:saved.state,revision:saved.revision,pending:null});
   this.onStatus('synced');await this.onChange();
  });
 }
 close(){this.active=false;}
}
