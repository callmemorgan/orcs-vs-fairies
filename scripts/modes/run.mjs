import assert from 'node:assert/strict';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {preparedInputs,modeProvenance,inventory,sha} from './proof-common.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??''),port=Number(process.argv[4]??9241);
assert(process.argv[3],'Usage: node scripts/modes/run.mjs FULL_SOURCE_PIN PREPARED_ROOT [PORT]');
assert(Number.isInteger(port)&&port>=1024&&port<=65535,'Pass a local server port');
const {prepared,provenance}=await preparedInputs(sourcePin,out);
assert.equal(prepared.schema.saveVersion,4);
const runHandle=await open(join(out,'run.json'),'wx');await runHandle.close();
const logs=join(out,'logs');await mkdir(logs);
const base=`http://127.0.0.1:${port}/`,env={...process.env,
 OVF_PROOF_PIN:sourcePin,OVF_MODES_PROOF_ROOT:out,OVF_MODES_EVIDENCE:join(out,'runtime'),
 OVF_PROOF_DIST:prepared.distDir,OVF_PROOF_MODULES:prepared.modulesDir,OVF_PROOF_SCHEMA_MODULE:join(prepared.modulesDir,'schema.mjs'),
 RTS_HOST:'127.0.0.1',RTS_PORT:String(port),RTS_STATIC_DIR:prepared.distDir,RTS_DATA_DIR:join(out,'server-data'),
 RTS_ORIGIN:base.slice(0,-1),RTS_SECURE_COOKIE:'0',RTS_TRUST_PROXY:'0',
};
const report={sourcePin,schema:prepared.schema,base,outputRoot:out,startedAt:new Date().toISOString(),steps:[],result:'running',
 serverPackageFiles:prepared.serverFiles,serverDependencies:prepared.serverDependencies,method:'Fresh bundled natural matches; owned canonical main server and production browser controls; complete native session replay and continuation.'};
const persist=()=>writeFile(join(out,'run.json'),JSON.stringify(report,null,2)+'\n');
let activeChild,cancelSignal;
const checkCancellation=()=>assert(!cancelSignal,`Proof interrupted by ${cancelSignal}`);
const interrupt=signal=>{
 cancelSignal??=signal;report.interrupted=cancelSignal;
 if(activeChild&&activeChild.exitCode===null&&activeChild.signalCode===null) {
  const child=activeChild;child.kill('SIGTERM');
  const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},30000);timer.unref();child.once('exit',()=>clearTimeout(timer));
 }
};
const interruptHandlers=Object.fromEntries(['SIGINT','SIGTERM'].map(signal=>[signal,()=>interrupt(signal)]));
for(const [signal,handler] of Object.entries(interruptHandlers))process.on(signal,handler);
async function command(name,args) {
 checkCancellation();
 const handle=await open(join(logs,`${name}.log`),'wx'),step={name,args,startedAt:new Date().toISOString(),result:'running'};
 report.steps.push(step);await persist();
 try {const child=spawn(process.execPath,args,{env,stdio:['ignore',handle.fd,handle.fd]});activeChild=child;
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(`${name} received ${signal}`)):resolve(code));});
  assert.equal(code,0,`${name} failed; inspect ${join(logs,`${name}.log`)}`);step.result='passed';
 } catch(error){step.result='failed';step.failure={message:error.message};throw error;}
 finally{activeChild=undefined;step.finishedAt=new Date().toISOString();await handle.close();await persist();}
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,serverLog,failure,serverSpawnError;
try {
 await persist();
 await command('natural-matches',[join(prepared.modulesDir,'verify-runtime.mjs')]);
 checkCancellation();
 const listeners=execFileSync('ss',['-ltn',`( sport = :${port} )`],{encoding:'utf8'}).trim();
 assert(!listeners.split('\n').slice(1).some(Boolean),'Choose an unused proof server port');
 serverLog=await open(join(logs,'server.log'),'wx');
 const bundle=join(prepared.serverDir,'rts-server.js');
 report.server={bundle,bundleSha256:sha(await readFile(bundle)),port};
 assert.equal(report.server.bundleSha256,prepared.serverFiles['rts-server.js'].sha256);
 server=spawn(process.execPath,[bundle],{env,stdio:['ignore',serverLog.fd,serverLog.fd]});
 server.on('error',error=>{serverSpawnError=error;report.server.spawnError=error.message;});report.server.pid=server.pid;await persist();
 let ready=false;
 for(let attempt=0;attempt<80;attempt++) {
  checkCancellation();
  if(serverSpawnError)throw serverSpawnError;
  assert(server.exitCode===null&&server.signalCode===null,'Owned server exited before readiness');
  try {if((await fetch(base)).status===200){ready=true;break;}}catch{}
  await pause(250);
 }
 assert(ready,'Owned proof server did not become ready');
 assert(server.exitCode===null&&server.signalCode===null,'Owned server must remain alive after readiness');
 await command('main-browser',['scripts/verify_assembled_modes.mjs',base,sourcePin,join(out,'browser')]);
 for(const name of ['local-custom-hill.session','local-build-report.session'])await command(`native-${name}`,
  [join(prepared.modulesDir,'verify-native.mjs'),join(out,'browser',`${name}.json`),join(out,'native',`${name}.verification.json`),sourcePin]);
 checkCancellation();
 assert(server.exitCode===null&&server.signalCode===null&&!serverSpawnError,'Owned server must remain alive until planned shutdown');
 report.server.aliveBeforePlannedShutdown=true;
 report.result='passed';
} catch(error){failure=error;report.result='failed';report.failure={message:error.message,stack:error.stack};}
finally {
 if(server?.pid&&server.exitCode===null&&server.signalCode===null) {
  const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');
  await Promise.race([exited,pause(5000)]);
  if(server.exitCode===null&&server.signalCode===null){server.kill('SIGKILL');await exited;}
 }
 await serverLog?.close();report.serverClosed=!server||Boolean(serverSpawnError)||server.exitCode!==null||server.signalCode!==null;
 if(server){report.server.exitCode=server.exitCode;report.server.signal=server.signalCode;}
 if(cancelSignal){failure??=new Error(`Proof interrupted by ${cancelSignal}`);report.result='failed';}
 try {
  if(server) {report.listenersAfter=execFileSync('ss',['-ltnp',`( sport = :${port} )`],{encoding:'utf8'}).trim();assert(!report.listenersAfter.split('\n').slice(1).some(Boolean),'Proof server listener remains after cleanup');}
  assert(report.serverClosed);
  if(report.result==='passed')assert.equal(server.exitCode,0,'Owned canonical server must exit cleanly after planned shutdown');
  assert.deepEqual(await modeProvenance(sourcePin),provenance,'Frozen source or proof scripts changed during the run');
  await preparedInputs(sourcePin,out);
 } catch(error){failure??=error;report.result='failed';report.cleanupFailure={message:error.message};}
 report.finishedAt=new Date().toISOString();await persist();
 const artifacts=await inventory(out);
 for(const path of Object.keys(artifacts))if(path==='final-manifest.json'||path==='final-hashes.tsv')delete artifacts[path];
 await writeFile(join(out,'final-manifest.json'),JSON.stringify({...provenance,schema:prepared.schema,result:report.result,serverClosed:report.serverClosed,artifacts},null,2)+'\n');
 await writeFile(join(out,'final-hashes.tsv'),'sha256\tbytes\tpath\n'+Object.entries(artifacts).map(([path,item])=>`${item.sha256}\t${item.bytes}\t${path}\n`).join(''));
 console.log(JSON.stringify({result:report.result,sourcePin,out,steps:report.steps.length,serverClosed:report.serverClosed}));
 for(const [signal,handler] of Object.entries(interruptHandlers))process.removeListener(signal,handler);
}
if(failure)throw failure;
