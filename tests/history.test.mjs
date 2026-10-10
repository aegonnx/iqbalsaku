import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indexHistory,historyPage} from '../dist/history.mjs';
const categories=[{id:'makan',name:'Makan'},{id:'snack',name:'Snack'}];
const rows=Array.from({length:135},(_,i)=>({id:String(i),amount:10000,categoryId:i%2?'snack':'makan',description:'Expense '+i,note:i===10?'Specific note':'',date:i<100?'2026-10-10':'2026-10-09',createdAt:String(i).padStart(3,'0')}));
test('bounded history keeps full filtered totals, order, and partial-date totals',()=>{
 const index=indexHistory(rows,categories),first=historyPage(index);
 assert.equal(first.count,135);assert.equal(first.total,1350000);assert.equal(first.shown,60);
 assert.equal(first.groups.length,1);assert.equal(first.groups[0].total,1000000);assert.equal(first.groups[0].rows[0].id,'99');
 const more=historyPage(index,{limit:120});assert.equal(more.shown,120);assert.equal(more.groups.length,2);assert.equal(more.groups[1].total,350000);
 assert.equal(historyPage(index,{limit:180}).shown,135);
 assert.equal(rows[0].id,'0');
});
test('search and category filters reuse the index and include names and notes',()=>{
 const index=indexHistory(rows,categories);
 assert.equal(historyPage(index,{search:'SNACK'}).count,67);
 assert.equal(historyPage(index,{search:'specific NOTE'}).groups[0].rows[0].id,'10');
 assert.equal(historyPage(index,{category:'makan',search:'expense 1'}).count,23);
 assert.equal(historyPage(index,{search:'missing'}).shown,0);
 const edited=structuredClone(rows);edited[0].categoryId='snack';edited[0].amount=20000;edited[0].date='2026-11-01';
 const next=historyPage(indexHistory(edited,categories),{category:'snack',limit:200});assert.equal(next.total,690000);assert.equal(next.groups[0].date,'2026-11-01');
});
