import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,open} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceProvenance,inventory,sha} from '../controls-proof/browser-common.mjs';
import {economyScripts} from './browser-proof.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??'');
assert(process.argv[3],'Pass the approved source SHA and a fresh proof output root.');
assert.equal(Number(process.env.OVF_EXPECT_SAVE_VERSION),4,'Preparation requires SAVE4.');
assert(process.env.OVF_EXPECT_SIMULATION_REVISION,'Pass the approved rules revision.');
await mkdir(out,{recursive:true});assert.deepEqual(await readdir(out),[],'Use an empty output root. Partial prior preparations must be preserved.');
const provenance=await sourceProvenance(sourcePin),scripts=await economyScripts(sourcePin);
const sourceDigest=sha(Object.entries({...provenance.sourceFiles,...provenance.configFiles}).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,item])=>`${path}\0${item.sha256}\n`).join(''));
const modules=join(out,'modules');await mkdir(modules,{recursive:true});
const steps=[];
async function command(name,program,args){
 const handle=await open(join(out,`${name}.log`),'wx'),step={name,program,args,startedAt:new Date().toISOString()};steps.push(step);
 try{const child=spawn(program,args,{stdio:['ignore',handle.fd,handle.fd]});step.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(new Error(`${name} received ${signal}`)):resolve(code));});assert.equal(step.exitCode,0,`${name} failed; inspect its retained log.`);}
 catch(error){step.error=String(error);throw error;}
 finally{step.finishedAt=new Date().toISOString();await handle.close();await writeFile(join(out,'commands.json'),JSON.stringify(steps,null,2)+'\n');}
}
const entries={'schema.mjs':'scripts/controls-proof/schema.ts','generate-scenario.mjs':'scripts/economy/generate-scenario.ts','verify-native-session.mjs':'scripts/economy/verify-native-session.ts'};
for(const [name,entry] of Object.entries(entries)){
 await command(`bundle-${name}`,resolve('node_modules/.bin/esbuild'),[entry,'--bundle','--platform=node','--format=esm','--loader:.svg=text',`--define:__OVF_PROOF_PIN__=${JSON.stringify(sourcePin)}`,`--define:__OVF_PROOF_SOURCE_DIGEST__=${JSON.stringify(sourceDigest)}`,`--metafile=${join(modules,`${name}.meta.json`)}`,`--outfile=${join(modules,name)}`]);
 const meta=JSON.parse(await readFile(join(modules,`${name}.meta.json`),'utf8'));
 for(const input of Object.keys(meta.inputs).filter(path=>path.startsWith('src/')||path.startsWith('scripts/'))){const path=input.split(/[?#]/)[0],bytes=await readFile(path),pinned=execFileSync('git',['show',`${sourcePin}:${path}`],{maxBuffer:128*1024*1024});assert(bytes.equals(pinned),`Bundled input differs from the source pin: ${input}`);}
}
const {proofSchema:schema}=await import(pathToFileURL(join(modules,'schema.mjs')).href);assert.equal(schema.saveVersion,4);assert.equal(schema.simulationRevision,process.env.OVF_EXPECT_SIMULATION_REVISION);
await writeFile(join(modules,'manifest.json'),JSON.stringify({...provenance,sourceDigest,schema,economyScriptFiles:scripts,entries,modules:await inventory(modules)},null,2)+'\n');
await command('scenario-generation',process.execPath,[join(modules,'generate-scenario.mjs'),join(out,'browser-scenario.json'),'--mixed']);
const fixture=JSON.parse(await readFile(join(out,'browser-scenario.json'),'utf8'));assert.equal(fixture.game.version,4);
await command('fixture-validation',process.execPath,[join(modules,'verify-native-session.mjs'),join(out,'browser-scenario.json'),join(out,'fixture-validation.json'),sourcePin,join(modules,'manifest.json'),'--fixture']);
await command('typecheck',resolve('node_modules/.bin/tsc'),['--noEmit']);
await command('browser-build',resolve('node_modules/.bin/vite'),['build','--config',resolve('vite.config.ts'),'--outDir',join(out,'dist')]);
assert.deepEqual(await sourceProvenance(sourcePin),provenance,'Source or configuration changed during preparation.');assert.deepEqual(await economyScripts(sourcePin),scripts,'Economy proof scripts changed during preparation.');
const compiledFiles=await inventory(join(out,'dist'));
await writeFile(join(out,'build-manifest.json'),JSON.stringify({...provenance,economyScriptFiles:scripts,compiledFiles},null,2)+'\n');
await writeFile(join(out,'prepare.json'),JSON.stringify({sourcePin,sourceDigest,schema,...provenance,economyScriptFiles:scripts,outputRoot:out,distDir:join(out,'dist'),modulesDir:modules,fixtureSha256:sha(await readFile(join(out,'browser-scenario.json'))),moduleManifestSha256:sha(await readFile(join(modules,'manifest.json'))),buildManifestSha256:sha(await readFile(join(out,'build-manifest.json'))),preparedAt:new Date().toISOString(),nativeBrowserExecuted:false},null,2)+'\n');
console.log(JSON.stringify({sourcePin,schema,out,distDir:join(out,'dist'),nativeBrowserExecuted:false}));
