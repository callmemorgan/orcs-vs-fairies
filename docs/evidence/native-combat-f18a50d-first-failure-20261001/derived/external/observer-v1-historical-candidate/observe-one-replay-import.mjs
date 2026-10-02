import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Candidate only. Root must review and release the serial runtime slot before use.
const ROOT='/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies';
const ORIGINAL='/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5';
const PIN='f18a50d904c57ae1652f157b946ebd39d8d8923c';
const DOCS_PIN='37bf0e794e7f62cf33347d2e92c739d593bf1cc4';
const FIXED_PRODUCT_PIN='453c2218af9973b9eca8fb78392435bd9d46a740';
const EXPECTED={
  'first-failure-artifact-manifest.json':'922c604e7d17c015d878cfd4f1ce0f133df2c208ef5f7ad9ca8b0a9c2b8d9fba',
  'frozen-inputs.json':'66f880c7ef685437e56b83708c03972c47cf5cbdb8f7846b243839b613e9fc31',
  'dist-public-assets.json':'6994f890fc171dfa2f779aa0fea1d5dd7ac7f1986148f3e32f4171a13ffa79c9',
  'selected-runtime-identity.json':'230a8be04aa9a04b9a5f66f94f424b2720e076e97e312270da8bdc6c797a2b58',
  'browser/charge-stop-interrupted-replay.json':'25a6656c971a95e7b20e33dc85156601aaa6d992d39adcbae8201f16671d95f2',
};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const [, , baseArg,outputArg]=process.argv;
assert(baseArg&&outputArg,'Use BASE NEW_EXTERNAL_OUTPUT_DIRECTORY');
const base=new URL(baseArg),out=resolve(outputArg);
assert.equal(base.origin,'http://127.0.0.1:5397','Use the owned preview port after root releases the runtime slot');
assert.equal(base.pathname,'/');assert.equal(base.search,'');assert.equal(base.hash,'');
assert(out.startsWith('/tmp/')&&!out.startsWith(`${ORIGINAL}${sep}`),'Use fresh external evidence, outside the original run');
await mkdir(out,{recursive:false});
const self=fileURLToPath(import.meta.url),evidence={schema:1,kind:'one replay import readiness observation',startedAt:new Date().toISOString(),candidate:{path:self,sha256:digest(await readFile(self))},sourcePin:PIN,fixedProductPin:FIXED_PRODUCT_PIN,checkerDocsPin:DOCS_PIN,base:base.href,readyTimeoutMs:60000,replayImports:0,playbackOrSeekInputs:0,observations:[],assetResponses:[],requestFailures:[],console:[],pageErrors:[],captureErrors:[],admissions:[]};
let browser,context,page,phase='bind retained original inputs';
const assetPromises=[];
async function responseBody(response){
  let timer;
  try{return await Promise.race([response.body(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Response-body observation timed out after 15000ms: ${response.url()}`)),15000);})]);}
  finally{clearTimeout(timer);}
}
async function original(name){const bytes=await readFile(resolve(ORIGINAL,name));assert.equal(digest(bytes),EXPECTED[name],`${name} original bytes`);return JSON.parse(bytes);}
async function regularFiles(root,prefix=''){
  const files=[];
  for(const item of await readdir(resolve(root,prefix),{withFileTypes:true})){
    const path=prefix?`${prefix}/${item.name}`:item.name;
    assert(!item.isSymbolicLink(),`No symbolic link in frozen tree: ${path}`);
    if(item.isDirectory())files.push(...await regularFiles(root,path));else if(item.isFile())files.push(path);
  }
  return files.sort();
}
async function boundFile(path,expected){const bytes=await readFile(path);assert.equal(bytes.length,expected.bytes,`${path} byte count`);assert.equal(digest(bytes),expected.sha256,`${path} SHA-256`);return bytes;}
async function snapshot(label){
  const observation=await page.evaluate(label=>{
    const r=window.rts,loader=document.querySelector('.loading-battle'),canvas=document.querySelector('#game-canvas canvas');
    const predicates={loadingIndicatorHidden:!!loader?.hidden,cameraPresent:!!r?.camera,canvasPresent:!!canvas,artLoaded:r?.art?.loaded===true};
    return {label,capturedAt:new Date().toISOString(),predicates,ready:Object.values(predicates).every(Boolean),mode:r?.mode??null,tick:r?.state?.tick??null,paused:r?.paused??null,art:r?.art??null,camera:r?.camera??null,canvas:canvas?{width:canvas.width,height:canvas.height}:null,sessionNotices:[...document.querySelectorAll('.session-notice')].filter(e=>!e.hidden).map(e=>e.textContent),state:r?JSON.parse(JSON.stringify(r.state,(_key,value)=>value instanceof Set?[...value]:value instanceof Map?Object.fromEntries(value):value)):null};
  },label);
  evidence.observations.push(observation);return observation;
}
// Preserve the original predicate, polling and 60-second timeout without fallback.
async function ready(){await page.waitForFunction(()=>document.querySelector('.loading-battle')?.hidden&&!!window.rts?.camera&&!!document.querySelector('#game-canvas canvas')&&window.rts.art.loaded,null,{timeout:60000,polling:20});}
try{
  const seal=await original('first-failure-artifact-manifest.json'),freeze=await original('frozen-inputs.json'),dist=await original('dist-public-assets.json'),runtime=await original('selected-runtime-identity.json'),replay=await original('browser/charge-stop-interrupted-replay.json');
  assert.equal(seal.runtimeProofPin,PIN);assert.equal(seal.checkerDocsPin,DOCS_PIN);
  assert.equal(dist.runtimeProofPin,PIN);assert.equal(dist.checkerDocsPin,DOCS_PIN);assert.equal(dist.fixedProductPin,FIXED_PRODUCT_PIN);
  assert.equal(freeze.source.commit,PIN);assert.equal(replay.initial.version,4);assert.equal(replay.simulationRevision,'4.0.1');assert.equal(replay.initial.state.tick,0);assert.equal(replay.finalTick,70);
  assert.equal(process.env.GIT_NO_REPLACE_OBJECTS,'1');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim(),PIN);
  const sourcePaths=Object.keys(dist.files).sort();
  for(const path of sourcePaths)await boundFile(resolve(ROOT,path),dist.files[path]);
  for(const directory of ['src','public','scripts/acceptance'])assert.deepEqual((await regularFiles(resolve(ROOT,directory))).map(path=>`${directory}/${path}`),sourcePaths.filter(path=>path.startsWith(`${directory}/`)),`${directory} complete path set`);
  const distPaths=Object.keys(dist.distEvidence.actualDistFingerprints).sort();
  assert.equal(distPaths.length,398);assert.deepEqual(await regularFiles(resolve(ROOT,'dist')),distPaths,'Complete original dist path set');
  for(const path of distPaths)await boundFile(resolve(ROOT,'dist',path),dist.distEvidence.actualDistFingerprints[path]);
  for(const file of freeze.source.files)await boundFile(resolve(ROOT,file.path),file);
  const expectedRuntimeFiles=[runtime.node,runtime.playwright.module,runtime.playwright.package,runtime.chromium];
  for(const file of expectedRuntimeFiles)await boundFile(file.path,file);
  assert.equal(process.version,runtime.node.versionOutput);assert.equal(await realpath(process.execPath),await realpath(runtime.node.path));
  evidence.boundInputs={originalHashes:EXPECTED,sourceFiles:sourcePaths.length,sourceInventorySha256:digest(JSON.stringify(dist.files)),distFiles:distPaths.length,distInventorySha256:digest(JSON.stringify(dist.distEvidence.actualDistFingerprints)),node:process.version,runtime,expectedBuildId:freeze.source.expectedBuildId,replayInitialTick:replay.initial.state.tick,replayFinalTick:replay.finalTick};
  phase='launch exact selected Chromium';
  const {chromium}=await import(runtime.playwright.selectedModule);
  browser=await chromium.launch({headless:true,executablePath:runtime.chromium.path,args:['--disable-dev-shm-usage']});
  evidence.actualBrowserVersion=browser.version();assert.equal(browser.version(),'153.0.8010.12');
  context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:false,serviceWorkers:'block'});
  page=await context.newPage();
  page.on('pageerror',error=>evidence.pageErrors.push({at:new Date().toISOString(),message:error.message}));
  page.on('console',message=>{if(['warning','error'].includes(message.type()))evidence.console.push({at:new Date().toISOString(),type:message.type(),text:message.text(),location:message.location()});});
  const tracked=request=>{const url=new URL(request.url());return url.origin===base.origin&&(url.pathname.startsWith('/assets/')||['script','stylesheet','document'].includes(request.resourceType()));};
  context.on('requestfailed',request=>{if(tracked(request))evidence.requestFailures.push({at:new Date().toISOString(),phase,url:request.url(),resourceType:request.resourceType(),failure:request.failure()});});
  context.on('response',response=>{
    if(!tracked(response.request()))return;
    const observedPhase=phase;
    assetPromises.push((async()=>{
      const url=new URL(response.url()),path=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
      const record={at:new Date().toISOString(),phase:observedPhase,url:url.href,path,status:response.status(),ok:response.ok(),resourceType:response.request().resourceType(),headers:response.headers()};
      evidence.assetResponses.push(record);
      if(!response.ok())return;
      const bytes=await responseBody(response);record.bytes=bytes.length;record.sha256=digest(bytes);
      const expected=dist.distEvidence.actualDistFingerprints[path];record.frozenIdentityMatch=!!expected&&bytes.length===expected.bytes&&record.sha256===expected.sha256;
      if(path==='assets/manifest.json'){
        const filename=`runtime-manifest-response-${evidence.assetResponses.indexOf(record)}.json`;
        await writeFile(resolve(out,filename),bytes,{flag:'wx'});record.retainedBody=filename;
      }
    })().catch(error=>evidence.captureErrors.push({phase:observedPhase,message:String(error.stack??error)})));
  });
  phase='open frozen production application';
  const response=await page.goto(base.href);assert(response?.ok());
  assert.deepEqual(await response.body(),await readFile(resolve(ROOT,'dist/index.html')),'Served production HTML matches retained dist');
  await page.locator('.begin-match').click();await ready();await snapshot('initial production ready');
  phase='open replay session controls';
  await page.locator('[data-session-tool="replay"]').click();
  const sessions=page.getByRole('dialog',{name:'Session tools',exact:true});
  await sessions.waitFor({state:'visible'});await page.waitForFunction(()=>window.rts?.paused,null,{timeout:15000,polling:20});
  await sessions.getByLabel('Import replay JSON',{exact:true}).setInputFiles(resolve(ORIGINAL,'browser/charge-stop-interrupted-replay.json'));
  phase='one native failed replay import';evidence.replayImports++;
  await sessions.getByRole('button',{name:'Import replay',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Import replay JSON"]')?.files?.length===0&&[...document.querySelectorAll('.session-notice')].some(e=>!e.hidden&&e.textContent==='Replay loaded.'),null,{timeout:60000,polling:20});
  await page.waitForFunction(()=>window.rts?.mode==='replay',null,{timeout:15000,polling:20});
  await snapshot('replay mode admitted before artwork readiness');
  phase='preserved replay readiness predicate';await ready();
  const final=await snapshot('replay readiness passed without playback');
  assert.equal(final.tick,0,'No replay playback or seek input');assert.equal(final.paused,true);evidence.readinessPassed=true;
}catch(error){
  evidence.readinessPassed=false;evidence.failure={phase,message:String(error.stack??error)};
  if(page){try{await snapshot('first diagnostic failure');}catch(captureError){evidence.captureErrors.push({phase:'failure snapshot',message:String(captureError.stack??captureError)});}}
  process.exitCode=1;
}finally{
  if(page){try{await page.screenshot({path:resolve(out,'one-replay-readiness.png')});}catch(error){evidence.captureErrors.push({phase:'screenshot',message:String(error)});}}
  // Settle each observed response while its browser is alive; body reads have a 15s bound.
  // This is evidence collection, not a new readiness predicate or acceptance gate.
  await Promise.allSettled(assetPromises);
  if(browser){try{await browser.close();evidence.ownedBrowserClosed=true;}catch(error){evidence.ownedBrowserClosed=false;evidence.captureErrors.push({phase:'browser close',message:String(error)});process.exitCode=1;}}
  evidence.finishedAt=new Date().toISOString();evidence.completedObservation=true;
  await writeFile(resolve(out,'one-replay-readiness-observation.json'),`${JSON.stringify(evidence,null,2)}\n`,{flag:'wx'});
  console.log(JSON.stringify({diagnostic:true,readinessPassed:evidence.readinessPassed,replayImports:evidence.replayImports,playbackOrSeekInputs:evidence.playbackOrSeekInputs,admissions:[],receipt:resolve(out,'one-replay-readiness-observation.json')}));
}
