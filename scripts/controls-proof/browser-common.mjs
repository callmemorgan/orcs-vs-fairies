import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

export const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git',args,{encoding:'utf8'}).trim();
const configPaths = ['package.json','package-lock.json','vite.config.ts','tsconfig.json','vitest.config.ts','index.html','editor.html'];
const scriptPaths = ['scripts/controls-proof','scripts/minimap-alerts','scripts/verify_minimap_levels.mjs'];

export async function inventory(directory) {
  const files={};
  for(const name of (await readdir(directory,{recursive:true})).sort()) {
    const path=join(directory,name),info=await stat(path);
    if(!info.isFile())continue;
    const bytes=await readFile(path);
    files[name.split(sep).join('/')]= {bytes:bytes.length,sha256:sha(bytes)};
  }
  return files;
}

export async function sourceProvenance(sourcePin) {
  assert.match(sourcePin??'',/^[0-9a-f]{40}$/,'Pass the full committed source pin');
  assert.equal(git(['rev-parse','HEAD']),sourcePin,'Checkout must remain on the requested source');
  const inputs=['src','public',...configPaths,...scriptPaths];
  assert.equal(git(['diff','HEAD','--name-only','--',...inputs]),'','Tracked source, configuration and proof scripts must match HEAD');
  const tracked=git(['ls-tree','-r','--name-only',sourcePin,'--',...inputs]).split('\n').filter(Boolean).sort();
  const actualSource=Object.keys(await inventory('src')).map(path=>`src/${path}`).sort();
  assert.deepEqual(actualSource,tracked.filter(path=>path.startsWith('src/')),'Source inventory must match Git, including untracked files');
  const actualAssets=Object.keys(await inventory('public')).map(path=>`public/${path}`).sort();
  assert.deepEqual(actualAssets,tracked.filter(path=>path.startsWith('public/')),'Public asset inventory must match Git');
  const sourceFiles={},assetFiles={},configFiles={},scriptFiles={},buildHash=createHash('sha256');
  for(const path of tracked) {
    const bytes=await readFile(path),gitBlob=git(['rev-parse',`${sourcePin}:${path}`]);
    const pinned=execFileSync('git',['cat-file','blob',gitBlob],{maxBuffer:128*1024*1024});
    assert(bytes.equals(pinned),`Source bytes differ from the pin: ${path}`);
    const item={sha256:sha(bytes),bytes:bytes.length,gitBlob};
    if(path.startsWith('src/'))sourceFiles[path]=item;
    else if(path.startsWith('public/'))assetFiles[path]=item;
    else if(path.startsWith('scripts/'))scriptFiles[path]=item;
    else configFiles[path]=item;
  }
  for(const path of actualSource.filter(path=>/\.(ts|css)$/.test(path))) {
    buildHash.update(path.slice(4));buildHash.update(await readFile(path));
  }
  return {sourcePin,buildId:buildHash.digest('hex'),sourceFiles,assetFiles,configFiles,scriptFiles};
}

async function servedBuildSnapshot(context) {
  const responses={};
  const htmlResponse=await fetch(context.base,{cache:'no-store'});
  assert.equal(htmlResponse.status,200,'Primary production HTML must be served');
  const htmlBytes=Buffer.from(await htmlResponse.arrayBuffer());
  assert.equal(sha(htmlBytes),context.compiledFiles['index.html'].sha256,'Served HTML must match the frozen compiled bytes');
  responses['index.html']={sha256:sha(htmlBytes),bytes:htmlBytes.length};
  const references=new Set(Array.from(htmlBytes.toString().matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g),match=>match[1]));
  for(const reference of references) {
    const url=new URL(reference,context.base);assert.equal(url.origin,new URL(context.base).origin);
    const path=decodeURIComponent(url.pathname.slice(1)),expected=context.compiledFiles[path];
    assert(expected,`HTML references a file outside compiled output: ${path}`);
    const response=await fetch(url,{cache:'no-store'});assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(sha(bytes),expected.sha256,`Served build bytes differ: ${path}`);
    responses[path]={sha256:sha(bytes),bytes:bytes.length};
  }
  assert(Object.keys(responses).some(path=>path.endsWith('.js')),'Discover the current entry JavaScript from primary HTML');
  return responses;
}

export async function prepareProof({base,sourcePin,outputDir,feature}) {
  assert(base,'Pass the preview URL');
  const origin=new URL(base);assert(['http:','https:'].includes(origin.protocol));
  assert(outputDir,'Pass a fresh output directory');
  const out=resolve(outputDir);
  assert(!out.includes('/docs/evidence/controls-historical-'),'Historical controls captures are immutable');
  assert(!out.includes('/docs/evidence/minimap-levels-20261001'),'Historical minimap captures are immutable');
  await mkdir(out,{recursive:true});
  const initialFiles=Object.keys(await inventory(out));
  const prerequisites=feature===81?['level-alerts-session.json','level-alerts-ids.json','fixture-validation.json']:[];
  assert(initialFiles.every(path=>prerequisites.includes(path)),'Use a fresh feature output directory; only newly generated minimap inputs may exist');
  for(const name of ['browser-proof.json','manifest.json']) {
    try{await stat(join(out,name));assert.fail(`Use a fresh output directory; ${name} already exists`);}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const provenance=await sourceProvenance(sourcePin);
  const schemaModule=resolve(process.env.OVF_PROOF_SCHEMA_MODULE??'');
  assert(process.env.OVF_PROOF_SCHEMA_MODULE,'Prepare the current-source schema module and set OVF_PROOF_SCHEMA_MODULE');
  const {proofSchema:schema}=await import(pathToFileURL(schemaModule).href);
  assert(schema&&Number.isInteger(schema.saveVersion)&&schema.saveVersion>0);
  const sourceSchema=await readFile('src/core/saves.ts','utf8');
  const sourceRules=await readFile('src/core/versions.ts','utf8');
  assert.equal(schema.saveVersion,Number(sourceSchema.match(/export const SAVE_VERSION\s*=\s*(\d+)/)?.[1]),'Schema module must be rebuilt from current source');
  assert.equal(schema.simulationRevision,sourceRules.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)/)?.[1],'Schema rules must match current source');
  const moduleManifestPath=join(resolve(process.env.OVF_PROOF_MODULES??dirname(schemaModule)),'manifest.json');
  const moduleManifest=JSON.parse(await readFile(moduleManifestPath,'utf8'));
  assert.equal(moduleManifest.sourcePin,sourcePin,'Prepared module manifest must match the source pin');
  assert.deepEqual(moduleManifest.sourceFiles,provenance.sourceFiles,'Prepared module source hashes must match the checkout');
  assert.deepEqual(moduleManifest.configFiles,provenance.configFiles,'Prepared module configuration hashes must match the checkout');
  assert.deepEqual(moduleManifest.assetFiles,provenance.assetFiles,'Prepared module asset hashes must match the checkout');
  assert.equal(moduleManifest.modules['schema.mjs']?.sha256,sha(await readFile(schemaModule)),'Schema module bytes differ from preparation');
  const distDir=resolve(process.env.OVF_PROOF_DIST??'dist');
  const compiledFiles=await inventory(distDir);
  assert(compiledFiles['index.html'],'Build the primary app into OVF_PROOF_DIST');
  const fingerprintOccurrences=[];
  for(const path of Object.keys(compiledFiles).filter(path=>path.endsWith('.js'))) {
    const body=await readFile(join(distDir,path),'utf8');
    const count=body.split(provenance.buildId).length-1;
    if(count)fingerprintOccurrences.push({path,count});
  }
  assert(fingerprintOccurrences.length,'Compiled app must contain the frozen source build ID');
  const buildManifest=JSON.parse(await readFile(join(distDir,'..','build-manifest.json'),'utf8'));
  assert.equal(buildManifest.sourcePin,sourcePin,'Build manifest must match the frozen source');
  assert.deepEqual(buildManifest.sourceFiles,provenance.sourceFiles,'Build inputs differ from the frozen source');
  assert.deepEqual(buildManifest.configFiles,provenance.configFiles,'Build configuration differs from the frozen source');
  assert.deepEqual(buildManifest.assetFiles,provenance.assetFiles,'Build assets differ from the frozen source');
  assert.deepEqual(buildManifest.compiledFiles,compiledFiles,'Compiled bytes changed after preparation');
  const context={base:origin.href,sourcePin,out,feature,schema,distDir,...provenance,provenance:{...provenance,schema,schemaModule:{path:schemaModule,sha256:sha(await readFile(schemaModule))},moduleManifestSha256:sha(await readFile(moduleManifestPath)),buildManifestSha256:sha(await readFile(join(distDir,'..','build-manifest.json'))),fingerprintOccurrences},compiledFiles,sha,servedAssets:{},responseTasks:[],observedReports:new Set()};
  context.servedBefore=await servedBuildSnapshot(context);
  await writeFile(join(out,'provenance.json'),JSON.stringify(context.provenance,null,2)+'\n');
  return context;
}

export function observePage(page,report,context) {
  for(const key of ['pageErrors','consoleErrors','failedRequests','httpErrors'])report[key]??=[];
  context.observedReports.add(report);
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('response',response=>{
    if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});
    const url=new URL(response.url());
    if(url.origin!==new URL(context.base).origin||response.status()!==200)return;
    const path=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!/\.(html|js|css)$/.test(path)||!context.compiledFiles[path])return;
    const task=(async()=>{
      const bytes=await response.body(),digest=sha(bytes),expected=context.compiledFiles[path];
      assert.equal(digest,expected.sha256,`Served bytes differ from compiled ${path}`);
      context.servedAssets[url.pathname]={path,sha256:digest,bytes:bytes.length,status:response.status()};
    })().catch(error=>report.pageErrors.push(`Asset provenance: ${error.message}`));
    context.responseTasks.push(task);
  });
}

export async function verifyBugReport(context,report) {
  assert.equal(report.versions.buildId,context.buildId,'Native application build ID differs from source');
  assert.equal(report.versions.save,context.schema.saveVersion);
  assert.equal(report.versions.simulationRevision,context.schema.simulationRevision);
  assert.equal(report.session.game.version,context.schema.saveVersion);
  context.applicationBuildVerified=true;
  return {sourcePin:context.sourcePin,buildId:context.buildId,saveVersion:report.versions.save,simulationRevision:report.versions.simulationRevision};
}

export async function finishProof(context,report) {
  await Promise.all(context.responseTasks);
  report.sourcePin=context.sourcePin;report.feature=context.feature;
  report.schema=context.schema;report.buildId=context.buildId;
  report.provenance=context.provenance;report.servedAssets=context.servedAssets;
  report.servedBefore=context.servedBefore;
  let finalError;
  try {
    const endProvenance=await sourceProvenance(context.sourcePin);
    assert.deepEqual(endProvenance.sourceFiles,context.sourceFiles,'Source changed during browser proof');
    assert.deepEqual(endProvenance.configFiles,context.configFiles,'Build configuration changed during browser proof');
    assert.deepEqual(endProvenance.assetFiles,context.assetFiles,'Public assets changed during browser proof');
    assert.deepEqual(endProvenance.scriptFiles,context.scriptFiles,'Proof scripts changed during browser proof');
    assert.deepEqual(await inventory(context.distDir),context.compiledFiles,'Compiled bytes changed during browser proof');
    report.servedAfter=await servedBuildSnapshot(context);
    assert.deepEqual(report.servedAfter,context.servedBefore,'Served build changed during browser proof');
    if(report.result==='passed') {
      for(const key of ['pageErrors','consoleErrors','failedRequests','httpErrors'])assert.deepEqual(report[key]??[],[],`${key} must be empty`);
      assert(Object.values(context.servedAssets).some(item=>item.path==='index.html'),'Capture served primary HTML bytes');
      assert(Object.values(context.servedAssets).some(item=>item.path.endsWith('.js')),'Capture served production JavaScript bytes');
      assert(context.applicationBuildVerified,'Download and check a native application bug report');
      assert(report.browserClosed,'Close the browser before finalizing proof');
    }
  } catch(error) {
    finalError=error;report.result='failed';
    report.finalizationFailure={message:error.message,stack:error.stack};
  }
  await writeFile(join(context.out,'browser-proof.json'),JSON.stringify(report,null,2)+'\n');
  const artifacts=await inventory(context.out);
  for(const name of Object.keys(artifacts))if(name==='manifest.json'||name.endsWith('.log'))delete artifacts[name];
  await writeFile(join(context.out,'manifest.json'),JSON.stringify({sourcePin:context.sourcePin,feature:context.feature,schema:context.schema,buildId:context.buildId,sourceFiles:context.sourceFiles,assetFiles:context.assetFiles,configFiles:context.configFiles,scriptFiles:context.scriptFiles,compiledFiles:context.compiledFiles,servedAssets:context.servedAssets,artifacts,logs:'Finalize logs after verifier and owned preview have exited.'},null,2)+'\n');
  if(finalError)throw finalError;
}
