import { writeFileSync,mkdirSync,readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMatch,isGameOver,stepGame } from '../../src/core/simulation';
import { loadGame,saveGame } from '../../src/core/saves';
import { MatchRecorder,ReplayPlayer,replayChecksum } from '../../src/core/replays';
import type { MatchConfig } from '../../src/core/types';
const directory=process.env.OVF_MODES_EVIDENCE??'docs/evidence/modes-objectives';mkdirSync(directory,{recursive:true});
const cases:Array<{name:string;config:MatchConfig;limit:number}>=[
 {name:'hill-duel',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:1,factionId:'fairies',controller:'ai'}],rules:{mode:'hill',startingAge:3,startingResources:{wood:1400,ore:1000,crystal:500},hill:{captureTicks:40,holdTicks:400}}},limit:20000},
 {name:'relic-duel',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai'},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{mode:'relic',startingAge:3,relic:{count:3,required:2,holdTicks:400}}},limit:20000},
 {name:'survival-five-waves',config:{map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'automata',controller:'ai'},{id:1,teamId:1,factionId:'orcs',controller:'external'}],rules:{mode:'survival',startingAge:3,startingResources:{wood:2400,ore:1800,crystal:600},survival:{waveCount:5,intervalTicks:2400,recoveryTicks:300,unitsPerWave:1}}},limit:40000},
];
const coreFiles=readdirSync('src/core').filter(f=>f.endsWith('.ts')).sort();const sourceFiles=Object.fromEntries(coreFiles.map(f=>[f,createHash('sha256').update(readFileSync(`src/core/${f}`)).digest('hex')]));writeFileSync(`${directory}/source-sha256.json`,JSON.stringify(sourceFiles,null,2));
const result:unknown[]=[];
for(const fixture of cases){const state=createMatch(fixture.config),recorder=new MatchRecorder(state);let restored:typeof state|undefined,resumeTick=0,firstDifference:number|null=null;const waves:unknown[]=[];let prior=0;
 for(let i=0;i<fixture.limit&&!isGameOver(state);i++){
  stepGame(state,.05);
  if(state.objectives.survival.wave!==prior){prior=state.objectives.survival.wave;waves.push({tick:state.tick,wave:prior,attackers:state.objectives.survival.spawnedIds.length,roles:state.entities.filter(e=>state.objectives.survival.spawnedIds.includes(e.id)).map(e=>e.role)});}
  if(restored){stepGame(restored,.05);if(replayChecksum(restored)!==replayChecksum(state)){firstDifference=state.tick;throw new Error(`${fixture.name} save continuation diverged at ${state.tick}`);}}
  if(!restored&&state.tick===300){restored=loadGame(saveGame(state));resumeTick=state.tick;}
 }
 if(!isGameOver(state))throw new Error(`${fixture.name} did not finish after ${fixture.limit} ticks`);
 if(fixture.name.startsWith('survival')&&(state.winningTeam!==0||state.objectives.survival.wave!==5))throw new Error('Survival did not complete the five actual waves.');
 if((fixture.name.startsWith('hill')||fixture.name.startsWith('relic'))&&!state.entities.some(e=>e.kind==='building'&&e.role==='hq'&&e.side!==state.winner&&e.hp>0))throw new Error('Objective fixture ended through headquarters defeat.');
 const archive=recorder.export();recorder.dispose();const playback=new ReplayPlayer(archive);playback.seek(archive.finalTick);if(replayChecksum(playback.state)!==replayChecksum(state))throw new Error(`${fixture.name} replay diverged`);
 writeFileSync(`${directory}/${fixture.name}.replay.json`,JSON.stringify(archive));writeFileSync(`${directory}/${fixture.name}.save.json`,JSON.stringify(saveGame(state)));
 const summary={name:fixture.name,config:fixture.config,tick:state.tick,time:state.time,winner:state.winner,winningTeam:state.winningTeam,headquarters:state.entities.filter(e=>e.role==='hq').map(e=>({side:e.side,hp:e.hp})),objectives:state.objectives,checksum:replayChecksum(state),resumeTick,firstDifference,waves};result.push(summary);console.log(JSON.stringify(summary));
}
writeFileSync(`${directory}/runtime-results.json`,JSON.stringify(result,null,2));
