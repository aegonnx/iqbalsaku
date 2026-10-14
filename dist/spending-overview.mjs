import {localDate} from './model.mjs';

// Explain recorded totals without guessing which individual purchases were necessary.
export function spendingOverview(state,m,{format,today=localDate()}){
 const phase=today<m.range.start?'future':today>=m.range.end?'past':'current';
 const elapsedShare=m.elapsed/m.range.days;
 const canComparePace=phase==='current'&&m.elapsed>=3&&m.daysLeft>0&&!m.summary&&!m.rows.some(t=>t.date>today)&&!m.incomeRows.some(t=>t.date>today);
 const isAhead=ratio=>canComparePace&&ratio>=.25&&ratio>elapsedShare+.1;
 const overallAhead=m.spendable>0&&isAhead(m.spent/m.spendable);
 const pct=n=>Math.round(n*100)+'%';
 const sentences=[];
 let tone=m.available>0&&m.remaining<0?'over':'normal';
 if(phase==='past')sentences.push('This budget period has ended.');
 if(phase==='future')sentences.push('This budget period has not started yet; these figures reflect the records already entered for it.');
 if(m.available<=0){
  sentences.push('You have '+format(m.spent)+' in recorded expenses, but no starting budget or extra income is recorded for this period. Set a starting budget to see how much room you have for spending.');
  tone='caution';
 }else if(m.remaining<0){
  sentences.push('Your recorded expenses and emergency reserve exceed the available funds by '+format(-m.remaining)+'. There is no remaining spending buffer in this plan.');
 }else if(m.spendable<=0){
  sentences.push('All '+format(m.available)+' of your available money is reserved for emergencies, leaving no room for additional spending in this plan.');
  tone='caution';
 }else{
  sentences.push('You have recorded '+format(m.spent)+' in expenses, using '+pct(m.spent/m.spendable)+' of your spendable money and leaving '+format(m.remaining)+(phase==='current'&&m.daysLeft?' for the remaining '+m.daysLeft+' '+(m.daysLeft===1?'day':'days'):' for this period')+'.');
  if(overallAhead){sentences.push('With '+pct(elapsedShare)+' of the period gone, spending is ahead of an even daily pace, so the remaining balance needs extra care.');tone='caution';}
  else if(m.spent/m.spendable>=.9){sentences.push('Nearly all of your spending money is allocated to recorded expenses, so there is little room for unexpected costs.');if(tone==='normal')tone='caution';}
 }
 const concerns=state.categories.map(c=>{
  const spent=m.categories[c.id]||0,limit=m.budget.categories[c.id];
  if(limit===undefined||spent===0)return null;
  const ratio=limit>0?spent/limit:Infinity;
  const priority=spent>limit?4:spent===limit?3:isAhead(ratio)?2:ratio>=.7?1:0;
  return priority?{name:c.name,spent,limit,ratio,priority}:null;
 }).filter(Boolean).sort((a,b)=>b.priority-a.priority||b.ratio-a.ratio||b.spent-a.spent).slice(0,2);
 for(const c of concerns){
  if(c.spent>c.limit)sentences.push(c.name+' is '+format(c.spent-c.limit)+' over its category budget'+(c.limit===0?' because its allocation is zero':'')+'.');
  else if(c.spent===c.limit)sentences.push(c.name+' has used its entire '+format(c.limit)+' allocation.');
  else if(isAhead(c.ratio))sentences.push(c.name+' is using its allocation faster than an even daily pace, with '+pct(c.ratio)+' used and '+format(c.limit-c.spent)+' left.');
  else sentences.push(c.name+' has used '+pct(c.ratio)+' of its category budget, leaving '+format(c.limit-c.spent)+'.');
 }
 if(concerns.length&&tone==='normal')tone='caution';
 if(!concerns.length&&m.spent>0){
  const largest=state.categories.reduce((best,c)=>(m.categories[c.id]||0)>(m.categories[best?.id]||0)?c:best,null);
  if(largest)sentences.push(largest.name+' is your largest spending category at '+pct(m.categories[largest.id]/m.spent)+' of recorded expenses; review it first if you want to make more room in your budget.');
 }
 if(m.emergencyFunds>0&&m.spendable>0)sentences.push('Your '+format(m.emergencyFunds)+' emergency reserve is already kept outside this spending balance.');
 if(phase==='past')sentences.push('Use this spending mix to set realistic category limits for your next period.');
 else if(phase==='future')sentences.push('Plan for essentials and known bills first, then decide how much to leave for optional purchases and outings.');
 else if(m.remaining<=0||tone!=='normal')sentences.push('Put essentials and upcoming bills first. Before another optional purchase or outing, consider a lower-cost option or wait until your budget has more breathing room.');
 else sentences.push('Keep room for upcoming bills and unexpected costs before treating the remaining balance as free spending.');
 return {text:sentences.join(' '),tone};
}
