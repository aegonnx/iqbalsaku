export const INCOME_SOURCES = [
  {id:'bonus',name:'Work bonus'}, {id:'freelance',name:'Freelance payment'},
  {id:'gift',name:'Gift'}, {id:'refund',name:'Refund'}, {id:'other',name:'Other income'}
];
export function sourceName(source){return source==='salary'?'Starting salary reference':INCOME_SOURCES.find(s=>s.id===source)?.name||'Income';}
export function validateIncomeRecord(raw){
  if(!raw||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(raw.id))throw new Error('Income record ID is invalid.');
  if(raw.id.startsWith('legacy-money-plus-')&&!/^legacy-money-plus-[a-zA-Z0-9_-]{1,100}$/.test(raw.id))throw new Error('Saved income record ID is invalid.');
  if(!Number.isSafeInteger(raw.amount)||raw.amount<=0||raw.amount>1000000000000)throw new Error('Enter a positive income amount, up to Rp1.000.000.000.000.');
  if(typeof raw.date!=='string'||!/^(20\d{2}|2100)-(0[1-9]|1[0-2])-\d{2}$/.test(raw.date)||new Date(raw.date+'T12:00:00Z').toJSON()?.slice(0,10)!==raw.date)throw new Error('Choose a valid date received from 2000 to 2100.');
  if(!INCOME_SOURCES.some(s=>s.id===raw.source)&&raw.source!=='salary')throw new Error('Choose an income source.');
  if(raw.source==='salary'&&!raw.id.startsWith('legacy-money-plus-'))throw new Error('Enter starting salary in the monthly budget, not as extra income.');
  if(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>160||typeof raw.note!=='string'||raw.note.length>2000||!Number.isSafeInteger(raw.createdAt)||raw.createdAt<0)throw new Error('Income details are invalid.');
  return {...raw,title:raw.title.trim(),note:raw.note.trim()};
}
export function validateIncomeFields(state){
  if(state.income===undefined)state.income=[];
  if(state.legacyIncomeImports===undefined)state.legacyIncomeImports=[];
  if(!Array.isArray(state.income)||state.income.length>100000)throw new Error('Backup income records are invalid.');
  const ids=new Set();let total=0;
  state.income=state.income.map(raw=>{const record=validateIncomeRecord(raw);if(ids.has(record.id))throw new Error('Backup has duplicate income IDs.');ids.add(record.id);total+=record.amount;if(!Number.isSafeInteger(total+1000000000000))throw new Error('Income total exceeds the supported range.');return record;});
  if(!Array.isArray(state.legacyIncomeImports)||state.legacyIncomeImports.length>100000)throw new Error('Income import history is invalid.');
  const imported=new Set();
  state.legacyIncomeImports.forEach(record=>{if(!record||typeof record.id!=='string'||!/^legacy-money-plus-[a-zA-Z0-9_-]{1,100}$/.test(record.id)||imported.has(record.id))throw new Error('Income import history is invalid.');imported.add(record.id);});
  for(const record of state.income){if(record.id.startsWith('legacy-money-plus-')&&!imported.has(record.id)){state.legacyIncomeImports.push({id:record.id});imported.add(record.id);}}
  if(state.legacyIncomeImports.length>100000)throw new Error('Income import history exceeds the supported range.');
}
