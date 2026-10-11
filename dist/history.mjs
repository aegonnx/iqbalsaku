import {sourceName} from './income-model.mjs';
// Index once per state/period. Searching reuses sorted rows and normalized text.
const createdOrder=t=>typeof t.createdAt==='number'?(new Date(t.createdAt).toJSON()||String(t.createdAt)):String(t.createdAt||'');
export function indexHistory(rows,categories){
 const names=new Map(categories.map(c=>[c.id,c.name]));
 return rows.map(t=>({transaction:t,text:[t.description,t.title,t.note,names.get(t.categoryId)||'',t.kind==='income'?sourceName(t.source):''].join(' ').toLocaleLowerCase()}))
  .sort((a,b)=>b.transaction.date.localeCompare(a.transaction.date)||createdOrder(b.transaction).localeCompare(createdOrder(a.transaction))||a.transaction.id.localeCompare(b.transaction.id));
}
export function historyPage(index,{search='',category='',limit=60}={}){
 const query=search.trim().toLocaleLowerCase(),groups=new Map();let count=0,total=0;
 for(const {transaction:t,text} of index){
  const isIncome=t.kind==='income',reference=isIncome&&t.source==='salary';
  const categoryMatch=!category||(category==='@income'?isIncome:category==='@expense'?!isIncome:t.categoryId===category);
  if(!categoryMatch||(query&&!text.includes(query)))continue;
  count++;total+=t.amount;
  let group=groups.get(t.date);if(!group){group={date:t.date,total:0,incoming:0,outgoing:0,references:0,rows:[]};groups.set(t.date,group);}
  group.total+=t.amount;
  if(reference)group.references++;else if(isIncome)group.incoming+=t.amount;else group.outgoing+=t.amount;if(count<=limit)group.rows.push(t);
 }
 return {count,total,shown:Math.min(count,limit),groups:[...groups.values()].filter(g=>g.rows.length)};
}
