// Index once per state/period. Searching reuses sorted rows and normalized text.
export function indexHistory(rows,categories){
 const names=new Map(categories.map(c=>[c.id,c.name]));
 return rows.map(t=>({transaction:t,text:[t.description,t.note,names.get(t.categoryId)||''].join(' ').toLocaleLowerCase()}))
  .sort((a,b)=>b.transaction.date.localeCompare(a.transaction.date)||String(b.transaction.createdAt||'').localeCompare(String(a.transaction.createdAt||'')));
}
export function historyPage(index,{search='',category='',limit=60}={}){
 const query=search.trim().toLocaleLowerCase(),groups=new Map();let count=0,total=0;
 for(const {transaction:t,text} of index){
  if((category&&t.categoryId!==category)||(query&&!text.includes(query)))continue;
  count++;total+=t.amount;
  let group=groups.get(t.date);if(!group){group={date:t.date,total:0,rows:[]};groups.set(t.date,group);}
  group.total+=t.amount;if(count<=limit)group.rows.push(t);
 }
 return {count,total,shown:Math.min(count,limit),groups:[...groups.values()].filter(g=>g.rows.length)};
}
