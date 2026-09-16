/** Full ordinary AI matches. Bundle this file to preserve the tested simulation version. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame, isGameOver, stepGame } from '../../src/core/simulation';
import { playerAge } from '../../src/core/progression';
import type { FactionId, MapSize } from '../../src/core/types';
const faction=(process.argv[2]??'orcs') as FactionId,opponent=(process.argv[3]??'fairies') as FactionId;
const mapSize=(process.argv[4]??'medium') as MapSize,seed=Number(process.argv[5]??4127),out=process.argv[6]??'work/three-ages/matches';
mkdirSync(out,{recursive:true});
const s=createGame(faction,seed,opponent,{mapSize,controllers:['ai','ai']});
const roles=[new Set<string>(),new Set<string>()],buildings=[new Set<string>(),new Set<string>()],ages:[number[],number[]]=[[],[]];
const camps=mapSize==='large'||mapSize==='huge'?[{x:Math.floor(s.width*.23)+.5,y:Math.floor(s.height*.58)+.5}]:[];
if(mapSize==='huge')camps.push({x:Math.floor(s.width*.18)+.5,y:Math.floor(s.height*.37)+.5});
camps.push(...camps.map(p=>({x:s.width-p.x,y:s.height-p.y})));
const campEvidence=camps.map(point=>({point,visitedAt:[null,null] as (number|null)[],extraction:[0,0],headquarters:[] as {side:number,x:number,y:number,time:number}[]}));
const lastCarried=new Map<number,number>(),recordedHQs=new Set<number>();
const milestones:unknown[]=[];let next=0;
while(!isGameOver(s)&&s.time<2700){
 stepGame(s,.05);
 for(const e of s.entities){if(e.hp<=0)continue;(e.kind==='unit'?roles:buildings)[e.side].add(e.role);}
 for(const e of s.entities){
  if(e.hp<=0)continue;
  for(const camp of campEvidence){
   if(e.kind==='unit'&&Math.hypot(e.x-camp.point.x,e.y-camp.point.y)<6){
    camp.visitedAt[e.side]??=s.time;
    if(e.role==='worker'&&e.order.type==='gather'){
     const node=s.resources.find(r=>r.id===(e.order.type==='gather'?e.order.target:undefined));
     if(node&&Math.hypot(node.x-camp.point.x,node.y-camp.point.y)<6)camp.extraction[e.side]+=Math.max(0,e.carried-(lastCarried.get(e.id)??e.carried));
    }
   }
   if(e.role==='hq'&&e.progress===1&&Math.hypot(e.x-camp.point.x,e.y-camp.point.y)<9&&!recordedHQs.has(e.id)){
    camp.headquarters.push({side:e.side,x:e.x,y:e.y,time:s.time});recordedHQs.add(e.id);
   }
  }
  lastCarried.set(e.id,e.carried);
 }
 for(const side of [0,1] as const){const age=playerAge(s.players[side]);if(ages[side][age-1]===undefined)ages[side][age-1]=s.time;}
 if(s.time>=next){milestones.push({time:s.time,players:structuredClone(s.players),living:[0,1].map(side=>s.entities.filter(e=>e.side===side&&e.hp>0).reduce((counts,e)=>{counts[e.role]=(counts[e.role]??0)+1;return counts;},{} as Record<string,number>))});next+=60;}
 if(s.players.some(p=>p.wood<0||p.ore<0||p.crystal<0)||s.entities.some(e=>!Number.isFinite(e.x)||!Number.isFinite(e.y)))throw new Error('Invalid economy or position');
}
const result={faction,opponent,mapSize,seed,time:s.time,winner:s.winner,draw:s.draw,finished:isGameOver(s),ages,roles:roles.map(r=>[...r]),buildings:buildings.map(r=>[...r]),campEvidence,milestones};
writeFileSync(`${out}/${faction}-${opponent}-${mapSize}-${seed}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,milestones:undefined}));
