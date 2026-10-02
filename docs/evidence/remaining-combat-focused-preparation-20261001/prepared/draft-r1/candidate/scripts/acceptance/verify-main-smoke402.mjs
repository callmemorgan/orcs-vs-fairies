import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAssetBytes, assertSessionIdentity, comparePersisted, digest, fingerprints, freshArtifact, htmlAssets, regularFiles, safePath } from './native-contract.mjs';
import { createNativeContext } from './native-context.mjs';
import { assertAcceptanceFreeze, captureAcceptanceFreeze } from './main-smoke-freeze.mjs';
import { loadPinnedHelper } from './helper-provenance.mjs';
import { runCanonicalTacticsSmoke, runRemainingCanonicalTacticsSmoke } from './canonical-main-smoke.mjs';
import { runRuinCoverMainSmoke } from './ruin-cover-main-smoke.mjs';

const entry=fileURLToPath(import.meta.url);
if(process.argv[2]==='--freeze') {
  const [,,,rootArg,fixturesArg,outputArg,pin]=process.argv;
  assert(rootArg&&fixturesArg&&outputArg&&pin,'Use --freeze ROOT FIXTURES NEW_CONTRACT FULL_SOURCE_COMMIT');
  const root=resolve(rootArg),fixtures=resolve(fixturesArg),output=resolve(outputArg);
  assert.equal(entry,resolve(root,'scripts/acceptance/verify-main-smoke402.mjs'));
  assert(output!==fixtures&&!output.startsWith(`${fixtures}${sep}`),'Freeze receipt is outside fixtures');
  const frozen=await captureAcceptanceFreeze(root,fixtures,pin);
  await writeFile(output,`${JSON.stringify(frozen,null,2)}\n`,{flag:'wx'});
  console.log(`Sealed focused main smoke at ${pin}, SAVE${frozen.source.saveVersion}, rules ${frozen.source.simulationRevision}`);process.exit(0);
}

const [, , baseArg,rootArg,outArg,fixturesArg,freezeArg,helperArg,groupsArg]=process.argv;
assert(baseArg&&rootArg&&outArg&&fixturesArg&&freezeArg&&helperArg,'Use BASE ROOT NEW_EVIDENCE FIXTURES FREEZE AUDIT_BUNDLE [canonical,remaining-combat,ruins]');
const base=baseArg,root=resolve(rootArg),out=resolve(outArg),fixtures=resolve(fixturesArg),freezePath=resolve(freezeArg);
assert.equal(entry,resolve(root,'scripts/acceptance/verify-main-smoke402.mjs'),'Execute browser runner from pinned checkout');
assert(out!==fixtures&&!out.startsWith(`${fixtures}${sep}`),'Evidence output is outside frozen fixtures');
await freshArtifact(out);await mkdir(out,{recursive:true});
const freezeBytes=await readFile(freezePath),frozen=JSON.parse(freezeBytes.toString());
await assertAcceptanceFreeze(root,fixtures,frozen);
const identity={saveVersion:frozen.source.saveVersion,simulationRevision:frozen.source.simulationRevision};
const manifest=JSON.parse(await readFile(resolve(fixtures,'manifest.json'),'utf8'));
const {module:helper,provenance:helperProvenance}=await loadPinnedHelper(root,frozen.source.commit,helperArg,'scripts/acceptance/native-audit.ts');
assert.equal(typeof helper.observeNative,'function');
const runners={canonical:runCanonicalTacticsSmoke,'remaining-combat':runRemainingCanonicalTacticsSmoke,ruins:runRuinCoverMainSmoke};
const groups=(groupsArg??'canonical,ruins').split(',');
assert(groups.length&&new Set(groups).size===groups.length&&groups.every(group=>Object.hasOwn(runners,group)),'Select known unique acceptance groups');
const distHtml=await readFile(resolve(root,'dist/index.html')),declaredAssets=htmlAssets(distHtml.toString(),base);
const evidence={schema:1,completed:false,base,startedAt:new Date().toISOString(),setup:manifest.setup,selectedGroups:groups,source:{...frozen.source,sealedContractSha256:digest(freezeBytes),executedRunnerSha256:digest(await readFile(entry)),distHtmlSha256:digest(distHtml)},helper:helperProvenance,checks:[],downloads:{},servedAssets:[],assetFailures:[],errors:[],groups:{}};
const receiptPath=resolve(out,'browser-main-smoke402.json');
await writeFile(receiptPath,`${JSON.stringify(evidence,null,2)}\n`,{flag:'wx'});
await writeFile(resolve(out,'native-observer-helper-provenance.json'),`${JSON.stringify(helperProvenance,null,2)}\n`,{flag:'wx'});
let browser,context,page,ctx,phase='launch production browser';
try {
  const playwrightModule=process.env.OVF_PLAYWRIGHT_MODULE??'playwright';
  const {chromium}=await import(playwrightModule);
  browser=await chromium.launch({headless:true,...(process.env.OVF_CHROMIUM_EXECUTABLE?{executablePath:process.env.OVF_CHROMIUM_EXECUTABLE}:{}),args:['--disable-dev-shm-usage']});
  evidence.browser={playwrightModule,browserVersion:browser.version(),executablePath:process.env.OVF_CHROMIUM_EXECUTABLE??chromium.executablePath()};
  context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true,serviceWorkers:'block'});
  page=await context.newPage();page.on('pageerror',error=>evidence.errors.push(error.message));
  const origin=new URL(base).origin,pinnedAssets=new Map(frozen.dist.map(file=>[file.path,file])),capturedAssets=new Set(),assetPromises=[];
  const executableResponse=response=>{
    const type=response.request().resourceType(),url=new URL(response.url()),mime=(response.headers()['content-type']??'').split(';')[0].trim().toLowerCase();
    return ['script','stylesheet'].includes(type)||/\.(js|css)$/.test(url.pathname)||['application/javascript','text/javascript','application/ecmascript','text/ecmascript','text/css'].includes(mime);
  };
  const captureAsset=response=>{
    if(!executableResponse(response))return;
    assetPromises.push((async()=>{
      const url=new URL(response.url()),type=response.request().resourceType();
      assert.equal(url.origin,origin,`Observed executable asset is same-origin and frozen: ${url}`);
      const path=decodeURIComponent(url.pathname).replace(/^\//,'');assert(response.ok(),`Successful asset response ${url}`);
      const bytes=await response.body();assertAssetBytes(bytes,pinnedAssets.get(path),url.href);
      assert.deepEqual(bytes,await readFile(safePath(resolve(root,'dist'),path)));
      capturedAssets.add(url.href);evidence.servedAssets.push({url:url.href,path,resourceType:type,mime:response.headers()['content-type'],bytes:bytes.length,sha256:digest(bytes)});
    })().catch(error=>evidence.assetFailures.push(String(error.stack??error))));
  };
  context.on('response',captureAsset);
  context.on('requestfailed',request=>{if(['script','stylesheet'].includes(request.resourceType())||/\.(js|css)$/.test(new URL(request.url()).pathname))evidence.assetFailures.push(`${request.url()}: ${request.failure()?.errorText??'asset request failed'}`);});
  const verifyAssets=async()=>{
    await page.waitForLoadState('networkidle',{timeout:15000});let settled=0;
    while(settled<assetPromises.length){const count=assetPromises.length;await Promise.all(assetPromises.slice(settled,count));settled=count;}
    assert.deepEqual(evidence.assetFailures,[]);for(const url of declaredAssets)assert(capturedAssets.has(url),`Observed production HTML asset ${url}`);
  };
  ctx=createNativeContext({page,out,fixtures,manifest,identity,evidence,observeNative:helper.observeNative});
  phase='open frozen production application';const response=await page.goto(base);assert(response?.ok());
  const servedHtml=await response.body();assert.deepEqual(servedHtml,distHtml);evidence.source.servedHtmlSha256=digest(servedHtml);
  await page.locator('.begin-match').click();await ctx.ready();await verifyAssets();
  const display=await page.evaluate(()=>({devicePixelRatio:window.devicePixelRatio,camera:window.rts.camera,canvas:{width:document.querySelector('#game-canvas canvas').width,height:document.querySelector('#game-canvas canvas').height,cssWidth:document.querySelector('#game-canvas canvas').getBoundingClientRect().width,cssHeight:document.querySelector('#game-canvas canvas').getBoundingClientRect().height}}));
  assert.equal(display.devicePixelRatio,1,'Pixel-insignia proof uses native density one');assert.equal(display.camera.width,display.canvas.cssWidth);assert.equal(display.camera.height,display.canvas.cssHeight);evidence.display=display;
  for(const group of groups){phase=`native ${group} encounters`;evidence.groups[group]=await runners[group](ctx)??{completed:true};await writeFile(receiptPath,`${JSON.stringify(evidence,null,2)}\n`);}
  phase='native production build identity';const checkpoint=await ctx.exportSave('acceptance-final-checkpoint');
  await ctx.openSessions('report');await ctx.sessions.getByLabel('Bug description',{exact:true}).fill(`Native production acceptance: ${groups.join(', ')}.`);
  await ctx.sessions.getByRole('button',{name:'Preview report',exact:true}).click();
  await ctx.wait(()=>!!document.querySelector('[aria-label="Report JSON preview"]')?.value);
  const report=await ctx.download('Download bug report','production-build-report.json');
  assert.equal(report.versions.buildId,frozen.source.expectedBuildId);assert.equal(report.versions.save,identity.saveVersion);
  assert.equal(report.versions.replaySimulation,identity.saveVersion);assert.equal(report.versions.replay,1);assert.equal(report.versions.simulationRevision,identity.simulationRevision);
  assertSessionIdentity(report.session,'Native build report',identity,true);comparePersisted(report.session.game,checkpoint.game,'Native build report');
  ctx.record('Native bug report confirms frozen build identity and complete current session',{buildId:report.versions.buildId,tick:report.session.game.state.tick});
  phase='final frozen bytes and retained downloads';await verifyAssets();await assertAcceptanceFreeze(root,fixtures,frozen);
  assert.deepEqual(await readFile(freezePath),freezeBytes);assert.deepEqual((await loadPinnedHelper(root,frozen.source.commit,helperArg,'scripts/acceptance/native-audit.ts')).provenance,helperProvenance,'Executing observer helper and receipt remain identical throughout browser run');
  for(const [name,fingerprint]of Object.entries(evidence.downloads))assertAssetBytes(await readFile(safePath(out,name)),fingerprint,`Retained native download ${name}`);
  assert.deepEqual(evidence.errors,[]);evidence.visualReviewRequired=true;evidence.completed=true;evidence.completedAt=new Date().toISOString();
  evidence.artifacts=await fingerprints(out,(await regularFiles(out)).filter(path=>path!=='browser-main-smoke402.json'));
  await writeFile(receiptPath,`${JSON.stringify(evidence,null,2)}\n`);console.log(`Verified ${evidence.checks.length} native acceptance assertions. Inspect the retained native histories and rendering screenshots: ${out}`);
}catch(error){
  evidence.failure={phase,message:String(error.stack??error)};
  if(ctx){try{evidence.lastState=await ctx.snap();await ctx.screenshot('native-acceptance-first-failure');}catch(captureError){evidence.failure.captureError=String(captureError.stack??captureError);}}
  await writeFile(receiptPath,`${JSON.stringify(evidence,null,2)}\n`);throw error;
}finally{
  const cleanupErrors=[];
  try{if(context)await context.close();}catch(error){cleanupErrors.push({phase:'context close',message:String(error.stack??error)});}
  finally{try{if(browser)await browser.close();}catch(error){cleanupErrors.push({phase:'browser close',message:String(error.stack??error)});}}
  evidence.cleanup={completed:cleanupErrors.length===0,errors:cleanupErrors};
  if(cleanupErrors.length){evidence.dataCompleted=evidence.completed;evidence.completed=false;}
  await writeFile(receiptPath,`${JSON.stringify(evidence,null,2)}\n`);
  if(cleanupErrors.length)throw new Error('Owned browser cleanup failed; retained cleanup errors in receipt.');
}
