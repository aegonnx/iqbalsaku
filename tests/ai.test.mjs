import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAI} from '../functions/api/ai.js';
import {aiSummary} from '../dist/ai-summary.mjs';
import {seedState} from '../dist/model.mjs';
const request=(body={},headers={})=>new Request('https://saku.test/api/ai',{method:'POST',headers:{Origin:'https://saku.test',Authorization:'Bearer session',...headers},body:JSON.stringify(body)});
const env=()=>{const values=new Map();return {OPENROUTER_API_KEY:'server-secret',AI_QUOTA:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v)}};};
test('AI summary includes reserves and totals, excludes individual records and account information',()=>{
 const s=seedState();s.budgets['2026-10']={overall:100000,emergencyFunds:10000,categories:{}};s.transactions=[{id:'private',description:'secret merchant',note:'secret note',date:'2026-10-10',amount:20000,categoryId:'makan'}];
 const summary=aiSummary(s,'2026-10');assert.equal(summary.remaining,70000);assert.equal(summary.emergencyFunds,10000);assert.equal(summary.expenses,20000);assert.ok(!JSON.stringify(summary).includes('secret'));assert.equal(summary.transactions,undefined);
});
test('AI rejects missing setup, cross-origin requests, and invalid sessions without calling Qwen',async()=>{
 assert.equal((await handleAI(request(),{})).status,503);
 assert.equal((await handleAI(request({}, {Origin:'https://evil.test'}),env())).status,403);
 assert.equal((await handleAI(request(),env(),async()=>new Response('{}',{status:401}))).status,401);
});
test('AI bounds inputs, pins the free model, keeps credentials server-side, and enforces daily allowance',async()=>{
 const config=env();let calls=0;
 const fetcher=async(url,options)=>{if(url.includes('/auth/'))return Response.json({id:'user'});calls++;const payload=JSON.parse(options.body);assert.equal(payload.model,'qwen/qwen3.8-27b:free');assert.equal(options.headers.Authorization,'Bearer server-secret');assert.equal(payload.messages[0].role,'system');return Response.json({choices:[{message:{content:'Spend less on snacks.'}}]});};
 assert.equal((await handleAI(request({question:'x'.repeat(1001),summary:{}}),config,fetcher)).status,400);
 assert.equal((await handleAI(request({question:'x'.repeat(17000),summary:{}}),config,fetcher)).status,413);
 for(let i=0;i<5;i++){const response=await handleAI(request({question:'Help me budget',summary:{remaining:70000}}),config,fetcher);assert.equal(response.status,200);assert.deepEqual(await response.json(),{answer:'Spend less on snacks.'});}
 assert.equal((await handleAI(request({question:'More',summary:{}}),config,fetcher)).status,429);assert.equal(calls,5);
});
test('AI returns readable provider errors without exposing provider payloads or secrets',async()=>{
 const fetcher=async url=>url.includes('/auth/')?Response.json({id:'user'}):new Response('private diagnostic',{status:429});
 const response=await handleAI(request({question:'Help',summary:{}}),env(),fetcher);assert.equal(response.status,429);assert.ok(!(await response.text()).includes('private diagnostic'));
});
