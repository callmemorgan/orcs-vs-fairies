import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { afterAll, it, expect } from 'vitest';
import { DEFAULT_AI_CONFIG, aiProfile } from '../../src/core/ai-policy';
import { FACTIONS } from '../../src/core/content';
import { replayChecksum } from '../../src/core/replays';
import { loadGame, saveGame, SAVE_VERSION } from '../../src/core/saves';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { createGame, isGameOver, isVisible, stepGame } from '../../src/core/simulation';
import type { FactionId, GameState, MapSize, ResourceKind } from '../../src/core/types';

const factions=Object.keys(FACTIONS) as FactionId[];
const seeds=(process.env.LADDER_SEEDS??'4127,91873').split(',').map(Number);
const sizes=(process.env.LADDER_SIZES??'small,medium,large').split(',') as MapSize[];
const run=process.env.LADDER_RUN??'six-factions-v1';
if(!/^six-factions-[a-z0-9-]+$/.test(run))throw new Error('Choose a new versioned six-factions-* LADDER_RUN name.');
if(!seeds.length||seeds.some(seed=>!Number.isSafeInteger(seed)||seed<0)||new Set(seeds).size!==seeds.length)throw new Error('LADDER_SEEDS must contain distinct nonnegative integer seeds.');
if(!sizes.length||sizes.some(size=>!['small','medium','large','huge'].includes(size))||new Set(sizes).size!==sizes.length)throw new Error('LADDER_SIZES must contain distinct map sizes.');
const pairInput=process.env.LADDER_PAIRS;
const pairs=pairInput===undefined
 ? factions.flatMap(faction=>factions.map(opponent=>({faction,opponent})))
 : pairInput.split(',').map(pair=>{
   const [faction,opponent,...extra]=pair.split(':');
   if(extra.length||!factions.includes(faction as FactionId)||!factions.includes(opponent as FactionId))throw new Error('LADDER_PAIRS must contain known faction:opponent pairs.');
   return {faction:faction as FactionId,opponent:opponent as FactionId};
 });
if(new Set(pairs.map(({faction,opponent})=>`${faction}:${opponent}`)).size!==pairs.length)throw new Error('LADDER_PAIRS must contain distinct pairs.');
const out=`docs/evidence/${run}`;
if(existsSync(out))throw new Error('This evidence directory already exists, including any partial run. Choose a new LADDER_RUN.');
const sha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function coreFiles(directory='src/core'):string[] {
 if(!existsSync(directory))return [];
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?coreFiles(`${directory}/${entry.name}`):(entry.isFile()||entry.isSymbolicLink())&&entry.name.endsWith('.ts')?[`${directory}/${entry.name}`]:[]).sort();
}
function sourceFiles():string[] {
 return [...coreFiles(),'scripts/ladder/ladder.test.ts','scripts/ladder/report.py','scripts/ladder/README.md','vitest.config.ts','vitest.ladder.config.ts','tsconfig.json','package.json','package-lock.json'].sort();
}
const files=sourceFiles();
const sourceBytes=new Map(files.map(file=>[file,readFileSync(file)]));
function manifest(bytes?:Map<string,Buffer>) {
 const currentFiles=sourceFiles();
 return {sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,sourceFiles:currentFiles,sourceSha256:Object.fromEntries([...new Set([...files,...currentFiles])].sort().map(file=>[file,bytes?(bytes.has(file)?sha256(bytes.get(file)!):null):existsSync(file)?sha256(readFileSync(file)):null]))};
}
const before=manifest(sourceBytes);
if(JSON.stringify(before.sourceFiles)!==JSON.stringify(files))throw new Error('Source paths changed while preparing the run.');
const committedCoreFiles=execFileSync('git',['ls-tree','-r','--name-only',before.sourceCommit,'--','src/core'],{encoding:'utf8'}).split('\n').filter(file=>file.endsWith('.ts')).sort();
if(JSON.stringify(files.filter(file=>file.startsWith('src/core/')))!==JSON.stringify(committedCoreFiles))throw new Error('Core source paths do not match the pinned commit. Restore deleted files and commit additions before running.');
for(const file of files)if(!sourceBytes.get(file)!.equals(execFileSync('git',['show',`${before.sourceCommit}:${file}`])))throw new Error(`Commit the ladder source before running: ${file}`);
mkdirSync('docs/evidence',{recursive:true});
mkdirSync(out);
mkdirSync(`${out}/verification`);
mkdirSync(`${out}/saves`);
writeFileSync(`${out}/verification/source-before.json`,JSON.stringify(before,null,2)+'\n');
for(const file of files){const dest=`${out}/source/${file}`;mkdirSync(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});writeFileSync(dest,sourceBytes.get(file)!);}
afterAll(()=>{
 const after=manifest();
 writeFileSync(`${out}/verification/source-after.json`,JSON.stringify(after,null,2)+'\n');
 expect(after).toEqual(before);
});
const games=seeds.flatMap(seed=>sizes.flatMap(mapSize=>pairs.map(pair=>({seed,mapSize,...pair}))));
const proofSteps=20,stepSeconds=.05;
writeFileSync(`${out}/method.json`,JSON.stringify({sourceCommit:before.sourceCommit,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,runtime:{node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch},defaultAiConfig:{...DEFAULT_AI_CONFIG},games:games.length,seeds,sizes,pairSelection:pairInput===undefined?'all-ordered':'subset',pairs,seedIsUsed:true,stepSeconds,controllers:['ai','ai'],decisionIntervalSeconds:aiProfile({...DEFAULT_AI_CONFIG}).decisionInterval,decisionOrder:'Per-player aiDecisionAt schedules default normal decisions on the same ticks; aiBatchTurns rotates player command order each due batch.',maxMinutes:45,caseTimeoutMilliseconds:120_000,drawPolicy:'Simultaneous stronghold loss is a draw. No winner at 45 minutes is a timeout, with no tiebreak.',pathfindingMetric:'Sample movement orders every 5s. Flag >20s with <0.35 tile displacement while >1.5 tiles from destination and no visible enemy within 10 tiles. This is a diagnostic suspicion, not proof of an unreachable path.',saveProof:{steps:proofSteps,stepSeconds,fullStateHash:'SHA-256 of the complete save envelope, sorting only visible/explored fog-cell arrays; numerical values and all other ordering are preserved.',replayChecksum:'Current replayChecksum over the raw full envelope; supplementary divergence check.',outcome:'Metrics and outcome are captured before proof steps. Unfinished matches compare live and file-restored continuation. Finished matches must remain unchanged after attempted steps.'},manifestLimits:'Pins the listed source/configuration bytes and Git HEAD before and after this runner. Does not pin all installed dependencies, the complete environment, CLI/server/browser execution, or competitive balance.',sourceSha256:before.sourceSha256},null,2)+'\n');
function stateSha256(state:GameState):string {
 const envelope=saveGame(state);
 envelope.state.visible=envelope.state.visible.map(cells=>cells.sort((a,b)=>a-b));
 envelope.state.explored=envelope.state.explored.map(cells=>cells.sort((a,b)=>a-b));
 return sha256(JSON.stringify(envelope));
}
function proveSave(state:GameState,name:string) {
 const finalSave=saveGame(state),finalSaveFile=`saves/${name}.save.json`;
 writeFileSync(`${out}/${finalSaveFile}`,JSON.stringify(finalSave,null,2)+'\n',{flag:'wx'});
 const savedBytes=readFileSync(`${out}/${finalSaveFile}`),restored=loadGame(savedBytes.toString('utf8'));
 const finalStateSha256=stateSha256(state),finalReplayChecksum=replayChecksum(state);
 const restoredStateSha256=stateSha256(restored),restoredReplayChecksum=replayChecksum(restored);
 const saveRoundTrip=finalStateSha256===restoredStateSha256&&finalReplayChecksum===restoredReplayChecksum;
 const terminal=isGameOver(state),initialTick=state.tick,checks=[];
 for(let step=1;step<=proofSteps;step++){
  stepGame(state,stepSeconds);stepGame(restored,stepSeconds);
  const sourceStateSha256=stateSha256(state),restoredStateSha256=stateSha256(restored),sourceReplayChecksum=replayChecksum(state),restoredReplayChecksum=replayChecksum(restored);
  checks.push({step,sourceTick:state.tick,restoredTick:restored.tick,sourceStateSha256,restoredStateSha256,sourceReplayChecksum,restoredReplayChecksum,equal:sourceStateSha256===restoredStateSha256&&sourceReplayChecksum===restoredReplayChecksum,terminalUnchanged:terminal?sourceStateSha256===finalStateSha256&&sourceReplayChecksum===finalReplayChecksum:null});
 }
 return {finalSaveFile,finalSaveVersion:finalSave.version,finalSaveSha256:sha256(savedBytes),finalStateSha256,finalReplayChecksum,saveRoundTrip,saveProof:{passed:saveRoundTrip&&checks.every(check=>check.equal&&check.terminalUnchanged!==false),roundTrip:{restoredStateSha256,restoredReplayChecksum},mode:terminal?'terminal-equality':'deterministic-continuation',stepSeconds,attemptedSteps:proofSteps,initialTick,finalTick:state.tick,advancedTicks:state.tick-initialTick,checks}};
}
it.concurrent.each(games)('$mapSize/$seed: $faction vs $opponent',({seed,mapSize,faction,opponent})=>{
 const s=createGame(faction,seed,opponent,{mapSize,controllers:['ai','ai']});
 const trained=[0,0],deposited:Record<ResourceKind,number>[]=[{wood:0,ore:0,crystal:0},{wood:0,ore:0,crystal:0}],hitsByRole:Record<string,number>[]=[{},{}],damageByRole:Record<string,number>[]=[{},{}];
 const built=[new Set<string>(),new Set<string>()],roles=[new Set<string>(),new Set<string>()],abilities:Record<string,number>[]=[{},{}];
 const maxPopulation=[0,0],maxWood=[0,0],maxOre=[0,0],maxCrystal=[0,0];
 const movement=new Map<number,{key:string;x:number;y:number;since:number;reported:boolean}>();
 const pathStalls:{id:number;side:number;role:string;at:number;x:number;y:number;target:{x:number;y:number}}[]=[];
 let lastAttack=0,invalidEconomy=false,invalidPosition=false;
 for(let tick=0;tick<20*45*60&&!isGameOver(s);tick++){
  stepGame(s,.05);
  for(const e of s.events){
   if(e.type==='train'){trained[e.side]++;const unit=s.entities.find(u=>u.id===e.source);if(unit)roles[e.side].add(unit.role);}
   if(e.type==='gather'&&e.resource)deposited[e.side][e.resource]+=e.amount??0;
   if(e.type==='ability'){const u=s.entities.find(u=>u.id===e.source);if(u)abilities[e.side][u.role]=(abilities[e.side][u.role]??0)+1;}
   if(e.type==='attack'){
    lastAttack=s.time;const unit=s.entities.find(u=>u.id===e.source);
    if(unit){hitsByRole[e.side][unit.role]=(hitsByRole[e.side][unit.role]??0)+1;damageByRole[e.side][unit.role]=(damageByRole[e.side][unit.role]??0)+(e.amount??0);}
   }
  }
  if(tick%100===0){
   for(const e of s.entities){
    if(e.kind==='building'&&e.progress===1)built[e.side].add(e.role);
    invalidPosition ||= !Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>s.width||e.y>s.height;
    const o=e.order;
    if(e.hp<=0||e.kind!=='unit'||!(o.type==='move'||o.type==='attackMove')||Math.hypot(e.x-o.x,e.y-o.y)<1.5||s.entities.some(b=>b.side!==e.side&&b.hp>0&&isVisible(s,e.side,b.x,b.y)&&Math.hypot(b.x-e.x,b.y-e.y)<10)){movement.delete(e.id);continue;}
    const key=`${o.type}/${o.x}/${o.y}`,prev=movement.get(e.id);
    if(!prev||prev.key!==key||Math.hypot(e.x-prev.x,e.y-prev.y)>.35)movement.set(e.id,{key,x:e.x,y:e.y,since:s.time,reported:false});
    else if(!prev.reported&&s.time-prev.since>=20){pathStalls.push({id:e.id,side:e.side,role:e.role,at:s.time,x:e.x,y:e.y,target:{x:o.x,y:o.y}});prev.reported=true;}
   }
  }
  for(const side of [0,1]){const p=s.players[side];invalidEconomy ||= p.wood<-.001||p.ore<-.001||p.crystal<-.001||p.population>100;maxPopulation[side]=Math.max(maxPopulation[side],p.population);maxWood[side]=Math.max(maxWood[side],p.wood);maxOre[side]=Math.max(maxOre[side],p.ore);maxCrystal[side]=Math.max(maxCrystal[side],p.crystal);}
 }
 const report=structuredClone({sourceCommit:before.sourceCommit,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,aiConfigs:s.aiConfigs,seed,mapSize,faction,opponent,seconds:s.time,winner:s.winner,winningTeam:s.winningTeam,draw:s.draw,timeout:!isGameOver(s),lastAttack,secondsWithoutCombat:s.time-lastAttack,invalidEconomy,invalidPosition,trained,deposited,hitsByRole,damageByRole,abilities,built:built.map(x=>[...x]),roles:roles.map(x=>[...x]),maxPopulation,maxWood,maxOre,maxCrystal,pathStalls,finalPlayers:s.players,hq:s.entities.filter(e=>e.role==='hq').map(e=>({side:e.side,hp:e.hp})),survivors:s.entities.filter(e=>e.hp>0).map(e=>({id:e.id,side:e.side,role:e.role,x:e.x,y:e.y,hp:e.hp,order:e.order}))});
 const name=`${mapSize}-${seed}-${faction}-${opponent}`;
 let proof:ReturnType<typeof proveSave>|{saveProof:{passed:false;error:string}};
 try{proof=proveSave(s,name);}catch(error){proof={saveProof:{passed:false,error:error instanceof Error?error.stack??error.message:String(error)}};}
 writeFileSync(`${out}/${name}.json`,JSON.stringify({...report,...proof},null,2)+'\n',{flag:'wx'});
 console.info(`${mapSize}/${seed} ${faction} vs ${opponent}: ${report.winner===null?report.draw?'draw':'timeout':report.finalPlayers[report.winner].faction+' (side '+report.winner+')'} ${Math.round(report.seconds)}s, ${pathStalls.length} movement stalls`);
 expect(invalidEconomy).toBe(false);expect(invalidPosition).toBe(false);
 if(report.winner!==null)expect(report.hq.find(e=>e.side!==report.winner)?.hp??0).toBe(0);
 expect(proof.saveProof.passed).toBe(true);
},120_000);
