import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { it, expect } from 'vitest';
import { FACTIONS } from '../../src/core/content';
import { createGame, isGameOver, isVisible, stepGame } from '../../src/core/simulation';
import type { FactionId, MapSize, ResourceKind } from '../../src/core/types';

const factions=Object.keys(FACTIONS) as FactionId[];
const seeds=(process.env.LADDER_SEEDS??'4127,91873').split(',').map(Number);
const sizes=(process.env.LADDER_SIZES??'small,medium,large').split(',') as MapSize[];
const run=process.env.LADDER_RUN??'six-factions-v1';
if(!/^[a-z0-9-]+$/.test(run)||run==='ladder-64')throw new Error('Choose a new versioned LADDER_RUN name.');
const out=`docs/evidence/${run}`;
if(existsSync(`${out}/method.json`))throw new Error('This evidence run already exists. Choose a new LADDER_RUN.');
mkdirSync(out,{recursive:true});
const files=['src/core/types.ts','src/core/content.ts','src/core/simulation.ts','src/core/maps.ts','src/core/navigation.ts','scripts/ladder/ladder.test.ts'];
const games=seeds.flatMap(seed=>sizes.flatMap(mapSize=>factions.flatMap(faction=>factions.map(opponent=>({seed,mapSize,faction,opponent})))));
writeFileSync(`${out}/method.json`,JSON.stringify({games:games.length,seeds,sizes,seedIsUsed:true,stepSeconds:.05,controllers:['ai','ai'],decisionIntervalSeconds:1,decisionOrder:'Alternates each pulse; both receive their first decision on the same tick.',maxMinutes:45,drawPolicy:'Simultaneous stronghold loss is a draw. No winner at 45 minutes is a timeout, with no tiebreak.',pathfindingMetric:'Sample movement orders every 5s. Flag >20s with <0.35 tile displacement while >1.5 tiles from destination and no visible enemy within 10 tiles. This is a diagnostic suspicion, not proof of an unreachable path.',sourceSha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]))},null,2));
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
 const report={seed,mapSize,faction,opponent,seconds:s.time,winner:s.winner,draw:s.draw,timeout:!isGameOver(s),lastAttack,secondsWithoutCombat:s.time-lastAttack,invalidEconomy,invalidPosition,trained,deposited,hitsByRole,damageByRole,abilities,built:built.map(x=>[...x]),roles:roles.map(x=>[...x]),maxPopulation,maxWood,maxOre,maxCrystal,pathStalls,finalPlayers:s.players,hq:s.entities.filter(e=>e.role==='hq').map(e=>({side:e.side,hp:e.hp})),survivors:s.entities.filter(e=>e.hp>0).map(e=>({id:e.id,side:e.side,role:e.role,x:e.x,y:e.y,hp:e.hp,order:e.order}))};
 writeFileSync(`${out}/${mapSize}-${seed}-${faction}-${opponent}.json`,JSON.stringify(report,null,2)+'\n');
 console.info(`${mapSize}/${seed} ${faction} vs ${opponent}: ${s.winner===null?s.draw?'draw':'timeout':s.players[s.winner].faction+' (side '+s.winner+')'} ${Math.round(s.time)}s, ${pathStalls.length} movement stalls`);
 expect(invalidEconomy).toBe(false);expect(invalidPosition).toBe(false);
 if(s.winner!==null)expect(s.entities.find(e=>e.role==='hq'&&e.side!==s.winner)?.hp??0).toBe(0);
},120_000);
