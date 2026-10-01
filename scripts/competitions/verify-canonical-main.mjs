import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import { resolve, join, relative, dirname } from 'node:path';
import { finished } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run from the canonical checkout. This harness uses the packaged entry and the real Vite app.
// node scripts/competitions/verify-canonical-main.mjs NEW_OUTPUT_DIRECTORY
// The native browser driver is the fixed sibling verify-canonical-browser.mjs.
const execute=promisify(execFile),cwd=process.cwd();
const output=resolve(process.argv[2]??`work/competitions/native-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const browserModule=fileURLToPath(new URL('./verify-canonical-browser.mjs',import.meta.url));
const serverDirectory=join(output,'server'),browserDirectory=join(output,'browser'),dataDirectory=join(output,'data');
const checks=[],cleanupErrors=[],contexts=new Set(),openUploads=new Set();
let browser,server,base,serverGeneration=0,browserSummary,outputCreated=false,campaignRuntimePresent=false;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(resolvePause=>setTimeout(resolvePause,ms));
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} exceeded ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);}}
function pass(name,evidence){checks.push(evidence===undefined?{name}:{name,evidence});console.log(`PASS ${name}`);}

async function sourceSnapshot(){
  const [{stdout:head},{stdout:state},{stdout:listed}]=await Promise.all([
    execute('git',['rev-parse','HEAD'],{cwd}),
    execute('git',['status','--porcelain'],{cwd}),
    execute('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd,maxBuffer:8*1024*1024})
  ]);
  const paths=[...new Set(listed.split('\0').filter(file=>/^(src\/|scripts\/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|vite\.config\.|index\.html$|Dockerfile\.server$|\.dockerignore$)/.test(file)))].sort();
  const files={},digest=createHash('sha256');
  for(const file of paths){const bytes=await readFile(join(cwd,file));files[file]={sha256:hash(bytes),bytes:bytes.length};digest.update(file).update('\0').update(bytes).update('\0');}
  return {head:head.trim(),workingTree:state.trim(),sha256:digest.digest('hex'),files};
}
async function packageSnapshot(directory){
  const files={};
  async function walk(folder){for(const item of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(folder,item.name);if(item.isDirectory())await walk(path);else if(item.isFile()){const bytes=await readFile(path);files[relative(directory,path)]={sha256:hash(bytes),bytes:bytes.length};}}}
  await walk(directory);return files;
}
async function run(command,args,label){
  const log=createWriteStream(join(output,`${label}.log`)),child=spawn(command,args,{cwd,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  let status;
  const closed=new Promise((resolveExit,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolveExit({code,signal}));});
  try{status=await bounded(closed,180000,label);}
  catch(error){child.kill('SIGKILL');await bounded(closed,5000,`${label} cleanup`).catch(()=>{});throw error;}
  finally{log.end();await finished(log);}
  assert.equal(status.code,0,`${label} failed (${status.code??status.signal}); inspect ${label}.log`);
}
async function launchServer(port=0){
  const generation=++serverGeneration,log=createWriteStream(join(output,`server-${generation}.log`));
  const child=spawn(process.execPath,[join(serverDirectory,'rts-server.js')],{
    cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,RTS_HOST:'127.0.0.1',RTS_PORT:String(port),RTS_DATA_DIR:dataDirectory,RTS_STATIC_DIR:browserDirectory,RTS_ORIGIN:'',RTS_SECURE_COOKIE:'0',RTS_TRUST_PROXY:'0',RTS_SPECTATOR_DELAY_SECONDS:'0'}
  });
  let text='',resolveAddress,rejectAddress;
  const address=new Promise((resolveReady,rejectReady)=>{resolveAddress=resolveReady;rejectAddress=rejectReady;});
  const exited=new Promise(resolveExit=>{child.once('close',(code,signal)=>{log.end();rejectAddress(new Error(`Packaged server exited during startup (${code??signal})`));resolveExit({code,signal});});child.once('error',error=>{log.end();rejectAddress(error);resolveExit({code:null,error:error.message});});});
  child.stdout.on('data',chunk=>{log.write(chunk);text=(text+chunk.toString()).slice(-16384);const match=/Orcs vs Fairies authoritative server: (http:\/\/127\.0\.0\.1:\d+)/.exec(text);if(match)resolveAddress(match[1]);});
  child.stderr.on('data',chunk=>log.write(chunk));
  server={child,exited,log};base=await bounded(address,15000,'packaged server startup');
  const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);return response.json();
}
async function stopServer(){
  if(!server)return;const current=server;server=undefined;
  if(current.child.exitCode===null&&current.child.signalCode===null)current.child.kill('SIGTERM');
  let status;
  try{status=await bounded(current.exited,10000,'graceful server shutdown');}
  catch(error){current.child.kill('SIGKILL');await bounded(current.exited,5000,'forced server shutdown').catch(()=>{});throw error;}
  finally{await finished(current.log);}
  assert.equal(status.code,0,`Packaged server did not exit gracefully (${status.code??status.signal??status.error})`);
}
async function newContext(cookies){const context=await browser.newContext();contexts.add(context);if(cookies)await context.addCookies(cookies);return context;}
async function closeContext(context){contexts.delete(context);await context.close();}
async function request(context,path,body,origin){
  // Playwright sends data:string as raw bytes; JSON objects are serialized once.
  const options={timeout:30000,failOnStatusCode:false,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(origin===undefined?{}:{Origin:origin})},...(body===undefined?{}:{data:body})};
  const response=body===undefined?await context.request.get(`${base}${path}`,options):await context.request.post(`${base}${path}`,options);
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`${path} returned unreadable JSON (${response.status()}): ${text.slice(0,200)}`);}
  const result={status:response.status(),data,headers:response.headers()};await response.dispose();return result;
}
function beginUpload(cookie){
  let settled=false,resolveResponse,rejectResponse;
  const response=new Promise((resolveReply,rejectReply)=>{resolveResponse=resolveReply;rejectResponse=rejectReply;});
  const req=http.request(new URL('/api/cosmetics/campaign-victory',base),{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',rejectResponse);res.once('end',()=>{settled=true;try{resolveResponse({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){rejectResponse(error);}});
  });
  req.on('error',error=>{if(!settled)rejectResponse(error);});
  const flushed=new Promise((resolveFlushed,rejectFlushed)=>req.write('{',error=>error?rejectFlushed(error):resolveFlushed()));
  const upload={req,response,flushed,destroy(){settled=true;req.destroy();openUploads.delete(upload);}};openUploads.add(upload);return upload;
}
async function checkUploadAdmission(host,guest){
  const cookies=await Promise.all([host.cookies(base),guest.cookies(base)]),headers=cookies.map(items=>items.map(item=>`${item.name}=${item.value}`).join('; '));
  const first=beginUpload(headers[0]);let second;
  try{
    await first.flushed;await pause(20);
    assert.equal((await request(host,'/api/health')).status,200);
    second=beginUpload(headers[1]);await second.flushed;
    const denied=await bounded(second.response,2000,'unbuffered second campaign upload');
    assert.equal(denied.status,503);assert.match(denied.data.error,/verification is busy/i);
    second.destroy();
    first.req.end('"missionId":"orcs-4","recording":{}}');
    const unavailable=await bounded(first.response,10000,'first admitted campaign upload');
    const expectedStatus=campaignRuntimePresent?400:503;
    assert.equal(unavailable.status,expectedStatus);if(!campaignRuntimePresent)assert.match(unavailable.data.error,/unavailable/i);
    const retry=await request(host,'/api/cosmetics/campaign-victory',{missionId:'orcs-4',recording:{}});
    assert.equal(retry.status,expectedStatus);if(!campaignRuntimePresent)assert.match(retry.data.error,/unavailable/i);
    pass('one global campaign admission rejects a different account before its partial body completes',{firstAccountBytesBeforeCompletion:1,secondAccountBytesBeforeResponse:1,status:denied.status,firstStatus:unavailable.status,retryStatus:retry.status});
  }finally{first.destroy();second?.destroy();}
}

let source,browserModuleEvidence,serverPackage,browserPackage,protocolVersion,failure;
try{
  const helperBytes=await readFile(browserModule);browserModuleEvidence={path:browserModule,sha256:hash(helperBytes),bytes:helperBytes.length};
  const {verifyBrowser}=await import(pathToFileURL(browserModule).href);assert.equal(typeof verifyBrowser,'function','Browser helper must export verifyBrowser');
  source=await sourceSnapshot();
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});outputCreated=true;await mkdir(dataDirectory);
  await run('npm',['run','build','--','--outDir',browserDirectory,'--emptyOutDir'],'vite-build');
  await run(process.execPath,['scripts/build-server.mjs',serverDirectory],'server-build');
  assert.equal((await stat(join(serverDirectory,'rts-server.js'))).isFile(),true);
  assert.equal((await stat(join(serverDirectory,'canonical-campaign.mjs'))).isFile(),true);
  campaignRuntimePresent=Boolean(await stat(join(serverDirectory,'campaign-runtime.mjs')).catch(error=>{if(error.code==='ENOENT')return null;throw error;}));
  await symlink(resolve(cwd,'node_modules'),join(serverDirectory,'node_modules'),'dir');
  serverPackage=await packageSnapshot(serverDirectory);browserPackage=await packageSnapshot(browserDirectory);
  assert.equal((await sourceSnapshot()).sha256,source.sha256,'Canonical source changed during the build');
  const health=await launchServer();protocolVersion=health.protocolVersion;
  const playwrightModule=process.env.OVF_PLAYWRIGHT_MODULE??createRequire(join(cwd,'package.json')).resolve('playwright');
  const {chromium}=await import(playwrightModule);browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  const protocolSource=await readFile(join(cwd,'src/online/protocol.ts'),'utf8');assert.equal(protocolVersion,Number(/PROTOCOL_VERSION\s*=\s*(\d+)/.exec(protocolSource)?.[1]));
  pass('actual Vite app and packaged server entry start with the canonical campaign adapter',{protocolVersion,serverFiles:Object.keys(serverPackage)});
  const anonymous=await newContext(),host=await newContext(),guest=await newContext();
  for(const [path,body]of [['/api/cosmetics',undefined],['/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout:{banner:null,decoration:null,portrait:null}}],['/api/challenges/daily/start',{}],['/api/cosmetics/campaign-victory',{missionId:'orcs-4',recording:{}}]])assert.equal((await request(anonymous,path,body)).status,401);
  pass('anonymous inventory, equipment, daily-start and campaign mutations require an account');
  const suffix=Date.now().toString(36);
  for(const [label,context]of [['Host',host],['Guest',guest]])assert.equal((await request(context,'/api/auth/register',{username:`Http${label}${suffix}`,password:'native-http-proof-password'})).status,200);
  const initialProfiles=await Promise.all([host,guest].map(async context=>(await request(context,'/api/cosmetics')).data.profile));
  for(const [path,body]of [['/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout:{banner:null,decoration:null,portrait:null}}],['/api/challenges/daily/start',{}],['/api/cosmetics/campaign-victory',{missionId:'orcs-4',recording:{}}]])assert.equal((await request(host,path,body,'https://disallowed.invalid')).status,403);
  pass('mutations with a disallowed Origin fail before inventory or match writes');
  assert.equal((await request(anonymous,'/api/auth/register',JSON.stringify({username:'OversizedAccount',password:'x'.repeat(64*1024)}))).status,413);
  pass('account JSON bodies larger than 64 KiB return HTTP 413');
  assert.equal((await request(host,'/api/cosmetics/campaign-victory',JSON.stringify({missionId:'orcs-4',recording:{padding:'x'.repeat(20*1024*1024)}}))).status,413);
  pass('campaign JSON bodies larger than 20 MiB return HTTP 413');
  const unavailable=await request(host,'/api/cosmetics/campaign-victory',{missionId:'orcs-4',recording:{}});
  assert.equal(unavailable.status,campaignRuntimePresent?400:503);if(!campaignRuntimePresent)assert.match(unavailable.data.error,/unavailable/i);
  pass(campaignRuntimePresent?'packaged canonical runtime rejects an empty recording with HTTP 400':'packaged canonical adapter returns HTTP 503 while its trusted scenario runtime is absent');
  await checkUploadAdmission(host,guest);
  assert.deepEqual(await Promise.all([host,guest].map(async context=>(await request(context,'/api/cosmetics')).data.profile)),initialProfiles);
  pass('rejected requests and unavailable campaigns leave both account inventories unchanged');
  await Promise.all([anonymous,host,guest].map(closeContext));
  const result=await verifyBrowser({browser,base,output,protocolVersion,checks,request});
  assert.ok(result?.restartCookies?.host?.length&&result?.restartCookies?.guest?.length,'Browser helper must return in-memory host and guest cookies for restart proof');
  assert.ok(result.profiles?.host&&result.profiles?.guest,'Browser helper must return the final authoritative profiles');
  const {restartCookies,...serializable}=result;browserSummary=serializable;
  const inventoryBeforeRestart={};
  for(const label of ['host','guest']){const context=await newContext(restartCookies[label]);try{const response=await request(context,'/api/cosmetics');assert.equal(response.status,200);assert.deepEqual(response.data.profile,result.profiles[label]);inventoryBeforeRestart[label]=response.data.profile;}finally{await closeContext(context);}}
  assert.ok(inventoryBeforeRestart.host.owned.length>0,'Native browser play must earn cosmetics before the restart proof');
  const port=Number(new URL(base).port);await stopServer();const restarted=await launchServer(port);assert.equal(restarted.protocolVersion,protocolVersion);
  for(const label of ['host','guest']){const context=await newContext(restartCookies[label]);try{const response=await request(context,'/api/cosmetics');assert.equal(response.status,200);assert.deepEqual(response.data.profile,inventoryBeforeRestart[label]);}finally{await closeContext(context);}}
  pass('native earned inventory and equipped choices survive a graceful packaged-server restart',{profiles:inventoryBeforeRestart});
  assert.equal((await sourceSnapshot()).sha256,source.sha256,'Canonical source changed during verification');
  assert.equal(hash(await readFile(browserModule)),browserModuleEvidence.sha256,'Browser helper changed during verification');
}catch(error){failure=error;}
finally{
  for(const upload of openUploads)upload.destroy();
  for(const context of contexts)await context.close().catch(error=>cleanupErrors.push(error.message));contexts.clear();
  await browser?.close().catch(error=>cleanupErrors.push(error.message));
  await stopServer().catch(error=>cleanupErrors.push(error.message));
  if(!failure&&cleanupErrors.length)failure=new Error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
  if(outputCreated)await writeFile(join(output,'result.json'),JSON.stringify({status:failure?'failed':'passed',generatedAt:new Date().toISOString(),cwd,output,source,browserModule:browserModuleEvidence,serverPackage,browserPackage,protocolVersion,campaignRuntimePresent,checks,browser:browserSummary,cleanupErrors,...(failure?{error:failure.stack??String(failure)}:{}),method:'Build and launch the canonical packaged server entry and actual Vite game. Use independent authenticated HTTP clients, partial native HTTP uploads, native browser UI and captured game WebSockets. Restart the same packaged entry and durable data directory. No imported server factory, synthetic campaign verifier, injected winner or inventory award.'},null,2));
}
if(failure)throw failure;
console.log(`Evidence: ${join(output,'result.json')}`);
