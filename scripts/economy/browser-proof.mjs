import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inventory,sha,prepareProof,observePage as observeSharedPage,verifyBugReport,finishProof} from '../controls-proof/browser-common.mjs';

const driverPaths=['scripts/verify_economy_ui.mjs','scripts/verify_economy_combined_ui.mjs','scripts/verify_settlement_runtime_ui.mjs'];
export async function economyScripts(sourcePin){
 const paths=execFileSync('git',['ls-tree','-r','--name-only',sourcePin,'--','scripts/economy',...driverPaths],{encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
 const actual=[...(await readdir('scripts/economy',{recursive:true})).map(path=>`scripts/economy/${path}`),...driverPaths].sort();
 // This proof directory contains source files only; added or deleted helpers invalidate the pin.
 assert.deepEqual(actual,paths,'Economy proof script paths must match the frozen Git tree.');
 const files={};
 for(const path of paths){const bytes=await readFile(path),pinned=execFileSync('git',['show',`${sourcePin}:${path}`],{maxBuffer:128*1024*1024});assert(bytes.equals(pinned),`Economy proof script differs from the pin: ${path}`);files[path]={sha256:sha(bytes),bytes:bytes.length};}
 return files;
}

async function servedInventory(context){
 const responses={};
 for(const [path,expected] of Object.entries(context.compiledFiles)){
  const url=new URL(path==='index.html'?'./':path,context.base),response=await fetch(url,{cache:'no-store'});assert.equal(response.status,200,`Compiled file is not served: ${path}`);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),expected.sha256,`Served bytes differ from the prepared build: ${path}`);assert.equal(bytes.length,expected.bytes);responses[path]={sha256:sha(bytes),bytes:bytes.length};
 }
 return responses;
}

export async function prepareEconomyProof(base,out,feature){
 const sourcePin=process.env.OVF_PRODUCTION_SOURCE_COMMIT;
 assert.match(sourcePin??'',/^[0-9a-f]{40}$/,'Pass the approved full source SHA.');
 assert.equal(Number(process.env.OVF_EXPECT_SAVE_VERSION),4,'The final economy proof requires SAVE4.');
 assert(process.env.OVF_EXPECT_SIMULATION_REVISION,'Pass the approved simulation revision.');
 const context=await prepareProof({base,sourcePin,outputDir:out,feature});
 assert.equal(context.schema.saveVersion,4);assert.equal(context.schema.simulationRevision,process.env.OVF_EXPECT_SIMULATION_REVISION);
 const scripts=await economyScripts(sourcePin),moduleBytes=await readFile(join(process.env.OVF_PROOF_MODULES,'manifest.json')),manifest=JSON.parse(moduleBytes);
 assert.deepEqual(manifest.economyScriptFiles,scripts,'Prepared economy script bytes differ from the frozen scripts.');
 const buildBytes=await readFile(join(context.distDir,'..','build-manifest.json')),build=JSON.parse(buildBytes),prepared=JSON.parse(await readFile(join(context.distDir,'..','prepare.json'),'utf8'));
 assert.equal(prepared.sourcePin,sourcePin);assert.deepEqual(prepared.schema,context.schema);assert.equal(prepared.sourceDigest,manifest.sourceDigest);
 assert.equal(prepared.modulesDir,resolve(process.env.OVF_PROOF_MODULES));assert.equal(prepared.distDir,context.distDir);
 assert.equal(prepared.moduleManifestSha256,sha(moduleBytes),'Module manifest changed after preparation.');assert.equal(prepared.buildManifestSha256,sha(buildBytes),'Build manifest changed after preparation.');
 assert.deepEqual(build.economyScriptFiles,scripts,'Prepared build script association differs.');
 const moduleFiles=await inventory(process.env.OVF_PROOF_MODULES);delete moduleFiles['manifest.json'];assert.deepEqual(moduleFiles,manifest.modules,'A prepared generator, checker or schema bundle changed.');
 context.economyScriptFiles=scripts;context.economyModuleFiles=moduleFiles;context.allServedBefore=await servedInventory(context);context.browserAssetResponses=[];context.browserApiResponses=[];
 context.preparationSha256=sha(await readFile(join(context.distDir,'..','prepare.json')));
 return context;
}

export function observePage(page,result,context){
 const priorResponseListeners=new Set(page.listeners('response'));
 observeSharedPage(page,result,context);
 page.on('response',response=>{
  const url=new URL(response.url());if(url.origin!==new URL(context.base).origin)return;
  const path=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)),expected=context.compiledFiles[path],resourceType=response.request().resourceType(),contentType=response.headers()['content-type']??'';
  if(!expected){
   if(path.startsWith('api/')&&['fetch','xhr'].includes(resourceType)){
    const task=(async()=>{const record={url:url.href,status:response.status(),resourceType,contentType};if(record.status>=300&&record.status<400){context.browserApiResponses.push({...record,sha256:null,bytes:null,bodyUnavailable:'Redirect response bodies are unavailable in Playwright.'});return;}const bytes=await response.body();context.browserApiResponses.push({...record,sha256:sha(bytes),bytes:bytes.length});})().catch(error=>result.pageErrors.push(`Economy API response observation: ${error.message}`));context.responseTasks.push(task);
   }else if(['document','script','stylesheet'].includes(resourceType)||/\.(?:html|m?js|css|wasm)$/.test(path)||/javascript|text\/css|text\/html|application\/wasm/.test(contentType))result.pageErrors.push(`Executable response is outside the prepared build: ${url.href}`);
   return;
  }
  if(response.status()!==200)return;
  const task=(async()=>{const bytes=await response.body(),digest=sha(bytes),record={url:url.href,path,status:response.status(),sha256:digest,bytes:bytes.length};context.browserAssetResponses.push(record);assert.equal(digest,expected.sha256,`Browser response differs from the prepared ${path}`);assert.equal(bytes.length,expected.bytes);context.servedAssets[url.pathname]={path,sha256:digest,bytes:bytes.length,status:response.status()};})().catch(error=>result.pageErrors.push(`Economy asset provenance: ${error.message}`));
  context.responseTasks.push(task);
 });
 context.responseObservers??=[];context.responseObservation??={startedAt:new Date().toISOString()};
 context.responseObservers.push({page,listeners:page.listeners('response').filter(listener=>!priorResponseListeners.has(listener))});
}
export async function stopEconomyObservation(context,{timeoutMs=30000}={}){
 if(context.responseObservation?.drained)return;
 const observers=context.responseObservers??[];
 for(const {page,listeners} of observers)for(const listener of listeners)page.off('response',listener);
 for(const page of new Set(observers.map(observer=>observer.page)))page.on('response',response=>{if(response.status()>=400)for(const report of context.observedReports)report.httpErrors.push({url:response.url(),status:response.status()});});
 const observedTaskCount=context.responseTasks.length;
 context.responseObservation={...context.responseObservation,endedAt:new Date().toISOString(),listenerCount:observers.reduce((count,observer)=>count+observer.listeners.length,0),observedTaskCount,timeoutMs,httpStatusesObservedThroughClose:true,drained:false};
 let timer;
 try{await Promise.race([Promise.all(context.responseTasks),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timed out draining observed response bodies.')),timeoutMs);})]);assert.equal(context.responseTasks.length,observedTaskCount,'Response tasks changed after observation ended.');context.responseObservation.drained=true;}
 catch(error){context.responseObservation.error=String(error);for(const report of context.observedReports)report.pageErrors.push(`Economy response drain: ${error.message}`);}
 finally{clearTimeout(timer);context.responseObservation.finishedAt=new Date().toISOString();}
}
export async function freshFixture(context,path){
 const prepared=JSON.parse(await readFile(join(context.distDir,'..','prepare.json'),'utf8')),bytes=await readFile(path);
 assert.equal(prepared.sourcePin,context.sourcePin);assert.equal(prepared.fixtureSha256,sha(bytes),'Use the freshly generated fixture from this preparation.');
 const file=JSON.parse(bytes);assert.equal(file.game.version,context.schema.saveVersion);return bytes;
}
export async function finishEconomyProof(context,result,recordName){
 result.result=result.passed===true?'passed':'failed';
 assert.equal(result.browserClosed,true,'Close the browser before finalizing economy evidence.');
 result.responseObservation=context.responseObservation;
 result.economyScriptFiles=context.economyScriptFiles;
 result.allServedBefore=context.allServedBefore;
 result.browserAssetResponses=context.browserAssetResponses;
 result.browserApiResponses=context.browserApiResponses;
 let failure;
 if(context.responseObservation?.drained!==true){failure=new Error('Response observation did not drain before browser close.');result.passed=false;result.result='failed';result.economyObservationError=context.responseObservation?.error??failure.message;}
 try{
  assert.deepEqual(await economyScripts(context.sourcePin),context.economyScriptFiles,'Economy scripts changed during the browser proof.');
  const modules=await inventory(process.env.OVF_PROOF_MODULES);delete modules['manifest.json'];assert.deepEqual(modules,context.economyModuleFiles,'Prepared proof modules changed during the browser proof.');
  assert.equal(sha(await readFile(join(process.env.OVF_PROOF_MODULES,'manifest.json'))),context.provenance.moduleManifestSha256,'Module manifest changed during the browser proof.');
  assert.equal(sha(await readFile(join(context.distDir,'..','build-manifest.json'))),context.provenance.buildManifestSha256,'Build manifest changed during the browser proof.');
  assert.equal(sha(await readFile(join(context.distDir,'..','prepare.json'))),context.preparationSha256,'Preparation receipt changed during the browser proof.');
  result.allServedAfter=await servedInventory(context);assert.deepEqual(result.allServedAfter,context.allServedBefore,'Served bytes changed during the browser proof.');
 }catch(error){failure=error;result.passed=false;result.result='failed';result.economyProvenanceError=String(error);}
 try{await finishProof(context,result);}catch(error){failure??=error;}
 if(result.result!=='passed')result.passed=false;
 const finalRecord=JSON.stringify(result,null,2)+'\n';await writeFile(join(context.out,'browser-proof.json'),finalRecord);await writeFile(join(context.out,recordName),finalRecord);
 const manifest=JSON.parse(await readFile(join(context.out,'manifest.json'),'utf8')),artifacts=await inventory(context.out);
 for(const name of Object.keys(artifacts))if(name==='manifest.json'||name.endsWith('.log'))delete artifacts[name];
 manifest.artifacts=artifacts;await writeFile(join(context.out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 if(failure)throw failure;
}

async function download(page,name,path){
 const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8'));
}
async function imported(page,kind){
 await page.waitForFunction(kind=>{const button=Array.from(document.querySelectorAll('button')).find(item=>item.textContent===`Import ${kind}`);return button&&!button.dataset.busy&&document.querySelector('.session-notice')?.textContent===`${kind==='save'?'Save':'Replay'} loaded.`;},kind,{timeout:60000});
}

export async function nativeSessionEquality(page,context,{saved,report}={}){
 const out=context.out;
 if(!await page.locator('.session-overlay:not([hidden])').count())await page.locator('[data-session-tool="saves"]').click();
 await page.locator('[data-session-tab="saves"]').click();
 saved??=await download(page,'Export save',join(out,'commanded-session.json'));
 if(!report){await page.locator('[data-session-tab="report"]').click();await page.getByLabel('Bug description',{exact:true}).fill('Final economy native session and replay proof');report=await download(page,'Download bug report',join(out,'report.json'));}
 await verifyBugReport(context,report);
 assert.deepEqual(saved,report.session,'Native save and report session must match in full while paused.');
 assert.equal(saved.game.version,context.schema.saveVersion);assert(saved.replay,'Native export must include recorder history.');
 assert.equal(saved.replay.initial.version,context.schema.saveVersion);assert.equal(saved.replay.checksumVersion,context.schema.saveVersion);assert.equal(saved.replay.simulationRevision,context.schema.simulationRevision);assert.equal(saved.replay.finalTick,saved.game.state.tick);
 await page.locator('[data-session-tab="saves"]').click();await page.getByLabel('Import save JSON',{exact:true}).setInputFiles({name:'commanded-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.getByRole('button',{name:'Import save',exact:true}).click();await imported(page,'save');
 const reloaded=await download(page,'Export save',join(out,'reloaded-session.json'));assert.deepEqual(reloaded.game,saved.game,'The complete native game must survive save reload.');
 await writeFile(join(out,'exported-replay.json'),JSON.stringify(saved.replay,null,2)+'\n');
 await page.locator('[data-session-tab="replay"]').click();await page.getByLabel('Import replay JSON',{exact:true}).setInputFiles(join(out,'exported-replay.json'));await page.getByRole('button',{name:'Import replay',exact:true}).click();await imported(page,'replay');
 const range=page.getByLabel('Replay tick',{exact:true});await range.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[aria-label="Replay tick"]')?.disabled);
 await range.focus();await range.press('End');await page.waitForFunction(tick=>window.rts?.state.tick===tick,saved.replay.finalTick,{timeout:60000});
 await page.waitForFunction(()=>window.rts?.art?.loaded===true,null,{timeout:60000});
 await page.locator('[data-session-tab="saves"]').click();const replayed=await download(page,'Export save',join(out,'replayed-session.json'));assert.deepEqual(replayed.game,saved.game,'The complete native replay endpoint must equal the exported game.');
 const equality={fullSaveEqualsReportSession:true,fullGameEqualsReloadExport:true,fullGameEqualsReplayExport:true,saveVersion:saved.game.version,simulationRevision:saved.replay.simulationRevision,initialTick:saved.replay.initial.state.tick,finalTick:saved.game.state.tick,gameSha256:sha(JSON.stringify(saved.game)),exports:['commanded-session.json','reloaded-session.json','replayed-session.json','exported-replay.json','report.json']};
 await writeFile(join(out,'native-session-equality.json'),JSON.stringify(equality,null,2)+'\n');
 return equality;
}
