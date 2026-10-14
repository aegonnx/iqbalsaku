import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,metrics} from '../dist/model.mjs';
import {spendingOverview} from '../dist/spending-overview.mjs';

const today='2026-10-14';
const format=value=>'Rp'+new Intl.NumberFormat('id-ID').format(value);
const expense=(id,amount,categoryId='dating',date='2026-10-10')=>({id,amount,categoryId,date,description:'Synthetic expense',note:'',createdAt:date+'T00:00:00Z'});
function fixture(){
 const state=seedState();
 state.budgets['2026-10']={overall:1000000,categories:{dating:200000}};
 return state;
}
function overview(state,month='2026-10'){
 return spendingOverview(state,metrics(state,month,today),{format,today});
}
const noLivePace=text=>assert.doesNotMatch(text,/ahead of|faster|days left|from tomorrow/i);

test('category spending can need caution before reaching 70% of its limit',()=>{
 const state=fixture();state.transactions=[expense('dating-pace',116000)];
 const result=overview(state);
 assert.equal(result.tone,'caution');assert.match(result.text,/Dating/);assert.match(result.text,/faster/i);
 assert.ok(result.text.includes(format(84000)));
});

test('overall overview compares recorded spending with elapsed budget-period time',()=>{
 const state=fixture();state.transactions=[expense('overall-pace',600000,'makan')];
 const result=overview(state);
 assert.equal(result.tone,'caution');assert.match(result.text,/ahead of/i);
 assert.ok(result.text.includes(format(400000)));
});

test('completed periods explain the final outcome without current-period advice',()=>{
 const state=fixture();state.budgets['2026-09']={overall:1000000,categories:{}};
 state.transactions=[expense('closed-period',1200000,'makan','2026-09-10')];
 const result=overview(state,'2026-09');
 assert.equal(result.tone,'over');assert.match(result.text,/ended|finished|closed|completed/i);
 assert.ok(result.text.includes(format(200000)));noLivePace(result.text);
 assert.doesNotMatch(result.text,/rest of (?:this|the) (?:month|period)|pause .*purchases/i);
});

test('future periods do not invent a spending pace',()=>{
 const state=fixture();state.budgets['2026-11']={overall:1000000,categories:{dating:200000}};
 state.transactions=[expense('future-period',100000,'dating','2026-11-01')];
 const result=overview(state,'2026-11');
 assert.match(result.text,/not started|hasn.t started|future|upcoming|begins/i);noLivePace(result.text);
});

test('undated monthly summaries do not support elapsed-period pace claims',()=>{
 const state=fixture();state.summaries['2026-10']={total:600000,categories:{dating:160000,makan:440000}};
 const result=overview(state);
 assert.ok(result.text.includes(format(600000)));
 assert.doesNotMatch(result.text,/ahead of|faster/i);
});

test('future-dated expenses suppress unsupported elapsed-period pace claims',()=>{
 const state=fixture();state.transactions=[expense('future-expense',600000,'dating','2026-10-20')];
 const result=overview(state);
 assert.doesNotMatch(result.text,/ahead of|faster/i);
 assert.doesNotMatch(result.text,/NaN|Infinity/);
});

test('missing available funds asks for a budget instead of claiming a healthy pace',()=>{
 const state=seedState();state.transactions=[expense('without-budget',100000)];
 const result=overview(state);
 assert.match(result.text,/set|add|choose|budget|available/i);
 assert.doesNotMatch(result.text,/ahead of|faster|on track|NaN|Infinity/i);
});

test('remaining funds in the paragraph exclude the emergency reserve',()=>{
 const state=fixture();state.budgets['2026-10'].emergencyFunds=250000;
 state.transactions=[expense('reserved-funds',100000,'makan')];
 const result=overview(state);
 assert.ok(result.text.includes(format(650000)));assert.ok(!result.text.includes(format(900000)));
});

test('an explicit zero category limit remains a spending warning',()=>{
 const state=fixture();state.budgets['2026-10'].categories.dating=0;
 state.transactions=[expense('zero-limit',100000)];
 const result=overview(state);
 assert.equal(result.tone,'caution');assert.match(result.text,/Dating/);assert.match(result.text,/over|limit|unbudgeted|allocation/i);
 assert.doesNotMatch(result.text,/NaN|Infinity/);
});

test('custom category names remain literal text for the renderer to escape',()=>{
 const state=fixture(),label='<em>Dating & plans</em>';
 state.categories.find(category=>category.id==='dating').name=label;
 state.transactions=[expense('custom-category',116000)];
 const result=overview(state);
 assert.ok(result.text.includes(label));assert.ok(!result.text.includes('&lt;em&gt;'));
 assert.equal(typeof result.text,'string');assert.equal(result.tone,'caution');
});
