import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,validateState,metrics,parseAmount} from '../dist/model.mjs';

const expense=(id,amount=100,categoryId='makan',date='2026-10-07')=>({id,amount,categoryId,date,description:'Synthetic test expense',note:'',createdAt:'2026-10-07T00:00:00Z'});
function fixture(){const state=seedState();state.budgets['2026-10']={overall:1000,categories:{makan:500,dating:300}};return state;}
test('public build starts without personal financial records',()=>{
 const state=validateState(seedState());assert.equal(state.transactions.length,0);assert.deepEqual(state.summaries,{});assert.deepEqual(state.budgets,{});assert.equal(state.settings.defaultBudget,0);
});
test('adding, editing, moving, and deleting expenses recalculate totals',()=>{
 const state=fixture();const report=()=>metrics(state,'2026-10','2026-10-07');
 state.transactions.push(expense('test-1'));assert.equal(report().spent,100);assert.equal(report().remaining,900);assert.equal(report().categories.makan,100);
 state.transactions[0].amount=200;assert.equal(report().spent,200);
 state.transactions[0].categoryId='dating';assert.equal(report().categories.makan,0);assert.equal(report().categories.dating,200);
 state.transactions[0].date='2026-11-01';assert.equal(report().spent,0);assert.equal(metrics(state,'2026-11','2026-10-07').spent,200);
 state.transactions=[];assert.equal(report().remaining,1000);
});
test('budgets, daily recommendations, and monthly boundaries',()=>{
 const state=fixture();state.transactions.push(expense('test-1',200));
 let report=metrics(state,'2026-10','2026-10-07');assert.equal(report.daysLeft,24);assert.equal((report.budget.categories.makan-report.categories.makan)/report.daysLeft,12.5);
 state.budgets['2026-10'].overall=2000;assert.equal(metrics(state,'2026-10','2026-10-07').remaining,1800);
 assert.equal(metrics(state,'2026-09','2026-10-07').daysLeft,0);assert.equal(metrics(state,'2026-11','2026-10-07').daysLeft,30);
 state.settings.startDay=8;assert.equal(metrics(state,'2026-10','2026-10-07').spent,0);
});
test('backup restoration preserves values and rejects invalid data',()=>{
 const state=fixture();state.transactions.push(expense('test-1'));const restored=validateState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored,state);assert.deepEqual(metrics(restored,'2026-10','2026-10-07'),metrics(state,'2026-10','2026-10-07'));
 restored.transactions[0].amount=-1;assert.throws(()=>validateState(restored));assert.equal(state.transactions[0].amount,100);
});
test('shorthand amounts remain whole numeric values',()=>{
 assert.equal(parseAmount('10k'),10000);assert.equal(parseAmount('115k'),115000);assert.equal(parseAmount('2.500.000'),2500000);assert.ok(Number.isNaN(parseAmount('-10')));
});
