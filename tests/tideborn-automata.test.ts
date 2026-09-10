import { expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Entity, FactionId, GameState, TerrainKind, UnitRole } from '../src/core/types';
function flat(f:FactionId){const s=createGame(f,4127,'orcs',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];return s;}
function advance(s:GameState,seconds:number){for(let i=0;i<seconds*20;i++)stepGame(s,.05);}
function special(s:GameState):Entity{const e=s.entities.find(e=>e.side===0&&e.role==='worker')!;const d=FACTIONS[s.players[0].faction].units.special;e.role='special';e.hp=e.maxHp=d.hp;e.x=e.y=20.25;if(s.players[0].faction==='automata')e.shield=e.maxShield=45;return e;}
it('Tideborn cross wet terrain faster than grass while ordinary troops slow down',()=>{
 const distance=(f:FactionId,t:TerrainKind)=>{const s=flat(f);s.terrain.fill(t);const e=s.entities.find(e=>e.side===0&&e.role==='worker')!;e.x=e.y=20.25;issueCommand(s,0,{type:'move',ids:[e.id],x:28,y:20.25});advance(s,1);return e.x-20.25;};
 for(const wet of ['mud','shallows'] as const){expect(distance('tideborn',wet)).toBeGreaterThan(distance('tideborn','grass'));expect(distance('orcs',wet)).toBeLessThan(distance('orcs','grass'));}
});
it('Surge heals only nearby friendly units, accelerates movement and expires on time',()=>{
 const s=flat('tideborn'),caster=special(s),ally=s.entities.find(e=>e.side===0&&e.role==='melee')!,far=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 ally.x=21.25;ally.y=20.25;ally.hp-=40;far.hp-=40;
 const enemy=s.entities.find(e=>e.side===1&&e.role==='melee')!;enemy.x=21;enemy.y=21;enemy.hp-=40;
 refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[caster.id]})).toBe(true);expect(ally.hp).toBe(ally.maxHp-5);expect(far.hp).toBe(far.maxHp-40);expect(enemy.hp).toBe(enemy.maxHp-40);expect(ally.surgeUntil).toBe(6);expect(issueCommand(s,0,{type:'ability',ids:[caster.id]})).toBe(false);
 enemy.x=42;enemy.y=42;issueCommand(s,0,{type:'move',ids:[ally.id],x:30,y:20.25});advance(s,1);expect(ally.x-21.25).toBeGreaterThan(FACTIONS.tideborn.units.melee.speed);advance(s,5.1);expect(s.time).toBeGreaterThan(ally.surgeUntil!);
});
it('Automata shields absorb actual attacks, wait six seconds, then recharge',()=>{
 const s=flat('automata'),unit=s.entities.find(e=>e.side===0&&e.role==='melee')!,foe=s.entities.find(e=>e.side===1&&e.role==='melee')!;unit.x=20;unit.y=20;foe.x=21;foe.y=20;unit.cooldown=100;
 refreshVisibility(s);stepGame(s,.05);expect(unit.shield).toBeLessThan(unit.maxShield!);expect(unit.hp).toBe(unit.maxHp);const damaged=unit.shield!;
 foe.x=42;foe.y=42;issueCommand(s,0,{type:'hold',ids:[unit.id]});advance(s,5.9);expect(unit.shield).toBe(damaged);advance(s,1);expect(unit.shield).toBeGreaterThan(damaged);
});
it('damage beyond a shield reaches health and retains damage accounting',()=>{
 const s=flat('automata'),unit=s.entities.find(e=>e.side===0&&e.role==='melee')!,foe=s.entities.find(e=>e.side===1&&e.role==='melee')!;unit.x=20;unit.y=20;unit.shield=2;unit.lastDamagedAt=0;foe.x=21;foe.y=20;unit.cooldown=100;
 refreshVisibility(s);stepGame(s,.05);expect(unit.shield).toBe(0);expect(unit.hp).toBeLessThan(unit.maxHp);const event=s.events.find(e=>e.type==='attack'&&e.target===unit.id)!;expect(event.amount).toBeCloseTo(unit.maxHp-unit.hp+2);
});
it('Ward Engines restore damaged friendly shields automatically without wasting cooldown on full shields',()=>{
 const s=flat('automata'),caster=special(s),ally=s.entities.find(e=>e.side===0&&e.role==='melee')!;ally.x=21;ally.y=20;
 refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[caster.id]})).toBe(false);expect(caster.abilityReadyAt).toBeUndefined();ally.shield=0;ally.lastDamagedAt=0;stepGame(s,.05);expect(ally.shield).toBe(24);expect(caster.abilityReadyAt).toBeCloseTo(20.05);advance(s,1);expect(ally.shield).toBe(24);
});
it.each(['tideborn','automata'] as FactionId[])('%s AI gathers crystal and recruits its full roster',f=>{
 const s=createGame(f,4127,f,{controllers:['ai','ai'],mapSize:'large'}),trained=new Set<UnitRole>();let crystal=0;
 for(let i=0;i<8000;i++){stepGame(s,.05);for(const e of s.events){if(e.type==='train'&&e.side===0)trained.add(s.entities.find(u=>u.id===e.source)!.role as UnitRole);if(e.type==='gather'&&e.side===0&&e.resource==='crystal')crystal+=e.amount??0;}}
 expect(crystal).toBeGreaterThan(0);expect([...trained]).toEqual(expect.arrayContaining(['worker','melee','ranged','special']));
});

it('shield and terrain traits follow content definitions rather than faction names',()=>{
 const worker=FACTIONS.orcs.units.worker,oldShield=worker.shield,oldTerrain=FACTIONS.orcs.terrainSpeeds;
 try{
  worker.shield=17;FACTIONS.orcs.terrainSpeeds={mud:1.4};
  const s=flat('orcs');s.terrain.fill('mud');const unit=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  expect(unit.shield).toBe(17);expect(unit.maxShield).toBe(17);unit.x=20.25;unit.y=20.25;
  issueCommand(s,0,{type:'move',ids:[unit.id],x:27.25,y:20.25});advance(s,1);expect(unit.x-20.25).toBeGreaterThan(worker.speed);
 }finally{worker.shield=oldShield;FACTIONS.orcs.terrainSpeeds=oldTerrain;}
});
