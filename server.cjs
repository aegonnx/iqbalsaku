const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'dist');
const aiHandler=import('./functions/api/ai.js');
const quota=new Map();
const aiEnv={...process.env,AI_QUOTA:{async get(key){const entry=quota.get(key);if(!entry||entry.expires<Date.now()){quota.delete(key);return null;}return entry.value;},async put(key,value,{expirationTtl}){quota.set(key,{value,expires:Date.now()+expirationTtl*1000});}}};
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 if(req.url==='/api/ai'){
  try{const {handleAI}=await aiHandler;const request=new Request('http://'+req.headers.host+'/api/ai',{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:require('node:stream').Readable.toWeb(req),duplex:'half'})});const response=await handleAI(request,aiEnv);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());}
  catch{res.writeHead(500,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'AI is temporarily unavailable.'}));}
 }
 const raw=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(raw.pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(raw.pathname==='/')file=path.join(root,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.listen(4173,'0.0.0.0',()=>console.log('Saku is ready: http://localhost:4173'));
