import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {sourceProvenance,inventory,sha} from './browser-common.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??''),port=Number(process.argv[4]??5195);
assert(process.argv[3],'Pass the prepared fresh output root');
assert(Number.isInteger(port)&&port>=1024&&port<=65535,'Pass a local preview port');
const prepared=JSON.parse(await readFile(join(out,'prepare.json'),'utf8'));
assert.equal(prepared.sourcePin,sourcePin);
assert.equal(prepared.schema.saveVersion,4,'Run the combined proof on SAVE4');
const provenance=await sourceProvenance(sourcePin);
assert.deepEqual(prepared.sourceFiles,provenance.sourceFiles);
assert.deepEqual(prepared.configFiles,provenance.configFiles);
assert.deepEqual(prepared.assetFiles,provenance.assetFiles);
assert.deepEqual(prepared.scriptFiles,provenance.scriptFiles);
assert.equal(prepared.moduleManifestSha256,sha(await readFile(join(prepared.modulesDir,'manifest.json'))));
assert.equal(prepared.buildManifestSha256,sha(await readFile(join(out,'build-manifest.json'))));
const moduleManifest=JSON.parse(await readFile(join(prepared.modulesDir,'manifest.json'),'utf8'));
const moduleFiles=await inventory(prepared.modulesDir);delete moduleFiles['manifest.json'];
assert.deepEqual(moduleFiles,moduleManifest.modules,'Prepared module bytes differ from the frozen bundle manifest');
const buildManifest=JSON.parse(await readFile(join(out,'build-manifest.json'),'utf8'));
assert.deepEqual(await inventory(prepared.distDir),buildManifest.compiledFiles,'Prepared compiled bytes differ from the build manifest');
try{await readFile(join(out,'run.json'));assert.fail('Refusing to reuse a prior proof run');}
catch(error){if(error.code!=='ENOENT')throw error;}
const base=`http://127.0.0.1:${port}/`,logs=join(out,'logs');await mkdir(logs,{recursive:true});
const env={...process.env,OVF_PROOF_DIST:prepared.distDir,OVF_PROOF_MODULES:prepared.modulesDir,
  OVF_PROOF_SCHEMA_MODULE:join(prepared.modulesDir,'schema.mjs'),OVF_PROOF_PIN:sourcePin,
  OVF_PROOF_MOUNTED_OUTPUT:join(out,'mounted'),OVF_PROOF_TEST_OUTPUT:join(out,'current-tests')};
const report={sourcePin,schema:prepared.schema,base,outputRoot:out,startedAt:new Date().toISOString(),steps:[],result:'running'};
const persist=()=>writeFile(join(out,'run.json'),JSON.stringify(report,null,2)+'\n');

async function command(name,args,extra={}) {
  const handle=await open(join(logs,`${name}.log`),'wx');
  const step={name,args,startedAt:new Date().toISOString(),result:'running'};
  report.steps.push(step);await persist();
  let code;
  try {
    const child=spawn(process.execPath,args,{env,...extra,stdio:['ignore',handle.fd,handle.fd]});
    code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(`${name} received ${signal}`)):resolve(code));});
    assert.equal(code,0,`${name} failed; inspect ${join(logs,`${name}.log`)}`);
    step.result='passed';
  } catch(error) {step.result='failed';step.failure={message:error.message,code};throw error;}
  finally {step.finishedAt=new Date().toISOString();await handle.close();await persist();}
}

let preview,previewLog,failure;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  await persist();
  await mkdir(env.OVF_PROOF_MOUNTED_OUTPUT,{recursive:true});
  await mkdir(env.OVF_PROOF_TEST_OUTPUT,{recursive:true});
  await command('mounted',['node_modules/vitest/vitest.mjs','run','--config','scripts/controls-proof/mounted.vitest.config.ts','--configLoader','runner']);
  await command('current-controls',['node_modules/vitest/vitest.mjs','run','--config','scripts/controls-proof/canonical.vitest.config.ts','--configLoader','runner']);
  previewLog=await open(join(logs,'preview.log'),'wx');
  const initialListeners=execFileSync('ss',['-ltn',`( sport = :${port} )`],{encoding:'utf8'}).trim();
  assert(!initialListeners.split('\n').slice(1).some(Boolean),'Choose an unused preview port');
  preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',prepared.distDir],{env,stdio:['ignore',previewLog.fd,previewLog.fd]});
  report.preview={pid:preview.pid,port,distDir:prepared.distDir};await persist();
  let ready=false;
  for(let attempt=0;attempt<60;attempt++) {
    assert(preview.exitCode===null,'Owned preview exited before readiness');
    try {const response=await fetch(base);if(response.status===200){ready=true;break;}}
    catch {}
    await pause(250);
  }
  assert(ready,'Owned preview did not become ready');
  assert(preview.exitCode===null&&preview.signalCode===null,'Owned preview must remain alive after readiness');
  const drivers=[['display','scripts/controls-proof/display.mjs'],['gamepad','scripts/controls-proof/gamepad.mjs'],['saves','scripts/controls-proof/saves.mjs'],['minimap','scripts/verify_minimap_levels.mjs']];
  for(const [feature,script] of drivers)await command(feature,[script,base,sourcePin,join(out,feature)]);
  const downloads={
    display:['native-display-final.json'],
    gamepad:['gamepad-native-session.json'],
    saves:['native-manual.json','native-loaded.json','native-after-rejected-import.json','native-before-pagehide.json','native-pagehide-autosave.json','native-recovered-autosave.json','native-imported-fresh-browser.json'],
    minimap:['native-imported.json','native-final.json'],
  };
  for(const [feature,names] of Object.entries(downloads))for(const name of names) {
    const path=join(out,feature,name),target=join(out,feature,`${name.slice(0,-5)}-verification.json`);
    const args=[join(prepared.modulesDir,'verify-native.mjs'),path,target,sourcePin];
    if(feature==='gamepad')args.push(join(out,'gamepad','browser-proof.json'));
    await command(`native-${feature}-${name.slice(0,-5)}`,args);
  }
  report.result='passed';
} catch(error) {failure=error;report.result='failed';report.failure={message:error.message,stack:error.stack};}
finally {
  if(preview&&preview.exitCode===null) {
    const exited=new Promise(resolve=>preview.once('exit',resolve));preview.kill('SIGTERM');
    await Promise.race([exited,pause(5000)]);
    if(preview.exitCode===null&&preview.signalCode===null){preview.kill('SIGKILL');await exited;}
  }
  await previewLog?.close();
  report.previewClosed=!preview||preview.exitCode!==null||preview.signalCode!==null;
  try {
    report.listenersAfter=execFileSync('ss',['-ltnp',`( sport = :${port} )`],{encoding:'utf8'}).trim();
    assert(!report.listenersAfter.split('\n').slice(1).some(Boolean),'A listener remains on the owned preview port');
    assert(report.previewClosed,'Owned preview did not close');
    assert.deepEqual(await sourceProvenance(sourcePin),provenance,'Frozen source/configuration/scripts changed during the run');
    const finalModuleFiles=await inventory(prepared.modulesDir);delete finalModuleFiles['manifest.json'];
    assert.deepEqual(finalModuleFiles,moduleFiles,'Executed module bytes changed during the run');
    assert.deepEqual(await inventory(prepared.distDir),buildManifest.compiledFiles,'Compiled bytes changed during the run');
  } catch(error) {failure??=error;report.result='failed';report.cleanupFailure={message:error.message};}
  report.finishedAt=new Date().toISOString();await persist();
  const artifacts=await inventory(out);
  for(const name of Object.keys(artifacts))if(name==='final-manifest.json'||name==='final-hashes.tsv'||name.includes('/cache/')||name.includes('/.vite/'))delete artifacts[name];
  const finalManifest={sourcePin,schema:prepared.schema,result:report.result,previewClosed:report.previewClosed,...provenance,artifacts};
  await writeFile(join(out,'final-manifest.json'),JSON.stringify(finalManifest,null,2)+'\n');
  await writeFile(join(out,'final-hashes.tsv'),'sha256\tbytes\tpath\n'+Object.entries(artifacts).map(([path,entry])=>`${entry.sha256}\t${entry.bytes}\t${path}\n`).join(''));
  console.log(JSON.stringify({result:report.result,sourcePin,out,steps:report.steps.length,previewClosed:report.previewClosed}));
}
if(failure)throw failure;
