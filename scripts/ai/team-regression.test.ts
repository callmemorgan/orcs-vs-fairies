import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';
import { factionFor } from '../../src/core/content-registry';
import { loadGame, saveGame } from '../../src/core/saves';
import { captureRuntime, createMatch, isGameOver, isVisible, stepGame } from '../../src/core/simulation';
import type { FactionId, MapSize, ResourceKind, Side, TeamId } from '../../src/core/types';

const folder=process.env.AI_TEAM_OUTPUT??'work/ai-team/new';
mkdirSync(folder,{recursive:true});
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function sourceHashes():Record<string,string>{
 const hashes:Record<string,string>={};
 const walk=(directory:string)=>{for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())hashes[relative(process.cwd(),path)]=sha(readFileSync(path));}};
 walk('src/core');walk('src/server');
 for(const path of ['scripts/ai/team-regression.test.ts','vitest.ai-team.config.ts','package.json','package-lock.json'])hashes[path]=sha(readFileSync(path));
 return hashes;
}
const sourceBefore=sourceHashes();
writeFileSync(`${folder}/source-before.json`,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:sourceBefore},null,2));
const cases:{name:string;mapSize:MapSize;factions:FactionId[];teams:TeamId[]}[]=[
 {name:'small-orcs-fairies-dwarves-undead',mapSize:'small',factions:['orcs','fairies','dwarves','undead'],teams:[0,0,1,1]},
 {name:'medium-dwarves-undead-orcs-fairies',mapSize:'medium',factions:['dwarves','undead','orcs','fairies'],teams:[1,1,0,0]},
];

it.each(cases)('finishes a natural four-AI allied match: $name',({name,mapSize,factions,teams})=>{
 const config={map:{seed:4127,size:mapSize},players:factions.map((factionId,id)=>({id:id as Side,teamId:teams[id],factionId,controller:'ai' as const,ai:{difficulty:'normal' as const,personality:'balanced' as const}}))};
 const s=createMatch(config),startingBanks=s.players.map(({wood,ore,crystal})=>({wood,ore,crystal}));
 expect(startingBanks).toEqual(Array.from({length:4},()=>({wood:420,ore:220,crystal:0})));
 expect(s.incomeFactors).toEqual([1,1,1,1]);expect(s.populationLimits).toEqual([100,100,100,100]);
 const attacks=[0,0,0,0],damage=[0,0,0,0],recruits=[0,0,0,0],paidFighters=[0,0,0,0],waveLaunches=[0,0,0,0];
 const gathering:{wood:number;ore:number;crystal:number}[]=Array.from({length:4},()=>({wood:0,ore:0,crystal:0}));
 const plans:unknown[]=[],launches:unknown[]=[],hqDeaths:unknown[]=[],samples:unknown[]=[];
 const violations:unknown[]=[],crossOwnerWaveLaunches=[0,0,0,0];
 const plannedIds=new Set<number>(),launchedIds=new Set<number>();
 const hqDamage=new Map<number,{side:Side;maxHp:number;attacks:number;damage:number}>();
 let lastAttack=0,maxDirectives=0,maxTransfers=0,nextSampleAt=150;
 for(let tick=0;tick<45*60*20&&!isGameOver(s);tick++){
  stepGame(s,.05);
  for(const event of s.events){
   if(event.type==='attack'){
    attacks[event.side]++;damage[event.side]+=event.amount??0;lastAttack=s.time;
    const hq=s.entities.find(e=>e.id===event.target&&e.role==='hq');
    if(hq){const record=hqDamage.get(hq.id)??{side:hq.side,maxHp:hq.maxHp,attacks:0,damage:0};record.attacks++;record.damage+=event.amount??0;hqDamage.set(hq.id,record);}
   }
   if(event.type==='train'){recruits[event.side]++;const unit=s.entities.find(e=>e.id===event.source);if(unit&&unit.role!=='worker')paidFighters[event.side]++;}
   if(event.type==='gather'&&event.resource)gathering[event.side][event.resource]+=event.amount??0;
   if(event.type==='death'){
    const hq=s.entities.find(e=>e.id===event.source&&e.role==='hq');
    if(hq)hqDeaths.push({time:s.time,id:hq.id,side:hq.side,teamId:s.teams[hq.side],hp:hq.hp,lastAttacker:hq.lastAttacker,combat:hqDamage.get(hq.id)??null});
   }
  }
  const runtime=captureRuntime(s),team=runtime.teamAI;
  if(team){
   maxDirectives=Math.max(maxDirectives,team.directives.length);maxTransfers=Math.max(maxTransfers,team.transfers.length);
   for(const wave of team.coordinator.waves){
    if(!plannedIds.has(wave.id)){plannedIds.add(wave.id);plans.push({time:s.time,tick:s.tick,wave:structuredClone(wave),directives:team.directives.length,transfers:team.transfers.length});}
    if(wave.launched&&!launchedIds.has(wave.id)){
     launchedIds.add(wave.id);
     const owners=wave.participants.map(p=>({side:p.side,ids:[...p.ids],aiWave:runtime.aiWave[p.side],orders:p.ids.map(id=>{const unit=s.entities.find(e=>e.id===id)!;return {id,side:unit.side,role:unit.role,order:{...unit.order},x:unit.x,y:unit.y};})}));
     const synchronized=owners.every(p=>p.aiWave===s.time),crossOwner=owners.length>=2;
     for(const p of owners)waveLaunches[p.side]++;
     if(crossOwner)for(const p of owners)crossOwnerWaveLaunches[p.side]++;
     launches.push({time:s.time,tick:s.tick,waveId:wave.id,teamId:wave.teamId,target:{...wave.target},synchronized,crossOwner,owners});
     if(!synchronized||!owners.every(p=>p.orders.every(e=>e.side===p.side))||!owners.every(p=>p.orders.some(e=>e.order.type==='attackMove')))violations.push({time:s.time,type:'launch',waveId:wave.id,owners});
    }
   }
  }
  if(!s.players.every(p=>Number.isFinite(p.wood)&&Number.isFinite(p.ore)&&Number.isFinite(p.crystal)&&p.wood>=0&&p.ore>=0&&p.crystal>=0))violations.push({time:s.time,type:'resource-bank',players:structuredClone(s.players)});
  if(s.time>=nextSampleAt){
   samples.push({time:s.time,lastAttack,players:structuredClone(s.players),retreating:runtime.retreating.map(r=>r.length),waves:runtime.aiWave,workers:s.players.map((_,side)=>s.entities.filter(e=>e.side===side&&e.hp>0&&e.role==='worker').length)});nextSampleAt+=150;
  }
 }
 const runtime=captureRuntime(s),envelope=JSON.stringify(saveGame(s));
 writeFileSync(`${folder}/${name}-save.json`,envelope);
 let roundtrip=false,roundtripError:string|null=null;
 try{roundtrip=JSON.stringify(saveGame(loadGame(envelope)))===envelope;}catch(error){roundtripError=String(error);}
 const finalOwned=s.players.map((player,side)=>({side,teamId:s.teams[side],player:structuredClone(player),eliminated:s.eliminated[side],workers:s.entities.filter(e=>e.side===side&&e.hp>0&&e.role==='worker').map(e=>({id:e.id,hp:e.hp,order:{...e.order},carried:e.carried,carriedKind:e.carriedKind})),fighters:s.entities.filter(e=>e.side===side&&e.hp>0&&e.kind==='unit'&&e.role!=='worker'&&!e.illusion).map(e=>({id:e.id,role:e.role,hp:e.hp,maxHp:e.maxHp,x:e.x,y:e.y,order:{...e.order}})),queues:s.entities.filter(e=>e.side===side&&e.hp>0&&e.kind==='building'&&e.queue.length).map(e=>({id:e.id,role:e.role,queue:[...e.queue]})),retreating:runtime.retreating[side],knownPositiveDeposits:s.resources.filter(n=>n.amount>0&&isVisible(s,side as Side,n.x,n.y,n.level??0)).map(n=>({id:n.id,kind:n.kind,x:n.x,y:n.y,level:n.level??0,amount:n.amount})),workerCost:factionFor(s,side as Side).units.worker.cost}));
 const sourceAfter=sourceHashes(),sourceUnchanged=JSON.stringify(sourceAfter)===JSON.stringify(sourceBefore);
 writeFileSync(`${folder}/source-after-${name}.json`,JSON.stringify({hashes:sourceAfter,sourceUnchanged},null,2));
 const report={config,stepSeconds:.05,simulationBoundSeconds:2700,startingBanks,incomeFactors:s.incomeFactors,populationLimits:s.populationLimits,time:s.time,winner:s.winner,winningTeam:s.winningTeam,draw:s.draw,timeout:!isGameOver(s),lastAttack,attacks,damage,recruits,paidFighters,gathering,waveLaunches,crossOwnerWaveLaunches,plans,launches,maxDirectives,maxTransfers,hqDeaths,hqDamage:[...hqDamage],finalOwned,samples,violations,saveSha256:sha(envelope),roundtrip,roundtripError,sourceUnchanged,sourceBeforeSha256:sha(JSON.stringify(sourceBefore)),sourceAfterSha256:sha(JSON.stringify(sourceAfter)),limitations:['Two allied integration cases cannot establish faction or team balance.','Four-player small and medium requests both normalize to the same large64×64 layout, so the duplicate original-order medium case is omitted.','These natural matches exercise built-in factions and the default map; custom full-cost and layered-world behavior are covered by focused combined regressions.','Launch counts retain waves observed in saved coordinator state; a wave removed on its launch step is not included.']};
 writeFileSync(`${folder}/${name}.json`,JSON.stringify(report,null,2));
 console.info(JSON.stringify({name,time:s.time,winner:s.winner,winningTeam:s.winningTeam,timeout:!isGameOver(s),attacks,recruits,waveLaunches,plans:plans.length,launches:launches.length,roundtrip,sourceUnchanged,saveSha256:report.saveSha256}));
 expect(sourceUnchanged).toBe(true);expect(roundtrip,roundtripError??undefined).toBe(true);
 expect(violations).toEqual([]);
 expect(maxDirectives).toBe(0);expect(maxTransfers).toBe(0);
 expect(attacks.every(count=>count>10)).toBe(true);expect(recruits.every(count=>count>0)).toBe(true);
 expect(gathering.every(p=>(['wood','ore','crystal'] as ResourceKind[]).some(kind=>p[kind]>0))).toBe(true);
 expect(waveLaunches.every(count=>count>0)).toBe(true);expect(crossOwnerWaveLaunches.every(count=>count>0)).toBe(true);
 expect(isGameOver(s)).toBe(true);expect(s.draw).toBe(false);expect(s.winner).not.toBeNull();
 const deadHqSides=new Set((hqDeaths as {side:Side;combat:{damage:number;maxHp:number}|null}[]).filter(death=>death.combat&&death.combat.damage+1e-7>=death.combat.maxHp).map(death=>death.side));
 expect(s.players.every((_,side)=>s.teams[side]===s.winningTeam||s.eliminated[side]&&deadHqSides.has(side as Side))).toBe(true);
},180_000);
