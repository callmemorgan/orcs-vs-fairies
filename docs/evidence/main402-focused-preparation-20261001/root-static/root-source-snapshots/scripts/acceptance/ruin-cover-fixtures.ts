import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTIONS } from '../../src/core/content';
import { MatchRecorder } from '../../src/core/replays';
import { SAVE_VERSION, saveGame } from '../../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../../src/core/session-storage';
import { createMatch, refreshVisibility, spawnDefinition } from '../../src/core/simulation';
import { initializeTactics } from '../../src/core/tactics';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { generateWorldMap, validateWorldMap } from '../../src/core/world-map';
import type { Entity, GameState, Side, UnitRole } from '../../src/core/types';
import type { WorldPoint } from '../../src/core/world-types';

/** Author fixture starting conditions only; the production main app performs every later action. */
export function buildRuinCoverFixtures(output:string,sourceCommit:string) {
 assert(output,'Supply a new fixture output directory.');assert.match(sourceCommit,/^[0-9a-f]{40}$/);
 assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,'4.0.2');
 const out=resolve(output);assert(!existsSync(out),'Use a new fixture directory.');mkdirSync(out,{recursive:true});
 const scenarios:Record<string,unknown>={};
 const lane:WorldPoint={x:23.5,y:24.5,level:1};
 function reset(e:Entity,point:WorldPoint,cooldown=1000){Object.assign(e,{...point,order:{type:'hold'},path:[],cooldown,facing:4,momentum:0,animation:'idle',animTime:0});delete e.orderQueue;}
 function base(points:WorldPoint[]) {
  const map=generateWorldMap(4127,'small',2,'temperate');for(const level of map.levels){level.terrain.fill('grass');level.elevation.fill(0);}
  map.sites=points.map((point,i)=>({...point,id:i+1,kind:'relic'}));assert.deepEqual(validateWorldMap(map),{valid:true,issues:[]});
  const state=createMatch({map:{seed:map.seed,size:map.size,biome:'temperate',world:map},players:[{id:0,teamId:0,factionId:'orcs',controller:'human'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
  state.resources=[];state.entities=state.entities.filter(e=>e.role==='hq'||e.role==='worker');
  for(const side of [0,1] as Side[]){const hq=state.entities.find(e=>e.side===side&&e.role==='hq')!;reset(hq,{x:side?31.5:5.5,y:side?31.5:5.5,level:0});state.starts[side]={x:hq.x,y:hq.y,level:0};state.entities.filter(e=>e.side===side&&e.role==='worker').forEach((e,i)=>reset(e,{x:side?30.5+i*.4:4.5+i*.4,y:side?28.5:8.5,level:0}));}
  return {state,map};
 }
 function actor(state:GameState,side:Side,role:UnitRole,point:WorldPoint,cooldown=1000) {
  const e=spawnDefinition(state,side,'unit',FACTIONS.orcs.units[role].id,point.x,point.y);reset(e,point,cooldown);initializeTactics(state,e);return e;
 }
 function write(name:string,state:GameState,map:unknown,ids:Record<string,unknown>,authored:Record<string,unknown>) {
  refreshVisibility(state);const recorder=new MatchRecorder(state);
  try {
   const file=createSessionFile(state,recorder.export());assert.deepEqual(saveGame(decodeSessionFile(file).state),file.game);
   assert.equal(state.tick,0);const bytes=Buffer.from(JSON.stringify(file,null,2)+'\n'),inputMap=Buffer.from(JSON.stringify(map,null,2)+'\n');
   writeFileSync(resolve(out,`${name}.json`),bytes,{flag:'wx'});writeFileSync(resolve(out,`${name}-input-map.json`),inputMap,{flag:'wx'});
   scenarios[name]={file:`${name}.json`,group:'ruin',ids,authored,initialTick:state.tick,initialTime:state.time,sha256:createHash('sha256').update(bytes).digest('hex'),inputMap:{file:`${name}-input-map.json`,sha256:createHash('sha256').update(inputMap).digest('hex')}};
  }finally{recorder.dispose();}
 }
 const points:Record<string,WorldPoint[]>={control:[],covered:[lane],'other-level':[{...lane,level:0}],'beyond-victim':[{x:25.9,y:24.5,level:1}],'inside-near-victim':[{x:25.1,y:24.5,level:1}]};
 for(const [kind,sites] of Object.entries(points)) {
  const {state,map}=base(sites),source=actor(state,0,'ranged',{x:20.5,y:24.5,level:1},3),target=actor(state,1,'melee',{x:25.5,y:24.5,level:1});
  write(`ruin-${kind}`,state,map,{source:source.id,target:target.id,sites:state.world!.sites.map(s=>s.id),expectedFirstDamage:kind==='covered'||kind==='inside-near-victim'?6.75:12,withdrawal:{x:9.5,y:24.5,level:1},returnPoint:{x:20.5,y:24.5,level:1}}, {map:'Valid generated two-layer map flattened to grass and zero elevation before createMatch; generated starts/resources/transitions retained in input. Runtime resources and default combat troops removed; HQs and workers relocated away from the cavern firing lane before recording.',siteDefinitions:sites,sourceCooldown:3,targetCooldown:1000,health:'Ordinary full definition health; neutral ruins; no owned-relic damage bonus.',postRecordingWrites:'Native UI/pointer/keyboard commands and normal engine ticks only.'});
 }
 {
  const {state,map}=base([lane]),worker=actor(state,0,'worker',{x:22.5,y:24.5,level:1});
  write('ruin-capture',state,map,{worker:worker.id,site:state.world!.sites[0].id,sitePoint:lane}, {map:'Same valid flat generated cavern input.',capture:'Neutral relic, zero progress and owner null; ordinary owned worker in capture range. Capture is started by the main World tools button, with no authored capture progress.'});
 }
 const manifest={schema:1,group:'ruin',sourceCommit,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,setup:'Six authored starting conditions. The generator performs no simulation ticks. Production main UI owns all attacks, movement, capture and native exports.',scenarios};
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])&&process.argv[2]&&process.argv[3])console.log(JSON.stringify(buildRuinCoverFixtures(process.argv[2],process.argv[3]),null,2));
