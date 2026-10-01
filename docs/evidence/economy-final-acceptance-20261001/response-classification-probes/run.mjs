import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
const [repoArg,outArg]=process.argv.slice(2),repo=resolve(repoArg),out=resolve(outArg);
const helperPath=join(repo,'scripts/economy/browser-proof.mjs'),{observePage}=await import(pathToFileURL(helperPath).href);
const {chromium}=await import('/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const html='<!doctype html><title>Response observer probe</title>',good='{"value":"prepared"}',bad='{"value":"changed"}';
const routes={
 '/':['text/html',html],'/api/session':['text/html',html],'/api/xhr':['text/html',html],
 '/api/javascript':['application/javascript','window.apiObservation=true;'],
 '/api/css':['text/css','body{color:black}'],'/api/status':['text/html',html,503],
 '/api/fetch-redirect':['text/html','',302,'/api/session'],
 '/api/xhr-redirect':['text/html','',302,'/api/xhr'],
 '/unknown-document':['text/html','<!doctype html><title>Unprepared document</title>'],
 '/unknown-script':['application/javascript','window.scriptProbe=true;'],
 '/unknown-module':['application/javascript','window.moduleProbe=true;export {};'],
 '/unknown-style':['text/css','body{color:rgb(1,2,3)}'],
 '/unknown-script-201':['application/javascript','window.scriptProbe201=true;',201],
 '/unknown-document-201':['text/html','<!doctype html><title>Unprepared 201 document</title>',201],
 '/unknown-style-201':['text/css','body{color:rgb(4,5,6)}',201],
 '/unknown-worker':['application/javascript',"importScripts('/unknown-worker-import');postMessage('ready');"],
 '/unknown-worker-import':['application/javascript','self.workerImported=true;'],
 '/unknown.wasm':['application/wasm','wasm probe'],
 '/known.json':['application/json',good],'/tampered.json':['application/json',bad]
};
const server=createServer((req,res)=>{const entry=routes[new URL(req.url,'http://localhost').pathname];res.writeHead(entry?.[2]??(entry?200:404),{'content-type':entry?.[0]??'text/plain','cache-control':'no-store',...(entry?.[3]?{location:entry[3]}:{})});res.end(entry?.[1]??'not found');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({headless:true}),cases=[];
const probes=[
 ['api-fetch-html','fetch',()=>fetch('/api/session').then(r=>r.text())],
 ['api-xhr-html','xhr',()=>new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET','/api/xhr');xhr.onload=()=>resolve(xhr.responseText);xhr.onerror=reject;xhr.send();})],
 ['api-fetch-js-mime','fetch',()=>fetch('/api/javascript').then(r=>r.text())],
 ['api-fetch-css-mime','fetch',()=>fetch('/api/css').then(r=>r.text())],
 ['api-fetch-redirect','fetch',()=>fetch('/api/fetch-redirect').then(r=>r.text())],
 ['api-xhr-redirect','xhr',()=>new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET','/api/xhr-redirect');xhr.onload=()=>resolve(xhr.responseText);xhr.onerror=reject;xhr.send();})],
 ['unknown-document','document',()=>new Promise(resolve=>{const f=document.createElement('iframe');f.onload=()=>resolve(true);f.src='/unknown-document';document.body.append(f);})],
 ['unknown-script','script',()=>new Promise(resolve=>{const s=document.createElement('script');s.onload=()=>resolve(window.scriptProbe);s.src='/unknown-script';document.head.append(s);})],
 ['unknown-module','script',()=>new Promise(resolve=>{const s=document.createElement('script');s.type='module';s.onload=()=>resolve(window.moduleProbe);s.src='/unknown-module';document.head.append(s);})],
 ['unknown-css','stylesheet',()=>new Promise(resolve=>{const s=document.createElement('link');s.rel='stylesheet';s.onload=()=>resolve(true);s.href='/unknown-style';document.head.append(s);})],
 ['unknown-script-201','script',()=>new Promise(resolve=>{const s=document.createElement('script');s.onload=()=>resolve(window.scriptProbe201);s.src='/unknown-script-201';document.head.append(s);})],
 ['unknown-document-201','document',()=>new Promise(resolve=>{const f=document.createElement('iframe');f.onload=()=>resolve(true);f.src='/unknown-document-201';document.body.append(f);})],
 ['unknown-css-201','stylesheet',()=>new Promise(resolve=>{const s=document.createElement('link');s.rel='stylesheet';s.onload=()=>resolve(true);s.href='/unknown-style-201';document.head.append(s);})],
 ['unknown-worker-and-import','script',()=>new Promise((resolve,reject)=>{const w=new Worker('/unknown-worker');w.onmessage=()=>{w.terminate();resolve(true);};w.onerror=reject;})],
 ['known-json-fetched','fetch',()=>fetch('/known.json').then(r=>r.text())],
 ['tampered-json-fetched','fetch',()=>fetch('/tampered.json').then(r=>r.text())],
 ['unknown-wasm-fetched','fetch',()=>fetch('/unknown.wasm').then(r=>r.text())],
 ['api-non200-observed','fetch',()=>fetch('/api/status').then(r=>r.text())]
];
try{
 for(const [name,expectedType,operation] of probes){
  const page=await browser.newPage(),result={},observed=[];
  const record=bytes=>({sha256:sha(bytes),bytes:Buffer.byteLength(bytes)});
  const context={base,compiledFiles:{'index.html':record(html),'known.json':record(good),'tampered.json':record(good)},servedAssets:{},responseTasks:[],observedReports:new Set(),browserAssetResponses:[],browserApiResponses:[]};
  page.on('response',r=>observed.push({url:r.url(),status:r.status(),resourceType:r.request().resourceType(),contentType:r.headers()['content-type']??''}));
  observePage(page,result,context);await page.goto(base);const value=await page.evaluate(operation);
  await Promise.all(context.responseTasks);await page.close();
  assert(observed.some(item=>new URL(item.url).pathname!=='/'&&item.resourceType===expectedType),name+' resource type');
  if(name.startsWith('api-')){
   assert.equal(result.pageErrors.length,0,name);assert.equal(context.browserApiResponses.length,name.endsWith('-redirect')?2:1,name);
   for(const item of context.browserApiResponses){const route=routes[new URL(item.url).pathname];if(item.status>=300&&item.status<400){assert.equal(item.sha256,null);assert.equal(item.bytes,null);assert(item.bodyUnavailable);}else{assert.equal(item.sha256,sha(route[1]));assert.equal(item.bytes,Buffer.byteLength(route[1]));}assert.equal(item.contentType,route[0]);assert.equal(item.status,route[2]??200);assert.equal(item.resourceType,expectedType);}
   assert(!Object.values(context.servedAssets).some(item=>item.path.startsWith('api/')));assert(!context.browserAssetResponses.some(item=>item.path.startsWith('api/')));
   if(name==='api-non200-observed')assert.equal(result.httpErrors[0]?.status,503);else assert.equal(result.httpErrors.length,0,name);
  }else if(name==='known-json-fetched'){assert.deepEqual(result.pageErrors,[]);assert.equal(context.servedAssets['/known.json'].sha256,sha(good));}
  else if(name==='tampered-json-fetched'){assert(result.pageErrors.some(error=>error.startsWith('Economy asset provenance: Browser response differs')));assert(!context.servedAssets['/tampered.json']);}
  else {assert(result.pageErrors.some(error=>error.startsWith('Executable response is outside the prepared build:')),name);if(name==='unknown-worker-and-import')assert.equal(result.pageErrors.filter(error=>error.startsWith('Executable response')).length,2);}
  cases.push({name,passed:true,operationResult:value,observed,pageErrors:result.pageErrors,httpErrors:result.httpErrors,browserApiResponses:context.browserApiResponses,browserAssetResponses:context.browserAssetResponses,servedAssets:context.servedAssets});
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
const result={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),helperPath,helperSha256:sha(await readFile(helperPath)),probeSha256:sha(await readFile(new URL(import.meta.url))),browserVersion:browser.version(),cases,passed:cases.length===probes.length,browserClosed:!browser.isConnected(),serverClosed:!server.listening,serviceWorkerScope:'No service-worker registration exists in the app; this page observer probe does not claim service-worker coverage.'};
await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:result.passed,cases:cases.length,browserClosed:result.browserClosed,serverClosed:result.serverClosed,helperSha256:result.helperSha256}));
