import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isolated=path.dirname(fileURLToPath(import.meta.url));
const repo=process.argv[2]??execFileSync('git',['rev-parse','--show-toplevel'],{cwd:isolated,encoding:'utf8'}).trim();
const productionBase='115a537dd90d5e26ca04c7003f47310a71e67879';
execFileSync('git',['diff','--exit-code',productionBase,'--','src'],{cwd:repo,stdio:'pipe'});
const refs={v1:'2c8c79a',v2:'b538995b6ee8b398f5724a5bb8a0d89cf18a49fc'};
const {build}=createRequire(path.join(repo,'package.json'))('esbuild');
const source=`
import assert from 'node:assert/strict';
import {createGame as createV1,stepGame as stepV1} from 'v1:src/core/simulation.ts';
import {saveGame as saveV1,loadGame as loadV1} from 'v1:src/core/saves.ts';
import {createGame as createV2,stepGame as stepV2} from 'v2:src/core/simulation.ts';
import {saveGame as saveV2,loadGame as loadV2} from 'v2:src/core/saves.ts';
import {createGame,stepGame,captureRuntime} from './src/core/simulation';
import {saveGame,loadGame,SAVE_VERSION,MAX_SAVE_BYTES} from './src/core/saves';
import {historicalSave,expectedHistoricalMigration} from './tests/helpers/historical-save';
const results=[],archives=[];
for(const [version,oldCreate,oldStep,oldSave,oldLoad,ticks,dt] of [[1,createV1,stepV1,saveV1,loadV1,160,.25],[2,createV2,stepV2,saveV2,loadV2,100,.05]]){
 const original=oldCreate('orcs',4127,'fairies',{controllers:version===1?['ai','ai']:['external','external'],mapSize:'small'});
 for(let i=0;i<ticks;i++)oldStep(original,dt);
 const input=oldSave(original),before=structuredClone(input),inputBytes=JSON.stringify(input);
 assert.equal(input.version,version);
 const loaded=loadGame(input),native=saveGame(loaded);
 assert.equal(native.version,SAVE_VERSION);
 assert.deepEqual(input,before);assert.equal(JSON.stringify(input),inputBytes);
 assert.deepEqual(historicalSave(loaded,version),before);
 assert.deepEqual(native,expectedHistoricalMigration(before));
 assert.deepEqual(saveGame(loadGame(inputBytes)),native);
 for(const [key,value] of Object.entries(input.runtime))assert.deepEqual(captureRuntime(loaded)[key],value,key);
 const resumed=loadGame(native),continuationTicks=version===1?100:20;
 for(let i=0;i<continuationTicks;i++){stepGame(loaded,.125);stepGame(resumed,.125);assert.deepEqual(saveGame(loaded),saveGame(resumed));}
 const current=createGame('orcs',4127,'fairies',{controllers:['ai','ai'],mapSize:'small'});
 for(let i=0;i<160;i++)stepGame(current,.25);
 const projected=historicalSave(current,version),projectedBefore=structuredClone(projected);
 assert.equal(projected.version,version);assert.deepEqual(oldSave(oldLoad(projected)),projected);
 assert.deepEqual(projected,projectedBefore);
 assert.equal(Object.keys(projected.state).length,version===1?20:26);
 assert.equal(Object.keys(projected.runtime).length,version===1?15:16);
 const missing=structuredClone(input);delete missing.runtime.knownEnemyBuildings;
 const missingBefore=structuredClone(missing);assert.throws(()=>loadGame(missing),/runtime\\.knownEnemyBuildings: missing field/);assert.deepEqual(missing,missingBefore);
 const prohibited={friendlyFire:true,projectiles:[],factionSystems:{version:1,fury:[0,0],terrainEffects:[]},rules:{},objectives:{},draft:{},economy:{}};
 for(const [key,value] of Object.entries(prohibited)){const forged=structuredClone(input);forged.state[key]=value;const forgedBefore=structuredClone(forged);assert.throws(()=>loadGame(forged),e=>e.message==='Invalid save at state.'+key+': unknown field.');assert.deepEqual(forged,forgedBefore);}
 results.push({version,currentVersion:SAVE_VERSION,historicalTick:input.state.tick,historicalBytes:Buffer.byteLength(inputBytes),stateFields:Object.keys(projected.state).length,runtimeFields:Object.keys(projected.runtime).length,completeExpectedEnvelope:true,historicalProducerRoundTrip:true,inputUnchanged:true,projectionAcceptedByHistoricalConsumer:true,continuationTicks,forgedFieldsRejected:Object.keys(prohibited)});
 archives.push(input);
}
const near=historicalSave(createGame('orcs',4127,'fairies',{controllers:['external','external']}),2);
const bytes=v=>Buffer.byteLength(JSON.stringify(v)),target=MAX_SAVE_BYTES-64,event={type:'message',x:0,y:0,side:0,text:''},full={...event,text:'一'.repeat(4000)};
const count=Math.floor((target-bytes(near))/(bytes(full)+1));near.state.events=Array.from({length:count},()=>({...full}));
let remaining=target-bytes(near);if(remaining<bytes(event)+1){near.state.events.pop();remaining=target-bytes(near);}
const textBytes=remaining-bytes(event)-1;near.state.events.push({...event,text:'一'.repeat(Math.floor(textBytes/3))+'x'.repeat(textBytes%3)});
assert.equal(bytes(near),target);loadV2(near);
const before=structuredClone(near);assert.throws(()=>loadGame(near),/size limit/);assert.throws(()=>loadGame(JSON.stringify(near)),/size limit/);assert.deepEqual(near,before);
near.state.events.at(-1).text=near.state.events.at(-1).text.slice(0,-1500);saveGame(loadGame(near));
globalThis.__archives=archives;
console.log(JSON.stringify({sourcePin:'115a537dd90d5e26ca04c7003f47310a71e67879',results,boundary:{inputBytes:target,validatedByHistoricalV2:true,rejectedAfterMigration:true,shortenedByCharacters:1500,shorterInputLoadsAndSaves:true}},null,2));
`;
const historicalPlugin={name:'pinned-historical-source',setup(api){
 api.onResolve({filter:/^v[12]:/},a=>{const colon=a.path.indexOf(':');return {path:a.path.slice(colon+1),namespace:a.path.slice(0,colon)};});
 for(const namespace of Object.keys(refs)){
  api.onResolve({filter:/^\./,namespace},a=>({path:path.posix.normalize(path.posix.join(path.posix.dirname(a.importer),a.path))+(/\.[cm]?[jt]sx?$/.test(a.path)?'':'.ts'),namespace}));
  api.onLoad({filter:/.*/,namespace},a=>({contents:execFileSync('git',['show',refs[namespace]+':'+a.path],{cwd:repo,encoding:'utf8'}),loader:'ts'}));
 }
}};
const bundled=await build({stdin:{contents:source,resolveDir:repo,sourcefile:'historical-fixture-proof.js'},plugins:[historicalPlugin],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
for(const [index,archive] of globalThis.__archives.entries()){
 const text=JSON.stringify(archive,null,2)+'\n',archivePath=path.join(isolated,'historical-v'+(index+1)+'-producer.json');
 writeFileSync(archivePath,text);console.log(JSON.stringify({archivePath,sha256:createHash('sha256').update(text).digest('hex')}));
}
