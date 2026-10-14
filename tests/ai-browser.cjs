const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(launchOptions),dist=path.resolve(__dirname,'../dist');
 try{for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  let requests=0;const errors=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='ai.test')return route.abort();
   if(url.pathname==='/api/ai'){requests++;const body=route.request().postDataJSON();assert.equal(body.summary.remaining,0);assert.equal(body.summary.transactions,undefined);return route.fulfill({json:{answer:'<script>unsafe()</script>\nTry setting a monthly budget.'}});}
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/design.css"></head><body><button data-action="ask-ai">Ask AI</button><script type="module">import {installAI} from '/ai-ui.mjs';import {seedState} from '/model.mjs';window.cloud={user:null,client:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}}};installAI({getState:seedState,getMonth:()=> '2026-10',cloud:window.cloud});</script></body></html>`});
   const file=path.join(dist,url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:{'.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',err=>errors.push(err.message));await page.goto('https://ai.test');await page.locator('#ai-dialog').waitFor({state:'attached'});
  await page.locator('[data-action=ask-ai]').tap();await page.locator('[data-ai-question]').first().tap();await page.locator('[name=consent]').check();await page.locator('#ai-form [type=submit]').tap();await page.getByText('Sign in in Settings to use Ask AI.').waitFor();assert.equal(requests,0);
  await page.evaluate(()=>window.cloud.user={id:'user'});await page.locator('#ai-form [type=submit]').tap();await page.locator('.ai-answer').filter({hasText:'Try setting'}).waitFor();assert.equal(requests,1);assert.equal(await page.locator('.ai-answer script').count(),0);assert.ok((await page.locator('.ai-answer').textContent()).includes('<script>'));
  const bounds=await page.locator('#ai-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=375);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(theme==='dark'){fs.mkdirSync('tmp',{recursive:true});await page.screenshot({path:'tmp/ai-preview.png'});}
  await page.locator('[data-ai-close]').tap();assert.equal(await page.locator('#ai-dialog').isVisible(),false);assert.deepEqual(errors,[]);await context.close();console.log('PASS '+theme+': sign-in, consent, suggested question, answer rendering and mobile dialog');
 }}finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
