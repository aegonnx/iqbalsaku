import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyIncome,validateIncome,validateEntry,incomeMetrics,mergeIncome,incomeCSV,shiftMonth,today} from '../dist/money-plus-model.mjs';
import {amountFromInput} from '../dist/amount-input.mjs';

const entry=(id,amount,date,source='bonus')=>({id,amount,date,source,title:source==='bonus'?'Project bonus':'Salary',note:'',createdAt:1});
test('a mid-month bonus increases income without creating or modifying expense budgets',()=>{
  const state=emptyIncome();
  state.entries=[entry('salary',7000000,'2026-10-01','salary'),entry('bonus',amountFromInput('500'),'2026-10-15'),entry('previous',2000000,'2026-09-30'),entry('next',1000000,'2026-11-01')];
  const metrics=incomeMetrics(validateIncome(state),'2026-10');
  assert.equal(metrics.total,7500000);
  assert.equal(metrics.salary,7000000);
  assert.equal(metrics.extra,500000);
  assert.equal(metrics.previousTotal,2000000);
  assert.equal(metrics.lifetime,10500000);
  assert.deepEqual(metrics.entries.map(row=>row.id),['bonus','salary']);
  assert.equal('budgets' in state,false);
});
test('income validation rejects expense backups, invalid dates, duplicate IDs, and unsafe totals',()=>{
  assert.throws(()=>validateIncome({version:1,transactions:[]}),/Money Plus/);
  for(const date of ['2026-02-29','2026-04-31','1999-12-31','2101-01-01'])assert.throws(()=>validateEntry(entry('x',1000,date)),/date/);
  assert.equal(validateEntry(entry('x',1000,'2028-02-29')).date,'2028-02-29');
  assert.throws(()=>validateEntry(entry('x',0,'2026-10-15')),/amount/);
  assert.throws(()=>validateEntry(entry('x',1.5,'2026-10-15')),/amount/);
  assert.throws(()=>validateIncome({...emptyIncome(),entries:[entry('x',1000,'2026-10-15'),entry('x',2000,'2026-10-15')]}),/duplicate/);
  assert.throws(()=>validateIncome({...emptyIncome(),entries:Array.from({length:10000},(_,i)=>entry('id-'+i,1000000000000,'2026-10-15'))}),/supported range/);
});
test('repeated backups do not duplicate income; differing versions require a choice',()=>{
  const current={...emptyIncome(),entries:[entry('a',100000,'2026-10-15')]};
  const backup={...emptyIncome(),entries:[entry('a',500000,'2026-10-15'),entry('b',200000,'2026-10-16')]};
  assert.throws(()=>mergeIncome(current,backup),/Choose/);
  const kept=mergeIncome(current,backup,'current');
  assert.equal(kept.added,1);assert.equal(kept.conflicts,1);assert.equal(incomeMetrics(kept.state,'2026-10').total,300000);
  const replaced=mergeIncome(current,backup,'backup');
  assert.equal(incomeMetrics(replaced.state,'2026-10').total,700000);
  assert.equal(mergeIncome(replaced.state,backup).added,0);
  assert.equal(current.entries[0].amount,100000);
});
test('months respect year boundaries and local dates; CSV protects spreadsheet formulas',()=>{
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  assert.equal(shiftMonth('2000-01',-1),'2000-01');
  assert.equal(shiftMonth('2100-12',1),'2100-12');
  assert.equal(today(new Date(2026,9,15,23,59)),'2026-10-15');
  const state={...emptyIncome(),entries:[{...entry('a',500000,'2026-10-15'),title:'=SUM(A1)',note:'He said "yes"'}]};
  assert.match(incomeCSV(state),/"'=SUM\(A1\)"/);
  assert.match(incomeCSV(state),/"He said ""yes"""/);
  assert.match(incomeCSV(state),/"500000","IDR"/);
});
