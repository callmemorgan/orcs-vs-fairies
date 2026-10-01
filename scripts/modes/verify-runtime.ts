import assert from 'node:assert/strict';
import { writeFileSync,mkdirSync,readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,basename } from 'node:path';
import { createMatch,isGameOver,stepGame } from '../../src/core/simulation';
import { loadGame,saveGame,SAVE_VERSION } from '../../src/core/saves';
import { MatchRecorder,ReplayPlayer,replayChecksum } from '../../src/core/replays';
import { createSessionFile,decodeSessionFile } from '../../src/core/session-storage';
import { SIMULATION_REVISION } from '../../src/core/versions';
import type { MatchConfig } from '../../src/core/types';
import { preparedInputs,sourceDigest,sha } from './proof-common.mjs';
declare const __OVF_PROOF_PIN__:string|undefined;
declare const __OVF_PROOF_SOURCE_DIGEST__:string|undefined;
const sourcePin=process.env.OVF_PROOF_PIN,proofRoot=process.env.OVF_MODES_PROOF_ROOT;
assert(sourcePin&&proofRoot,'Use scripts/modes/run.mjs with a frozen prepared proof root');
const {prepared,provenance}=await preparedInputs(sourcePin,resolve(proofRoot));
assert(typeof __OVF_PROOF_PIN__!=='undefined'&&typeof __OVF_PROOF_SOURCE_DIGEST__!=='undefined','Rebundle the proof with the pinned prepare script');
assert.equal(__OVF_PROOF_PIN__,sourcePin,'Executed runtime bundle belongs to another source pin');
assert.equal(__OVF_PROOF_SOURCE_DIGEST__,sourceDigest(provenance),'Executed runtime bundle belongs to other source bytes');
assert.equal(sha(readFileSync(process.argv[1])),prepared.moduleFiles[basename(process.argv[1])]?.sha256,'Executed runtime bundle bytes differ from preparation');
assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,prepared.schema.simulationRevision);
const directory=resolve(process.env.OVF_MODES_EVIDENCE??`${proofRoot}/runtime`);
mkdirSync(directory,{recursive:true});assert.deepEqual(readdirSync(directory),[],'Use a fresh runtime evidence directory');
const cases:Array<{name:string;config:MatchConfig;limit:number}>=[
 {name:'hill-duel',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:1,factionId:'fairies',controller:'ai'}],rules:{mode:'hill',startingAge:3,startingResources:{wood:1400,ore:1000,crystal:500},hill:{captureTicks:40,holdTicks:400}}},limit:20000},
 {name:'relic-duel',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{mode:'relic',startingAge:3,relic:{count:3,required:2,holdTicks:400}}},limit:20000},
 {name:'relic-contested',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:1,factionId:'fairies',controller:'ai'}],rules:{mode:'relic',startingAge:3,startingResources:{wood:1400,ore:1000,crystal:500},relic:{count:3,required:2,holdTicks:400}}},limit:20000},
 {name:'hill-2v2',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:0,factionId:'fairies',controller:'ai'},{id:2,teamId:1,factionId:'orcs',controller:'ai'},{id:3,teamId:1,factionId:'fairies',controller:'ai'}],rules:{mode:'hill',startingAge:3,startingResources:{wood:1400,ore:1000,crystal:500},hill:{captureTicks:40,holdTicks:400}}},limit:20000},
 {name:'survival-five-waves',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'automata',controller:'ai'},{id:1,teamId:1,factionId:'orcs',controller:'external'}],rules:{mode:'survival',startingAge:3,startingResources:{wood:2400,ore:1800,crystal:600},survival:{waveCount:5,intervalTicks:2400,recoveryTicks:300,unitsPerWave:1}}},limit:40000},
];
writeFileSync(`${directory}/source-sha256.json`,JSON.stringify(provenance.sourceFiles,null,2));
writeFileSync(`${directory}/provenance.json`,JSON.stringify({sourceCommit:sourcePin,node:process.version,runner:'scripts/modes/verify-runtime.ts',timestep:.05,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,
 sourceDigest:sourceDigest(provenance),executedBundleSha256:sha(readFileSync(process.argv[1])),bundleSourceBindingPassed:true,...provenance},null,2));
const stateHash=(state:ReturnType<typeof createMatch>)=>createHash('sha256').update(JSON.stringify(saveGame(state))).digest('hex');
const result:unknown[]=[];
try {
for(const fixture of cases){const state=createMatch(fixture.config),recorder=new MatchRecorder(state);let restored:typeof state|undefined,restoredRecorder:MatchRecorder|undefined,resumeTick=0,resumeTicks:number[]=[],priorPhase=state.objectives.survival.phase,firstDifference:number|null=null,comparedTicks=0,segmentTicks=0;const waves:unknown[]=[],continuationSegments:Array<{startTick:number;endTick:number;comparedTicks:number}>=[];let prior=0;
 writeFileSync(`${directory}/${fixture.name}-initial.save.json`,JSON.stringify(saveGame(state)));
 const finishSegment=()=>{if(restoredRecorder){assert(segmentTicks>0,'Every saved branch must continue through natural ticks');assert.deepEqual(restoredRecorder.export(),recorder.export(),'Restored recorder history must match the uninterrupted history');continuationSegments.push({startTick:resumeTicks.at(-1)!,endTick:state.tick,comparedTicks:segmentTicks});}};
 const resume=(name:string)=>{finishSegment();restoredRecorder?.dispose();segmentTicks=0;const envelope=saveGame(state),path=`${directory}/${name}.save.json`,sessionPath=`${directory}/${name}.session.json`;writeFileSync(path,JSON.stringify(envelope));writeFileSync(sessionPath,JSON.stringify(createSessionFile(state,recorder.export())));
  const decoded=decodeSessionFile(readFileSync(sessionPath,'utf8'));restored=decoded.state;assert.deepEqual(saveGame(loadGame(readFileSync(path,'utf8'))),envelope);assert.deepEqual(saveGame(restored),envelope,'File-restored checkpoint must preserve the complete envelope');restoredRecorder=new MatchRecorder(restored,decoded.file.replay);resumeTicks.push(state.tick);};
 try {
 for(let i=0;i<fixture.limit&&!isGameOver(state);i++){
  stepGame(state,.05);
  if(state.objectives.survival.wave!==prior){prior=state.objectives.survival.wave;waves.push({tick:state.tick,wave:prior,attackers:state.objectives.survival.spawnedIds.length,roles:state.entities.filter(e=>state.objectives.survival.spawnedIds.includes(e.id)).map(e=>e.role)});}
  if(restored){stepGame(restored,.05);comparedTicks++;segmentTicks++;if(stateHash(restored)!==stateHash(state)){firstDifference=state.tick;throw new Error(`${fixture.name} save continuation diverged at ${state.tick}`);}}
  if(!restored&&state.tick===300){resume(`${fixture.name}-tick-300`);resumeTick=state.tick;}
  if(state.objectives.survival.phase==='recovery'&&priorPhase!=='recovery')resume(`${fixture.name}-wave-${state.objectives.survival.wave}-recovery`);priorPhase=state.objectives.survival.phase;
 }
 if(!isGameOver(state))throw new Error(`${fixture.name} did not finish after ${fixture.limit} ticks`);
 if(fixture.name.startsWith('survival')&&(state.winningTeam!==0||state.objectives.survival.wave!==5))throw new Error('Survival did not complete the five actual waves.');
 if((fixture.name.startsWith('hill')||fixture.name.startsWith('relic'))&&!state.entities.some(e=>e.kind==='building'&&e.role==='hq'&&state.teams[e.side]!==state.winningTeam&&e.hp>0))throw new Error('Objective fixture ended through headquarters defeat.');
 assert(comparedTicks>0&&resumeTick===300,'Every case must continue a complete saved checkpoint');
 finishSegment();if(fixture.name.startsWith('survival'))assert.equal(resumeTicks.length-1,4,'Five-wave survival must resume every recovery checkpoint');
 const archive=recorder.export(),envelope=saveGame(state),session=createSessionFile(state,archive);
 assert.equal(archive.initial.version,SAVE_VERSION);assert.equal(archive.checksumVersion,SAVE_VERSION);assert.equal(archive.simulationRevision,SIMULATION_REVISION);
 writeFileSync(`${directory}/${fixture.name}.replay.json`,JSON.stringify(archive));writeFileSync(`${directory}/${fixture.name}.save.json`,JSON.stringify(envelope));writeFileSync(`${directory}/${fixture.name}.session.json`,JSON.stringify(session));
 const decoded=decodeSessionFile(readFileSync(`${directory}/${fixture.name}.session.json`,'utf8'));
 assert.deepEqual(decoded.file.game,envelope);assert.deepEqual(saveGame(decoded.state),envelope);
 assert.deepEqual(saveGame(loadGame(readFileSync(`${directory}/${fixture.name}.save.json`,'utf8'))),envelope);
 const playback=new ReplayPlayer(archive),seeking=new ReplayPlayer(archive);
 let advanced=0;
 try {advanced=playback.advance(archive.finalTick-playback.state.tick);assert(playback.finished);assert.deepEqual(saveGame(playback.state),envelope,`${fixture.name} full replay diverged`);
  assert.deepEqual(playback.analysis,archive.analysis);assert.deepEqual(playback.technologyTimings,archive.technologies);
  seeking.seek(archive.finalTick);assert.deepEqual(saveGame(seeking.state),envelope,`${fixture.name} replay seek diverged`);
 } finally {playback.dispose();seeking.dispose();}
 const summary={name:fixture.name,config:fixture.config,tick:state.tick,time:state.time,winner:state.winner,winningTeam:state.winningTeam,headquarters:state.entities.filter(e=>e.role==='hq').map(e=>({side:e.side,hp:e.hp})),objectives:state.objectives,checksum:replayChecksum(state),authoritativeSha256:stateHash(state),resumeTick,resumeTicks,comparedTicks,continuationSegments,firstDifference,waves,
  completeEnvelopeRoundtripPassed:true,completeReplayEnvelopePassed:true,continuedRecorderHistoryPassed:true,replaySeekEnvelopePassed:true,fullReplayAdvancedTicks:advanced};result.push(summary);console.log(JSON.stringify(summary));
 writeFileSync(`${directory}/runtime-results.json`,JSON.stringify(result,null,2));
 } finally {recorder.dispose();restoredRecorder?.dispose();}
}
assert.deepEqual((await preparedInputs(sourcePin,resolve(proofRoot))).provenance,provenance,'Source changed during natural matches');
writeFileSync(`${directory}/run.json`,JSON.stringify({result:'passed',sourcePin,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,cases:result.length,completeEnvelopeContinuationPassed:true},null,2));
} catch(error) {writeFileSync(`${directory}/run.json`,JSON.stringify({result:'failed',sourcePin,completedCases:result.length,error:String(error)},null,2));throw error;}
