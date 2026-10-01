import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const [repoArg,outArg]=process.argv.slice(2),repo=resolve(repoArg),out=resolve(outArg),helperPath=join(repo,'scripts/economy/browser-proof.mjs');
const {observePage,stopEconomyObservation}=await import(pathToFileURL(helperPath).href);
const {chromium}=await import('/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),html='<!doctype html><title>Bounded response body observation</title>',held=new Map();
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path.startsWith('/api/held/')){res.writeHead(200,{'content-type':'text/html','content-length':Buffer.byteLength(html)});res.write(html.slice(0,1));held.set(path,res);}else{res.writeHead(path==='/api/late-error'?503:200,{'content-type':'text/html'});res.end(html);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({headless:true}),cases=[];
try{
 for(const mode of ['original-early-close','drain-with-post-cutoff-response','already-observed-body-failure','drain-timeout','post-cutoff-http-error']){
  const page=await browser.newPage(),report={},externalResponses=[],context={base,compiledFiles:{'index.html':{sha256:sha(html),bytes:Buffer.byteLength(html)}},servedAssets:{},responseTasks:[],observedReports:new Set(),browserAssetResponses:[],browserApiResponses:[]};
  const externalListener=response=>externalResponses.push({url:response.url(),status:response.status()});page.on('response',externalListener);observePage(page,report,context);await page.goto(base);await Promise.all(context.responseTasks);
  const path='/api/held/'+mode,headers=page.waitForResponse(response=>new URL(response.url()).pathname===path);await page.evaluate(path=>{void fetch(path).then(r=>r.text()).catch(()=>{});},path);await headers;
  const pendingTasks=context.responseTasks.length,res=held.get(path);assert(res);assert.equal(context.browserApiResponses.length,0);
  if(mode==='original-early-close'){await page.close();res.destroy();await Promise.all(context.responseTasks);assert(report.pageErrors.some(error=>error.startsWith('Economy API response observation:')&&error.includes('closed')));}
  else if(mode==='drain-timeout'){await stopEconomyObservation(context,{timeoutMs:40});assert.equal(context.responseObservation.drained,false);assert(context.responseObservation.error.includes('Timed out'));await page.close();res.destroy();await Promise.all(context.responseTasks);assert(report.pageErrors.some(error=>error.includes('Timed out draining')));}
  else{
   const stopping=stopEconomyObservation(context);assert.equal(context.responseObservation.drained,false);assert(page.listeners('response').includes(externalListener));assert.equal(context.responseObservation.listenerCount,2);
   if(mode==='already-observed-body-failure'){res.destroy();}
   else{await page.evaluate(path=>fetch(path).then(r=>r.text()),mode==='post-cutoff-http-error'?'/api/late-error':'/api/late');assert.equal(context.responseTasks.length,pendingTasks);assert.equal(context.browserApiResponses.length,0);res.end(html.slice(1));}
   await stopping;assert.equal(context.responseObservation.drained,true);assert.equal(context.responseTasks.length,pendingTasks);
   if(mode==='already-observed-body-failure'){assert(report.pageErrors.some(error=>error.startsWith('Economy API response observation:')));assert.equal(context.browserApiResponses.length,0);}
   else{assert.deepEqual(report.pageErrors,[]);assert.equal(context.browserApiResponses.length,1);assert.equal(context.browserApiResponses[0].url,base.slice(0,-1)+path);assert.equal(context.browserApiResponses[0].sha256,sha(html));assert.equal(context.browserApiResponses[0].bytes,Buffer.byteLength(html));assert(externalResponses.some(item=>item.url.endsWith(mode==='post-cutoff-http-error'?'/api/late-error':'/api/late')));if(mode==='post-cutoff-http-error')assert.equal(report.httpErrors[0]?.status,503);else assert.deepEqual(report.httpErrors,[]);}
   await page.close();await Promise.all(context.responseTasks);
  }
  cases.push({mode,assertionsPassed:true,pageClosed:page.isClosed(),responseObservation:context.responseObservation??null,pageErrors:report.pageErrors,httpErrors:report.httpErrors,failedRequests:report.failedRequests,observedTaskCount:context.responseTasks.length,browserApiResponses:context.browserApiResponses,externalResponses});
 }
}finally{await browser.close();for(const res of held.values())res.destroy();await new Promise(resolve=>server.close(resolve));}
const result={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),helperPath,helperSha256:sha(await readFile(helperPath)),probeSha256:sha(await readFile(new URL(import.meta.url))),browserVersion:browser.version(),cases,passed:cases.length===5,browserClosed:!browser.isConnected(),serverClosed:!server.listening};
await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:result.passed,cases:cases.length,browserClosed:result.browserClosed,serverClosed:result.serverClosed,helperSha256:result.helperSha256}));
