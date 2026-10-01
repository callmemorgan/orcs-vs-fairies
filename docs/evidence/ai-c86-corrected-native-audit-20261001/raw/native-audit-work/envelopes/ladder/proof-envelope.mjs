import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const [sourcePin,output,...args]=process.argv.slice(2);
assert(args[0]==='--'&&args.length>1,'Usage: node proof-envelope.mjs FULL_PIN FRESH_OUTPUT -- COMMAND [ARGS]');
const command=args.slice(1),out=resolve(output??'');
assert(output,'Pass a fresh output directory');
await mkdir(dirname(out),{recursive:true});await mkdir(out);
const {sourceProvenance,inventory,sha}=await import(pathToFileURL(resolve('scripts/controls-proof/browser-common.mjs')).href);
const wrapperPath=fileURLToPath(import.meta.url),wrapperBytes=await readFile(wrapperPath);
await writeFile(join(out,'proof-envelope.mjs'),wrapperBytes);
const canonicalPaths=[
 'scripts/ladder/ladder.test.ts','scripts/ladder/report.py','scripts/ladder/README.md','vitest.ladder.config.ts',
 'scripts/ai/team-regression.test.ts','vitest.ai-team.config.ts','scripts/build-server.mjs',
 'scripts/verify_assembled_allied.mjs','scripts/verify_assembled_roster.mjs',
 'scripts/verify_assembled_coop.mjs','scripts/verify_assembled_online.mjs',
 'docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json',
].sort();
const git=(args,options={})=>execFileSync('git',args,{encoding:'utf8',...options}).trim();
async function source(){
 const shared=await sourceProvenance(sourcePin),canonicalFiles={};
 for(const path of canonicalPaths){
  const bytes=await readFile(path),gitBlob=git(['rev-parse',`${sourcePin}:${path}`]);
  const pinned=execFileSync('git',['cat-file','blob',gitBlob],{maxBuffer:128*1024*1024});
  assert(bytes.equals(pinned),`Canonical AI proof input differs from HEAD: ${path}`);
  canonicalFiles[path]={gitBlob,sha256:sha(bytes),bytes:bytes.length};
 }
 assert.equal(sha(await readFile(wrapperPath)),sha(wrapperBytes),'External wrapper bytes changed');
 return {...shared,canonicalFiles,wrapper:{path:wrapperPath,sha256:sha(wrapperBytes),bytes:wrapperBytes.length}};
}
const artifactDirectories=JSON.parse(process.env.OVF_AI_PROOF_ARTIFACTS??'[]');
assert(Array.isArray(artifactDirectories)&&artifactDirectories.every(path=>typeof path==='string'));
for(const path of artifactDirectories){
 const present=await stat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 assert(!present,`Use a fresh canonical output directory; retain prior attempts: ${path}`);
}
assert.notEqual(process.env.OVF_ALLIED_EXPLORATORY,'1','Canonical browser proofs require strict assertions');
const dist=process.env.OVF_AI_PROOF_DIST?resolve(process.env.OVF_AI_PROOF_DIST):null;
const serverDist=process.env.OVF_AI_PROOF_SERVER_DIST?resolve(process.env.OVF_AI_PROOF_SERVER_DIST):null;
const base=process.env.OVF_AI_PROOF_BASE??null;
assert(!base||dist,'A served build snapshot requires OVF_AI_PROOF_DIST');
async function served(compiled){
 if(!base)return null;
 const result={};
 for(const path of Object.keys(compiled).sort()){
  const url=new URL(path,base.endsWith('/')?base:`${base}/`);
  const response=await fetch(url,{cache:'no-store'});assert.equal(response.status,200,`Served asset ${path}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(sha(bytes),compiled[path].sha256,`Served bytes differ from compiled ${path}`);
  result[path]={url:url.href,bytes:bytes.length,sha256:sha(bytes),status:response.status};
 }
 return result;
}
const before=await source(),compiledBefore=dist?await inventory(dist):null,serverCompiledBefore=serverDist?await inventory(serverDist):null;
if(serverCompiledBefore)assert(serverCompiledBefore['rts-server.js'],'Frozen authoritative build must include rts-server.js');
async function bindBuild(envelope,directory,compiled,expectedCommand){
 assert(envelope,'Pass the preceding successful build envelope for each browser build');
 const root=resolve(envelope),manifestBytes=await readFile(join(root,'manifest.json')),manifest=JSON.parse(manifestBytes);
 assert.equal(manifest.sourcePin,sourcePin,'Preceding build envelope must use the final source pin');
 assert.equal(manifest.result,'passed','Preceding build envelope must have passed');
 for(const path of ['run.json','source-before.json','source-after.json','artifacts.json','proof-envelope.mjs'])assert(manifest.artifacts[path],`Build envelope must bind ${path}`);
 for(const [path,item] of Object.entries(manifest.artifacts)){
  const bytes=await readFile(join(root,path));assert.equal(bytes.length,item.bytes,`Build envelope byte count changed: ${path}`);assert.equal(sha(bytes),item.sha256,`Build envelope bytes changed: ${path}`);
 }
 const runBytes=await readFile(join(root,'run.json')),run=JSON.parse(runBytes);
 assert.equal(run.sourcePin,sourcePin);assert.equal(run.result,'passed');assert.equal(run.exit.code,0);
 assert.deepEqual(run.command,expectedCommand,'Use the documented fresh build command');
 for(const name of ['source-before.json','source-after.json'])assert.deepEqual(JSON.parse(await readFile(join(root,name))),before,'Browser inputs must match the inputs of the preceding successful build');
 const artifactsBytes=await readFile(join(root,'artifacts.json')),artifacts=JSON.parse(artifactsBytes);
 assert.deepEqual(artifacts[directory],compiled,'Browser bytes must match the preceding fresh build output inventory');
 return {directory,envelope:root,manifestSha256:sha(manifestBytes),runSha256:sha(runBytes),artifactsSha256:sha(artifactsBytes)};
}
async function buildBindings(){
 return {
  web:dist?await bindBuild(process.env.OVF_AI_PROOF_BUILD_ENVELOPE,process.env.OVF_AI_PROOF_DIST,compiledBefore,['npx','--no-install','vite','build','--outDir',process.env.OVF_AI_PROOF_DIST]):null,
  server:serverDist?await bindBuild(process.env.OVF_AI_PROOF_SERVER_BUILD_ENVELOPE,process.env.OVF_AI_PROOF_SERVER_DIST,serverCompiledBefore,['node','scripts/build-server.mjs',process.env.OVF_AI_PROOF_SERVER_DIST]):null,
 };
}
const bindingsBefore=await buildBindings();
if(compiledBefore){
 assert(compiledBefore['index.html'],'Frozen production build must include index.html');
 const fingerprintFiles=[];
 for(const path of Object.keys(compiledBefore).filter(path=>path.endsWith('.js'))){
  if((await readFile(join(dist,path),'utf8')).includes(before.buildId))fingerprintFiles.push(path);
 }
 assert(fingerprintFiles.length,'Compiled application must contain the current source build ID');
}
const servedBefore=await served(compiledBefore);
await writeFile(join(out,'source-before.json'),JSON.stringify(before,null,2)+'\n');
await writeFile(join(out,'build-before.json'),JSON.stringify({dist,compiledFiles:compiledBefore,serverDist,serverCompiledFiles:serverCompiledBefore,buildBindings:bindingsBefore,servedAssets:servedBefore},null,2)+'\n');
const recordedEnvironment={};
for(const [name,value] of Object.entries(process.env))if(/^(LADDER_|AI_TEAM_OUTPUT$|OVF_(?:PLAYWRIGHT_MODULE|ALLIED_EXPLORATORY|ALLIED_BROWSER_PROOF_OUTPUT|ROSTER_PROOF_DIR|COOP_PROOF_DIR|ONLINE_MAIN_PROOF_DIR|ONLINE_BUILD_LABEL|AI_PROOF_)|RTS_(?:HOST|PORT|DATA_DIR|STATIC_DIR|ORIGIN|SPECTATOR_DELAY_SECONDS)$)/.test(name))recordedEnvironment[name]=value;
const result={sourcePin,command,cwd:process.cwd(),runtime:{node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch},environment:recordedEnvironment,strictAlliedAssertions:true,startedAt:new Date().toISOString(),result:'failed',assertionScope:'A passed envelope requires unchanged pinned inputs/builds and zero command exit. Read the canonical reports and native artifacts to establish gameplay assertions.',limits:'Pins committed source/configuration/test/proof inputs and an external wrapper by exact bytes. Installed dependencies and the complete host environment are not pinned.'};
await writeFile(join(out,'run.json'),JSON.stringify(result,null,2)+'\n');
let failure;
try{
 const stdout=[],stderr=[];
 const status=await new Promise((resolve,reject)=>{
  const child=spawn(command[0],command.slice(1),{stdio:['ignore','pipe','pipe'],env:process.env});
  child.stdout.on('data',bytes=>{stdout.push(bytes);process.stdout.write(bytes);});
  child.stderr.on('data',bytes=>{stderr.push(bytes);process.stderr.write(bytes);});
  child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));
 });
 await writeFile(join(out,'stdout.log'),Buffer.concat(stdout));await writeFile(join(out,'stderr.log'),Buffer.concat(stderr));
 result.exit=status;assert.equal(status.code,0,`Canonical command failed: ${command.join(' ')}`);
 result.result='passed';
}catch(error){failure=error;result.failure={message:error.message,stack:error.stack};}
try{
 const after=await source();await writeFile(join(out,'source-after.json'),JSON.stringify(after,null,2)+'\n');
 assert.deepEqual(after,before,'Committed source/configuration/test/proof inputs changed during execution');
 const compiledAfter=dist?await inventory(dist):null,serverCompiledAfter=serverDist?await inventory(serverDist):null,servedAfter=await served(compiledAfter);
 const bindingsAfter=await buildBindings();
 await writeFile(join(out,'build-after.json'),JSON.stringify({dist,compiledFiles:compiledAfter,serverDist,serverCompiledFiles:serverCompiledAfter,buildBindings:bindingsAfter,servedAssets:servedAfter},null,2)+'\n');
 assert.deepEqual(compiledAfter,compiledBefore,'Compiled production bytes changed during execution');
 assert.deepEqual(serverCompiledAfter,serverCompiledBefore,'Compiled authoritative server bytes changed during execution');
 assert.deepEqual(servedAfter,servedBefore,'Served production bytes changed during execution');
 assert.deepEqual(bindingsAfter,bindingsBefore,'Preceding source/build envelope bytes changed during browser execution');
}catch(error){failure??=error;result.result='failed';result.finalizationFailure={message:error.message,stack:error.stack};}
const artifacts={};
for(const path of artifactDirectories){
 try{artifacts[path]=await inventory(path);}
 catch(error){failure??=error;result.result='failed';artifacts[path]={failure:error.message};}
}
result.completedAt=new Date().toISOString();
await writeFile(join(out,'artifacts.json'),JSON.stringify(artifacts,null,2)+'\n');
await writeFile(join(out,'run.json'),JSON.stringify(result,null,2)+'\n');
await writeFile(join(out,'manifest.json'),JSON.stringify({sourcePin,buildId:before.buildId,result:result.result,artifacts:await inventory(out)},null,2)+'\n');
if(failure)throw failure;
