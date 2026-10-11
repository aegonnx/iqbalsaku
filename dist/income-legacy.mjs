import {validateState,expenseMonth} from './model.mjs';
import {validateIncomeRecord} from './income-model.mjs';
export const LEGACY_APP='iqbal-saku-money-plus';
export function validateLegacyIncome(raw){
  if(!raw||raw.app!==LEGACY_APP||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>100000)throw new Error('Choose a valid saved income backup.');
  const ids=new Set();let total=0;
  const entries=raw.entries.map(entry=>{
    if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id)||ids.has(entry.id))throw new Error('Saved income has invalid or duplicate IDs.');
    ids.add(entry.id);
    const record=validateIncomeRecord({...entry,id:'legacy-money-plus-'+entry.id});
    total+=record.amount;if(!Number.isSafeInteger(total+1000000000000))throw new Error('Income total exceeds the supported range.');
    return record;
  });
  return entries;
}
// Stable IDs plus a durable import ledger make retrying safe, including after
// an imported record is edited or deleted. The old database is never changed.
export function consolidateIncome(current,legacy){
  const state=validateState(current),entries=validateLegacyIncome(legacy);
  const consumed=new Set([...state.legacyIncomeImports.map(r=>r.id),...state.income.map(r=>r.id)]);
  const salary=new Map();let added=0;
  for(const entry of entries){
    if(consumed.has(entry.id))continue;
    consumed.add(entry.id);state.income.push(entry);state.legacyIncomeImports.push({id:entry.id});added++;
    if(entry.source==='salary'){
      const month=expenseMonth(entry.date,state.settings.startDay);
      salary.set(month,(salary.get(month)||0)+entry.amount);
    }
  }
  let budgetsAdded=0;
  for(const [month,amount] of salary){
    // An explicitly saved budget (even zero) or the default budget already
    // represents starting funds. Imported salary is kept as a reference only.
    if(!Object.hasOwn(state.budgets,month)&&state.settings.defaultBudget===0){
      if(amount>1000000000000)throw new Error('Saved salary exceeds the supported monthly starting budget.');
      state.budgets[month]={overall:amount,categories:{}};budgetsAdded++;
    }
  }
  return {state:validateState(state),added,budgetsAdded};
}
export async function readLegacyIncome(){
  // Opening an absent database creates an empty shell only; abort that upgrade
  // so new users do not acquire a second app database.
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('saku-money-plus-v1');let absent=false;
    request.onupgradeneeded=()=>{absent=true;request.transaction.abort();};
    request.onerror=()=>absent?resolve(null):reject(request.error);
    request.onblocked=()=>reject(new Error('Close older income tabs, then retry importing saved income.'));
    request.onsuccess=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('state')){db.close();resolve(null);return;}
      const tx=db.transaction('state','readonly'),read=tx.objectStore('state').get('current');let data;
      read.onsuccess=()=>{data=read.result;};
      tx.oncomplete=()=>{db.close();resolve(data||null);};
      tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||new Error('Could not read saved income.'));};
    };
  });
}
