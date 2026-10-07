import {test} from 'node:test';
import assert from 'node:assert/strict';
import {amountText,amountFromInput} from '../dist/amount-input.mjs';
import {installPullRefresh} from '../dist/pull-refresh.mjs';
test('thousand entry, full rupiah override, and exact decimal round trips',()=>{
 assert.equal(amountFromInput('500'),500000);assert.equal(amountFromInput('10'),10000);assert.equal(amountFromInput('115k'),115000);assert.equal(amountFromInput('8.001'),8001);assert.equal(amountFromInput('8,001'),8001);assert.equal(amountFromInput('Rp500000'),500000);assert.equal(amountFromInput('500000','rupiah'),500000);
 for(const value of [0,1,999,8001,123456,500000,999999999999])assert.equal(amountFromInput(amountText(value)),value);
 for(const bad of ['', '-1', 'abc', '1.0001', '1000000001'])assert.ok(Number.isNaN(amountFromInput(bad)));assert.equal(amountText(undefined),'');
});
function fixture(refresh){
 const listeners={},classes=new Set(),node={textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(k,v){this[k]=v;},remove(){}};
 const doc={createElement:()=>node,body:{append(){}},addEventListener:(e,fn)=>listeners[e]=fn,removeEventListener:e=>delete listeners[e]};
 const win={scrollY:0,setTimeout:()=>0};let blocked=false;
 installPullRefresh({refresh,document:doc,window:win,isBlocked:()=>blocked});
 const event=(x,y)=>({touches:[{clientX:x,clientY:y}],target:{closest:()=>null},cancelable:true,preventDefault(){this.prevented=true;}});
 return {listeners,node,win,block:value=>blocked=value,event};
}
test('pull refresh needs a downward threshold at the top, respects cancellation and blocked entry',async()=>{
 let calls=0;const f=fixture(async()=>calls++);const gesture=async(x,y)=>{f.listeners.touchstart(f.event(0,0));f.listeners.touchmove(f.event(x,y));await f.listeners.touchend();};
 await gesture(0,40);assert.equal(calls,0);await gesture(120,100);assert.equal(calls,0);f.win.scrollY=20;await gesture(0,120);assert.equal(calls,0);f.win.scrollY=0;f.block(true);await gesture(0,120);assert.equal(calls,0);f.block(false);
 f.listeners.touchstart(f.event(0,0));f.listeners.touchmove(f.event(0,120));f.listeners.touchcancel();await f.listeners.touchend();assert.equal(calls,0);
 await gesture(0,120);assert.equal(calls,1);assert.equal(f.node['aria-label'],'Updated');
});
test('only one refresh runs at a time and failure offers retry',async()=>{
 let finish,calls=0;const f=fixture(()=>{calls++;return new Promise(resolve=>finish=resolve);});
 f.listeners.touchstart(f.event(0,0));f.listeners.touchmove(f.event(0,120));const pending=f.listeners.touchend();f.listeners.touchstart(f.event(0,0));f.listeners.touchmove(f.event(0,120));await f.listeners.touchend();assert.equal(calls,1);finish();await pending;
 const failure=fixture(async()=>{throw new Error('Offline');});failure.listeners.touchstart(failure.event(0,0));failure.listeners.touchmove(failure.event(0,120));await failure.listeners.touchend();assert.match(failure.node['aria-label'],/retry/);
});
