const CACHE='saku-shell-v31';
const ASSETS=['./','./index.html','./expenses.html','./money-plus.html','./appearance.mjs','./income.css','./income-ui.mjs','./income-model.mjs','./income-legacy.mjs','./styles.css','./design.css','./app.mjs','./ai-ui.mjs','./ai-summary.mjs','./model.mjs','./amount-input.mjs','./pull-refresh.mjs','./mobile-layout.mjs','./motion.mjs','./focus.mjs','./history.mjs','./storage.mjs','./cloud-config.mjs','./cloud.mjs','./cloud-ui.mjs','./sync.mjs','./supabase.mjs','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./fonts/outfit-latin.woff2','./fonts/work-sans-latin.woff2'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('saku-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{
  const cached=await caches.match(event.request);
  if(cached)return cached;
  if(event.request.mode!=='navigate')return Response.error();
  // Cloudflare Pages serves .html routes at their extensionless URLs too.
  const app=new URL(event.request.url).pathname.match(/\/(expenses|money-plus)(?:\.html)?\/?$/)?.[1];
  return (await caches.match(app?'./'+app+'.html':'./index.html'))||Response.error();
 }));
});
