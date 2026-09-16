import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { playerAge, researchRequirement } from '../src/core/progression';

function setup(){
 const s=createGame('orcs',4127,'fairies',{controllers:['human','human']});
 Object.assign(s.players[0],{wood:5000,ore:5000,crystal:500});
 const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
 return {s,hq};
}
function advance(s:ReturnType<typeof createGame>,seconds:number){for(let i=0;i<seconds*10;i++)stepGame(s,.1);}
describe('three-age research progression',()=>{
 it('advances only after paid research completes and preserves earlier technologies',()=>{
  const {s,hq}=setup();
  expect(playerAge(s.players[0])).toBe(1);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'citadel-age'})).toBe(false);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'town-age'})).toBe(true);
  expect(s.players[0].wood).toBe(4740);
  advance(s,64);expect(playerAge(s.players[0])).toBe(1);
  advance(s,2);expect(playerAge(s.players[0])).toBe(2);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'citadel-age'})).toBe(true);
  advance(s,91);expect(playerAge(s.players[0])).toBe(3);
  expect(s.players[0].upgrades).toEqual(['town-age','citadel-age']);
 });
 it('requires age and prerequisite research for veteran weapons',()=>{
  const {s}=setup();
  expect(researchRequirement(s,0,'veteran-arms')).toBe('Requires Citadel Age');
  s.players[0].upgrades.push('town-age','citadel-age');
  expect(researchRequirement(s,0,'veteran-arms')).toBe('Requires Forged Weapons');
  s.players[0].upgrades.push('forged-weapons');
  expect(researchRequirement(s,0,'veteran-arms')).toBeUndefined();
 });
 it('rejects duplicate research across headquarters without charging again',()=>{
  const {s,hq}=setup();
  const second={...hq,id:s.nextId++,x:hq.x+8,queue:[...hq.queue],path:[]};s.entities.push(second);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'town-age'})).toBe(true);
  const wood=s.players[0].wood;
  expect(issueCommand(s,0,{type:'research',id:second.id,upgrade:'town-age'})).toBe(false);
  expect(s.players[0].wood).toBe(wood);
 });
});

import { canPlace, refreshVisibility } from '../src/core/simulation';
import { FACTIONS } from '../src/core/content';
import { generateMap, validateMap } from '../src/core/maps';
import { walkable, segmentWalkable } from '../src/core/navigation';
import type { BuildingRole } from '../src/core/types';
function place(role:BuildingRole){
 const {s,hq}=setup();s.players[0].upgrades.push('town-age');
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 for(let y=3.5;y<18;y++)for(let x=3.5;x<18;x++)if(canPlace(s,0,role,x,y)){
  expect(issueCommand(s,0,{type:'build',ids:[worker.id],role,x,y})).toBe(true);
  const building=s.entities.at(-1)!;building.progress=1;building.hp=building.maxHp;
  return {s,hq,worker,building};
 }
 throw new Error('No legal building site');
}
describe('expansion, counters and fortifications',()=>{
 it('generates connected huge maps with contested resources for several seeds',()=>{
  for(const seed of [4127,91873,72931]){const map=generateMap(seed,'huge');expect(map.width).toBe(88);expect(validateMap(map).valid).toBe(true);expect(map.resources.filter(r=>map.starts.every(p=>Math.hypot(p.x-r.x,p.y-r.y)>20)).length).toBeGreaterThan(12);}
 });
 it('lets a completed expansion preserve the player after losing the starting headquarters',()=>{
  const {s,hq,building}=place('hq');hq.hp=0;advance(s,1);expect(s.winner).toBeNull();
  building.hp=0;advance(s,1);expect(s.winner).toBe(1);
 });
 it('opens gates for passage and refuses to close on troops',()=>{
  const {s,worker,building}=place('gate');
  expect(walkable(s,building.x,building.y)).toBe(false);
  expect(issueCommand(s,1,{type:'toggleGate',ids:[building.id]})).toBe(false);
  expect(issueCommand(s,0,{type:'toggleGate',ids:[building.id]})).toBe(true);
  expect(walkable(s,building.x,building.y)).toBe(true);
  expect(segmentWalkable(s,{x:building.x,y:building.y-.7},{x:building.x,y:building.y+.7})).toBe(true);
  worker.x=building.x;worker.y=building.y;
  expect(issueCommand(s,0,{type:'toggleGate',ids:[building.id]})).toBe(false);
  worker.x=building.x+4;worker.y=building.y;
  expect(issueCommand(s,0,{type:'toggleGate',ids:[building.id]})).toBe(true);
  expect(walkable(s,building.x,building.y)).toBe(false);
 });
 it('enforces cavalry and siege age unlocks when recruiting',()=>{
  const {s,building}=place('barracks');s.players[0].upgrades=[];
  expect(issueCommand(s,0,{type:'train',id:building.id,role:'cavalry'})).toBe(false);
  expect(issueCommand(s,0,{type:'train',id:building.id,role:'special'})).toBe(false);
  s.players[0].upgrades.push('town-age');expect(issueCommand(s,0,{type:'train',id:building.id,role:'cavalry'})).toBe(true);
  expect(issueCommand(s,0,{type:'train',id:building.id,role:'siege'})).toBe(false);
  s.players[0].upgrades.push('citadel-age');expect(issueCommand(s,0,{type:'train',id:building.id,role:'siege'})).toBe(true);
 });
 it('applies the pike counter through real combat damage',()=>{
  function hit(role:'cavalry'|'melee'){
   const {s}=setup();s.entities=s.entities.filter(e=>e.kind==='building'||e.role==='melee');
   const attacker=s.entities.find(e=>e.side===0&&e.kind==='unit')!,target=s.entities.find(e=>e.side===1&&e.kind==='unit')!;
   attacker.role='spear';attacker.x=22;attacker.y=22;target.role=role;target.x=23;target.y=22;target.hp=target.maxHp=1000;target.cooldown=100;
   s.terrain.fill('grass');s.resources=[];refreshVisibility(s);
   issueCommand(s,0,{type:'attack',ids:[attacker.id],target:target.id});stepGame(s,.05);
   return 1000-target.hp;
  }
  expect(hit('cavalry')).toBeGreaterThan(hit('melee')*2.5);
  expect(FACTIONS.orcs.units.siege.buildingDamageMultiplier).toBe(4);
 });
});

import { runAI } from '../src/core/simulation';
it('remembers observed enemy buildings and searches after clearing the known base',()=>{
 const {s}=setup();Object.assign(s.players[0],{wood:0,ore:0,crystal:0});s.resources=[];
 const soldier=s.entities.find(e=>e.side===0&&e.role==='melee')!;
 for(let i=0;i<9;i++)s.entities.push({...soldier,id:s.nextId++,x:20+i*.6,y:20,order:{type:'idle'},queue:[],path:[]});
 const enemy=s.entities.find(e=>e.side===1&&e.role==='hq')!,old={x:enemy.x,y:enemy.y};
 s.visible[0].add(Math.floor(old.y)*s.width+Math.floor(old.x));s.time=300;runAI(s,0);
 expect(soldier.order.type).toBe('attackMove');
 if(soldier.order.type==='attackMove')expect(Math.hypot(soldier.order.x-old.x,soldier.order.y-old.y)).toBeLessThan(4);
 s.visible[0].clear();enemy.x=30.5;enemy.y=35.5;s.time=400;runAI(s,0);
 expect(soldier.order.type).toBe('attackMove');
 if(soldier.order.type==='attackMove')expect(Math.hypot(soldier.order.x-old.x,soldier.order.y-old.y)).toBeLessThan(4);
 s.visible[0].add(Math.floor(old.y)*s.width+Math.floor(old.x));s.time=500;runAI(s,0);
 expect(soldier.order.type).toBe('attackMove');
 if(soldier.order.type==='attackMove')expect(Math.hypot(soldier.order.x-old.x,soldier.order.y-old.y)).toBeGreaterThan(6);
 expect(soldier.order).not.toMatchObject({x:enemy.x,y:enemy.y});
});
it('applies siege damage outside tower range through ordinary attack commands',()=>{
 const {s}=setup();s.terrain.fill('grass');s.resources=[];
 const siege=s.entities.find(e=>e.side===0&&e.role==='melee')!,tower=s.entities.find(e=>e.side===1&&e.role==='hq')!;
 siege.role='siege';siege.x=20;siege.y=20;siege.hp=siege.maxHp=185;
 tower.role='tower';tower.x=29;tower.y=20;tower.hp=tower.maxHp=750;
 refreshVisibility(s);expect(issueCommand(s,0,{type:'attack',ids:[siege.id],target:tower.id})).toBe(true);
 stepGame(s,.05);expect(tower.hp).toBe(641);expect(siege.hp).toBe(185);
});
it('applies both weapon tiers and armor research to existing melee troops',()=>{
 const {s}=setup();s.terrain.fill('grass');s.resources=[];
 const a=s.entities.find(e=>e.side===0&&e.role==='melee')!,b=s.entities.find(e=>e.side===1&&e.role==='melee')!;
 a.x=20;a.y=20;b.x=21;b.y=20;b.hp=b.maxHp=1000;b.cooldown=100;
 s.players[0].upgrades.push('town-age','citadel-age','forged-weapons','veteran-arms');s.players[1].upgrades.push('tempered-armor');
 refreshVisibility(s);expect(issueCommand(s,0,{type:'attack',ids:[a.id],target:b.id})).toBe(true);
 stepGame(s,.05);expect(1000-b.hp).toBeCloseTo(15*1.2*1.25-FACTIONS.fairies.units.melee.armor-2);
});
it('lets workers reach a huge-map flank camp, build a headquarters and deliver its ore',()=>{
 const s=createGame('orcs',4127,'fairies',{mapSize:'huge',controllers:['human','human']});
 s.players[0].upgrades.push('town-age');
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 const camp={x:Math.floor(s.width*.23)+.5,y:Math.floor(s.height*.58)+.5};
 expect(issueCommand(s,0,{type:'move',ids:[worker.id],...camp})).toBe(true);
 advance(s,90);
 expect(Math.hypot(worker.x-camp.x,worker.y-camp.y)).toBeLessThan(2);
 expect(canPlace(s,0,'hq',camp.x,camp.y)).toBe(true);
 expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'hq',...camp})).toBe(true);
 const expansion=s.entities.at(-1)!;advance(s,100);
 expect(expansion.progress).toBe(1);
 const ore=s.resources.find(r=>r.kind==='ore'&&Math.hypot(r.x-camp.x,r.y-camp.y)<6)!;
 const reserve=ore.amount,bank=s.players[0].ore;
 expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:ore.id})).toBe(true);
 advance(s,60);
 expect(ore.amount).toBeLessThan(reserve);
 expect(s.players[0].ore).toBeGreaterThan(bank);
 expect(Math.hypot(worker.x-expansion.x,worker.y-expansion.y)).toBeLessThan(8);
});
